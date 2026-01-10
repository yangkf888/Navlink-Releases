/**
 * 后台异步探测队列服务
 * Video 2.0 核心组件 - 在系统空闲时自动补全视频编码信息
 */

const { getDatabase } = require('../database');
const transcodeService = require('./TranscodeService');
const os = require('os');

// 配置参数
const PROBE_CONCURRENCY = 2;      // 探测并发数 (可调 1-5)
const PROBE_DELAY = 500;          // 每次探测间隔 (ms)
const LOAD_THRESHOLD = 2.0;       // CPU 负载阈值，超过则暂停
const BATCH_SIZE = 10;            // 每批次处理数量

class ProbeQueueService {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.processedCount = 0;
        this.failedCount = 0;
        this.lastActivity = null;
    }

    /**
     * 启动后台探测服务
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[ProbeQueue] Background probe service started');
        this._runLoop();
    }

    /**
     * 停止服务
     */
    stop() {
        this.isRunning = false;
        console.log('[ProbeQueue] Background probe service stopped');
    }

    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            processedCount: this.processedCount,
            failedCount: this.failedCount,
            lastActivity: this.lastActivity
        };
    }

    /**
     * 主循环
     */
    async _runLoop() {
        while (this.isRunning) {
            // 检查系统负载
            const load = os.loadavg()[0];
            if (load > LOAD_THRESHOLD) {
                this.isPaused = true;
                console.log(`[ProbeQueue] System load ${load.toFixed(2)} exceeds threshold, pausing...`);
                await this._sleep(10000); // 高负载时休眠 10 秒
                continue;
            }
            this.isPaused = false;

            // 获取待探测的媒体
            const pendingItems = this._getPendingItems(BATCH_SIZE);
            if (pendingItems.length === 0) {
                // 没有待处理项，等待后再检查
                await this._sleep(30000); // 空闲时休眠 30 秒
                continue;
            }

            // 并发探测 (受限)
            for (const item of pendingItems) {
                if (!this.isRunning) break;
                await this._probeItem(item);
                await this._sleep(PROBE_DELAY);
            }
        }
    }

    /**
     * 获取待探测的媒体项
     */
    _getPendingItems(limit) {
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
            console.error('[ProbeQueue] Failed to get pending items:', err.message);
            return [];
        }
    }

    /**
     * 探测单个媒体项
     */
    async _probeItem(item) {
        const db = getDatabase();
        this.lastActivity = new Date().toISOString();

        try {
            const videoFiles = JSON.parse(item.video_files || '[]');
            if (videoFiles.length === 0) {
                this._markStatus(item.id, -1); // 无视频文件，标记失败
                return;
            }

            const firstVideo = videoFiles[0];
            let probeUrl = '';

            if (firstVideo.includes('|')) {
                // STRM 文件
                probeUrl = firstVideo.split('|')[1];
            } else {
                // 普通文件 - 需要获取源信息构建 URL
                const source = db.get('SELECT * FROM netdisk_sources WHERE id = ?', [item.source_id]);
                if (!source) {
                    this._markStatus(item.id, -1);
                    return;
                }
                // 构建代理 URL (通过转码服务代理访问)
                probeUrl = `/api/plugins/video/api/netdisk/stream?sourceId=${source.id}&path=${encodeURIComponent(item.path + '/' + firstVideo)}`;
            }

            if (!probeUrl || probeUrl.startsWith('/api')) {
                // 内部代理 URL 无法直接探测，跳过（起播时再探测）
                this._markStatus(item.id, 0); // 保持待探测状态
                return;
            }

            console.log(`[ProbeQueue] Probing: ${item.title}`);
            const mediaInfo = await transcodeService.getMediaInfo(probeUrl, {});

            if (mediaInfo && mediaInfo.videoCodec) {
                db.run(
                    `UPDATE netdisk_media 
                     SET v_codec = ?, a_codec = ?, duration = ?, probe_status = 1 
                     WHERE id = ?`,
                    [mediaInfo.videoCodec, mediaInfo.audioCodec || null, mediaInfo.duration || 0, item.id]
                );
                this.processedCount++;
                console.log(`[ProbeQueue] Success: ${item.title} -> ${mediaInfo.videoCodec}`);
            } else {
                this._markStatus(item.id, -1);
                this.failedCount++;
            }
        } catch (err) {
            console.warn(`[ProbeQueue] Failed to probe ${item.title}:`, err.message);
            this._markStatus(item.id, -1);
            this.failedCount++;
        }
    }

    /**
     * 更新探测状态
     */
    _markStatus(id, status) {
        const db = getDatabase();
        try {
            db.run('UPDATE netdisk_media SET probe_status = ? WHERE id = ?', [status, id]);
        } catch (err) {
            console.error('[ProbeQueue] Failed to update status:', err.message);
        }
    }

    /**
     * 休眠
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 单例导出
const probeQueueService = new ProbeQueueService();
module.exports = { ProbeQueueService, probeQueueService };
