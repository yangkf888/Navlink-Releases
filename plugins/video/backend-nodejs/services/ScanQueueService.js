/**
 * 后台异步任务队列服务 (ScanQueueService)
 * Video 2.0 核心组件 - 负责视频探测及图片预缓存
 */

const { getDatabase } = require('../database');
const transcodeService = require('./TranscodeService');
const imageCacheService = require('./ImageCacheService');
const os = require('os');

// 并发及延迟配置
const PROBE_CONCURRENCY = 1; // 保持低并发探测
const IMAGE_CONCURRENCY = 1; // 降低下载图片并发 (从 2 降到 1)
const BATCH_SIZE = 6;         // 进一步缩小批次量，确保平稳

// 🚀 v2.0.7 呼吸式调度配置 (高频小步快跑模式)
const REFRESH_DELAY = 1000;   // NFO/TMDB 补全间隔 (1秒一个，3000部约50分钟)
const PROBE_DELAY = 2000;     // 视频探测间隔 (2秒一个，3000部约1.5小时)
const IMAGE_DELAY = 500;      // 图片处理间隔
const IDLE_SLEEP = 30000;     // 全部空闲时的长深度睡眠

class ScanQueueService {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.processedCount = 0;
        this.failedCount = 0;
        this.lastActivity = null;
        this.isPausedByPlayback = false;

        // 内存中的临时即时重试队列 (高优先级)
        this.instantRetryUrls = [];
    }

    /**
     * 启动后台服务
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[ScanQueue] Unified V2.0.7 background scan service started (Breathing Mode)');
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
        if (!this.isRunning) this.start();
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isPausedByPlayback: this.isPausedByPlayback,
            processedCount: this.processedCount,
            failedCount: this.failedCount,
            lastActivity: this.lastActivity,
            instantRetryQueueLength: this.instantRetryUrls.length
        };
    }

    /**
     * 设置是否因播放而暂停 (由 TranscodeService 驱动)
     */
    setPausedByPlayback(paused) {
        if (this.isPausedByPlayback === paused) return;
        this.isPausedByPlayback = paused;
        if (paused) {
            console.log('[ScanQueue] 🚀 Active playback detected, background tasks entering silent mode...');
        } else {
            console.log('[ScanQueue] ✅ No active playback, background tasks resuming...');
        }
    }

    /**
     * 主循环 (🚀 v2.0.7 分层呼吸逻辑)
     */
    async _runLoop() {
        while (this.isRunning) {
            // 1. 优先处理即时重试队列
            if (this.instantRetryUrls.length > 0) {
                const url = this.instantRetryUrls.shift();
                await imageCacheService.preCache(url);
                continue;
            }

            // 2. 播放避让逻辑 (最高优先级)
            if (this.isPausedByPlayback) {
                await this._sleep(30000); // 播放中，进入 30 秒深度避让
                continue;
            }

            // 3. 分层获取任务
            // A. 元数据补完任务 (nfo_parsed = 0)
            const refreshItems = this._getPendingRefreshItems(1);
            if (refreshItems.length > 0) {
                await this._refreshMetadata(refreshItems[0]);
                await this._sleep(REFRESH_DELAY + Math.random() * 2000);
                continue;
            }

            // B. 视频探测任务 (probe_status = 0)
            const probeItems = this._getPendingProbeItems(1);
            if (probeItems.length > 0) {
                await this._probeItem(probeItems[0]);
                await this._sleep(PROBE_DELAY + Math.random() * 3000);
                continue;
            }

            // C. 图片缓存任务
            const imageItems = this._getPendingImageUrls(1);
            if (imageItems.length > 0) {
                await imageCacheService.preCache(imageItems[0]);
                await this._sleep(IMAGE_DELAY + Math.random() * 1000);
                continue;
            }

            // 4. 全部空闲时进入深度睡眠
            this.lastActivity = new Date().toISOString();
            await this._sleep(IDLE_SLEEP);
        }
    }

    /**
     * 获取待补全元数据的媒体项
     */
    _getPendingRefreshItems(limit) {
        const db = getDatabase();
        try {
            return db.all(
                `SELECT id, source_id, path, title, video_files 
                 FROM netdisk_media 
                 WHERE nfo_parsed = 0 AND is_locked = 0
                 ORDER BY scanned_at DESC 
                 LIMIT ?`,
                [limit]
            );
        } catch (err) { return []; }
    }

    /**
     * 补全元数据实操 (读 NFO / TMDB)
     */
    async _refreshMetadata(item) {
        const { mediaScanService } = require('./MediaScanService');
        const db = getDatabase();
        try {
            console.log(`[ScanQueue] Background refreshing metadata for: ${item.title}`);
            const source = db.get('SELECT * FROM netdisk_sources WHERE id = ?', [item.source_id]);
            if (!source) return;

            const { getNetdiskClient } = require('../routes/netdisk');
            const client = await getNetdiskClient(source);
            const folder = { path: item.path, name: item.title };

            // 💡 调用 MediaScanService 的 processMediaFolder，并设 force = true
            // 由于是后台单个处理，IO 压力受 REFRESH_DELAY 保护
            await mediaScanService.processMediaFolder(client, source, folder, true, true);
            this.processedCount++;
        } catch (err) {
            console.warn(`[ScanQueue] Failed to refresh metadata for ${item.title}:`, err.message);
            // 标记为已处理以避免死循环，或者增加错误计数
            db.run('UPDATE netdisk_media SET nfo_parsed = -1 WHERE id = ?', [item.id]);
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
        } catch (err) { return []; }
    }

    /**
     * 获取待预缓存的图片 URL
     */
    _getPendingImageUrls(limit) {
        const db = getDatabase();
        try {
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
        } catch (err) { return []; }
    }

    /**
     * 探测单个媒体项
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
                const port = process.env.PORT || 3002;
                probeUrl = `http://127.0.0.1:${port}/api/plugins/video/api/netdisk/stream?sourceId=${source.id}&path=${encodeURIComponent(item.path + '/' + firstVideo)}`;
            }

            console.log(`[ScanQueue] Probing in background: ${item.title}`);
            const mediaInfo = await transcodeService.getMediaInfo(probeUrl, {});

            if (mediaInfo && mediaInfo.videoCodec) {
                db.run(
                    `UPDATE netdisk_media 
                     SET v_codec = ?, a_codec = ?, duration = ?, container = ?, probe_status = 1 
                     WHERE id = ?`,
                    [mediaInfo.videoCodec, mediaInfo.audioCodec || null, mediaInfo.duration || 0, (mediaInfo.format || '').split(',')[0], item.id]
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
