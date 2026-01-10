/**
 * 后台异步任务队列服务 (ScanQueueService)
 * Video 2.0 核心组件 - 负责视频探测及图片预缓存
 */

const { getDatabase } = require('../database');
const transcodeService = require('./TranscodeService');
const imageCacheService = require('./ImageCacheService');
const os = require('os');

// 并发及延迟配置
const PROBE_CONCURRENCY = 2;      // 视频探测并发数
const IMAGE_CONCURRENCY = 3;      // 图片下载并发数
const PROBE_DELAY = 1000;         // 探测间隔
const IMAGE_DELAY = 300;          // 图片下载间隔
const LOAD_THRESHOLD = 2.5;       // CPU 负载阈值
const BATCH_SIZE = 20;            // 每批次处理数量

class ScanQueueService {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.processedCount = 0;
        this.failedCount = 0;
        this.lastActivity = null;

        // 内存中的临时即时重试队列 (高优先级)
        this.instantRetryUrls = [];
    }

    /**
     * 启动后台服务
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[ScanQueue] Unified background scan service started');
        this._runLoop();
    }

    /**
     * 停止服务
     */
    stop() {
        this.isRunning = false;
        console.log('[ScanQueue] Unified background scan service stopped');
    }

    /**
     * 添加即时重试任务 (高优先级)
     */
    addInstantRetry(urls) {
        if (Array.isArray(urls)) {
            this.instantRetryUrls.push(...urls);
        } else {
            this.instantRetryUrls.push(urls);
        }
        // 如果服务没起，尝试拉起
        if (!this.isRunning) this.start();
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            processedCount: this.processedCount,
            failedCount: this.failedCount,
            lastActivity: this.lastActivity,
            instantRetryQueueLength: this.instantRetryUrls.length
        };
    }

    /**
     * 主循环
     */
    async _runLoop() {
        while (this.isRunning) {
            // 1. 优先处理即时重试队列
            if (this.instantRetryUrls.length > 0) {
                const url = this.instantRetryUrls.shift();
                console.log(`[ScanQueue] Processing high-priority retry: ${url.substring(0, 50)}...`);
                await imageCacheService.preCache(url);
                continue;
            }

            // 2. 检查系统负载
            const load = os.loadavg()[0];
            if (load > LOAD_THRESHOLD) {
                this.isPaused = true;
                await this._sleep(10000);
                continue;
            }
            this.isPaused = false;

            // 3. 获取待处理任务 (视频探测占 BATCH_SIZE / 2, 图片预缓存占 BATCH_SIZE / 2)
            const probeItems = this._getPendingProbeItems(Math.floor(BATCH_SIZE / 2));
            const imageItems = this._getPendingImageUrls(Math.floor(BATCH_SIZE / 2));

            if (probeItems.length === 0 && imageItems.length === 0) {
                await this._sleep(15000); // 全部空闲时休眠
                continue;
            }

            // 执行探测任务
            const probePromises = probeItems.map(async (item) => {
                if (!this.isRunning) return;
                await this._probeItem(item);
                await this._sleep(PROBE_DELAY + Math.random() * 500);
            });

            // 执行图片预缓存任务
            const imagePromises = imageItems.map(async (url) => {
                if (!this.isRunning) return;
                console.log(`[ScanQueue] Pre-caching image: ${url.substring(0, 60)}...`);
                await imageCacheService.preCache(url);
                await this._sleep(IMAGE_DELAY + Math.random() * 200);
            });

            await Promise.allSettled([...probePromises, ...imagePromises]);
            this.lastActivity = new Date().toISOString();
        }
    }

    /**
     * 获取待探测的媒体项
     */
    _getPendingProbeItems(limit) {
        const db = getDatabase();
        try {
            return db.all(
                `SELECT id, source_id, path, title, video_files 
                 FROM netdisk_media 
                 WHERE probe_status = 0 
                 ORDER BY scanned_at DESC 
                 LIMIT ?`,
                [limit]
            );
        } catch (err) {
            return [];
        }
    }

    /**
     * 获取待预缓存的图片 URL
     * 条件：netdisk_media 中有 poster_url，但本地没有缓存文件，且不在失败名单中
     */
    _getPendingImageUrls(limit) {
        const db = getDatabase();
        try {
            // 这里我们只选网络资源 (AList, WebDAV) 的封面，跳过本地资源封面 (本地资源由 ImageCacheService 自动识别并跳过存储)
            // 同时排除已在 failed_images 表中的 URL
            return db.all(
                `SELECT m.poster_url 
                 FROM netdisk_media m
                 JOIN netdisk_sources s ON m.source_id = s.id
                 WHERE m.poster_url IS NOT NULL 
                   AND m.poster_url != ''
                   AND s.type IN ('alist', 'webdav')
                   AND m.poster_url NOT IN (SELECT url FROM failed_images WHERE fail_count >= 3)
                   AND m.poster_url NOT LIKE 'http://127.0.0.1%'
                 ORDER BY m.scanned_at DESC 
                 LIMIT ?`,
                [limit]
            ).map(row => row.poster_url);
        } catch (err) {
            return [];
        }
    }

    /**
     * 探测单个媒体项 (原有逻辑)
     */
    async _probeItem(item) {
        const db = getDatabase();
        try {
            const videoFiles = JSON.parse(item.video_files || '[]');
            if (videoFiles.length === 0) {
                this._markStatus(item.id, -1);
                return;
            }

            const firstVideo = videoFiles[0];
            let probeUrl = '';

            if (firstVideo.includes('|')) {
                probeUrl = firstVideo.split('|')[1];
            } else {
                const source = db.get('SELECT * FROM netdisk_sources WHERE id = ?', [item.source_id]);
                if (!source) {
                    this._markStatus(item.id, -1);
                    return;
                }
                // 使用转码服务的流代理 (必须是绝对路径以供 axios 使用)
                const port = process.env.PORT || 3002;
                probeUrl = `http://127.0.0.1:${port}/api/plugins/video/api/netdisk/stream?sourceId=${source.id}&path=${encodeURIComponent(item.path + '/' + firstVideo)}`;
            }

            console.log(`[ScanQueue] Probing: ${item.title}`);
            const mediaInfo = await transcodeService.getMediaInfo(probeUrl, {});

            if (mediaInfo && mediaInfo.videoCodec) {
                db.run(
                    `UPDATE netdisk_media 
                     SET v_codec = ?, a_codec = ?, duration = ?, container = ?, probe_status = 1 
                     WHERE id = ?`,
                    [mediaInfo.videoCodec, mediaInfo.audioCodec || null, mediaInfo.duration || 0, mediaInfo.format || null, item.id]
                );
                this.processedCount++;
            } else {
                this._markStatus(item.id, -1);
                this.failedCount++;
            }
        } catch (err) {
            console.warn(`[ScanQueue] Failed to probe ${item.title}:`, err.message);
            this._markStatus(item.id, -1);
            this.failedCount++;
        }
    }

    _markStatus(id, status) {
        const db = getDatabase();
        try {
            db.run('UPDATE netdisk_media SET probe_status = ? WHERE id = ?', [status, id]);
        } catch (err) { }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const scanQueueService = new ScanQueueService();
module.exports = { ScanQueueService, scanQueueService };
