/**
 * FFmpeg 转码服务
 * 用于将 STRM 中的 HEVC 等不兼容格式转码为 HLS (H.264)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class TranscodeService {
    constructor() {
        this.cacheDir = path.join(__dirname, '../../data/transcode_cache');
        this.activeSessions = new Map();

        // 优先查找本地便携版 FFmpeg
        const localBinPath = path.join(__dirname, '../../data/bin/ffmpeg');
        if (fs.existsSync(localBinPath)) {
            this.ffmpegPath = localBinPath;
            console.log('[Transcode] Using local portable FFmpeg:', localBinPath);
        } else {
            this.ffmpegPath = 'ffmpeg'; // 默认回退到系统 PATH
        }

        // 确保缓存目录存在
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        // 服务启动时清理所有旧的缓存目录
        this._cleanupOnStartup();

        // 定期清理过期或无活动的会话
        setInterval(() => this.cleanup(), 60000); // 每分钟检查一次
    }

    /**
     * 服务启动时清理所有旧的缓存目录
     */
    _cleanupOnStartup() {
        try {
            const dirs = fs.readdirSync(this.cacheDir);
            for (const dir of dirs) {
                const dirPath = path.join(this.cacheDir, dir);
                const stat = fs.statSync(dirPath);
                if (stat.isDirectory()) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                    console.log(`[Transcode] Startup cleanup: removed ${dir}`);
                }
            }
        } catch (e) {
            console.error('[Transcode] Startup cleanup error:', e.message);
        }
    }

    /**
     * 设置 FFmpeg 路径
     */
    setFfmpegPath(ffmpegPath) {
        this.ffmpegPath = ffmpegPath || 'ffmpeg';
    }

    /**
     * 检测 FFmpeg 是否可用
     */
    async detectFFmpeg(customPath) {
        const ffmpegPath = customPath || this.ffmpegPath;
        return new Promise((resolve) => {
            const proc = spawn(ffmpegPath, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
            let output = '';

            proc.stdout.on('data', (d) => output += d.toString());

            proc.on('close', (code) => {
                if (code === 0) {
                    const versionMatch = output.match(/ffmpeg version ([^\s]+)/);
                    resolve({
                        available: true,
                        version: versionMatch ? versionMatch[1] : 'unknown',
                        path: ffmpegPath
                    });
                } else {
                    resolve({ available: false, version: null, path: null });
                }
            });

            proc.on('error', () => {
                resolve({ available: false, version: null, path: null });
            });
        });
    }

    /**
     * 检测硬件加速支持
     */
    async detectHwAccel() {
        const result = { nvenc: false, qsv: false, vaapi: false };

        return new Promise((resolve) => {
            const proc = spawn(this.ffmpegPath, ['-encoders'], { stdio: ['ignore', 'pipe', 'pipe'] });
            let output = '';

            proc.stdout.on('data', (d) => output += d.toString());

            proc.on('close', () => {
                result.nvenc = output.includes('h264_nvenc');
                result.qsv = output.includes('h264_qsv');
                result.vaapi = output.includes('h264_vaapi');
                resolve(result);
            });

            proc.on('error', () => resolve(result));
        });
    }

    /**
     * 获取活跃会话
     */
    getActiveSessions() {
        const sessions = [];
        for (const [id, session] of this.activeSessions) {
            sessions.push({
                id,
                startTime: session.startTime,
                duration: Date.now() - session.startTime,
                lastAccess: session.lastAccess,
                quality: session.quality,
                hwaccel: session.hwaccel
            });
        }
        return sessions;
    }

    /**
     * 启动转码会话
     */
    async startTranscode(inputUrl, options = {}) {
        const { quality = 'medium', hwaccel = 'none', headers = {} } = options;

        // 生成会话 ID (基于 URL 的哈希)
        const sessionId = crypto.createHash('md5')
            .update(inputUrl + quality + hwaccel)
            .digest('hex')
            .slice(0, 12);

        // 如果已有活跃会话，更新活动时间并返回
        if (this.activeSessions.has(sessionId)) {
            const session = this.activeSessions.get(sessionId);
            session.lastAccess = Date.now();
            console.log(`[Transcode] Reusing existing session ${sessionId}`);
            return {
                sessionId,
                playlistUrl: `/api/plugins/video/api/transcode/${sessionId}/playlist.m3u8`
            };
        }

        const outputDir = path.join(this.cacheDir, sessionId);
        if (fs.existsSync(outputDir)) {
            try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch (e) { }
        }
        fs.mkdirSync(outputDir, { recursive: true });

        const playlistPath = path.join(outputDir, 'playlist.m3u8');

        // 构建 FFmpeg 参数
        const args = this._buildArgs(inputUrl, outputDir, { quality, hwaccel, headers });

        console.log(`[Transcode] Starting session ${sessionId}`);
        const proc = spawn(this.ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        proc.on('error', (err) => {
            console.error(`[Transcode] FFmpeg ${sessionId} failed to start:`, err.message);
            this.stopSession(sessionId);
        });

        proc.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.warn(`[Transcode] Session ${sessionId} exited unexpectedly with code ${code}`);
            }
            this.activeSessions.delete(sessionId);
        });

        this.activeSessions.set(sessionId, {
            proc,
            outputDir,
            playlistPath,
            inputUrl,
            startTime: Date.now(),
            lastAccess: Date.now(),
            quality,
            hwaccel
        });

        // 恢复之前的逻辑：等待 manifest 文件生成 (最多等待 10 秒)
        // 虽然前端会转圈等待，但能保证返回时文件一定存在，避免 404
        try {
            await this._waitForPlaylist(playlistPath, 10000);
        } catch (err) {
            console.warn(`[Transcode] Manifest not ready for ${sessionId} within timeout, but returning URL anyway.`);
        }

        return {
            sessionId,
            playlistUrl: `/api/plugins/video/api/transcode/${sessionId}/playlist.m3u8`
        };
    }

    /**
     * 等待 playlist.m3u8 文件生成
     */
    async _waitForPlaylist(playlistPath, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (fs.existsSync(playlistPath)) {
                try {
                    const content = fs.readFileSync(playlistPath, 'utf-8');
                    // 确保至少有一个分片信息，否则 Hls.js 会加载失败
                    if (content.includes('#EXTINF')) {
                        return true;
                    }
                } catch (e) { }
            }
            await new Promise(r => setTimeout(r, 500));
        }
        throw new Error('Manifest timeout');
    }

    /**
     * 构建 FFmpeg 参数
     */
    _buildArgs(inputUrl, outputDir, options) {
        const { quality, hwaccel, headers } = options;
        const args = ['-nostdin']; // 防止 FFmpeg 尝试读取 stdin 导致挂起

        // 全局 Header 设置
        if (headers && Object.keys(headers).length > 0) {
            let headersStr = '';
            for (const [k, v] of Object.entries(headers)) {
                headersStr += `${k}: ${v}\r\n`;
            }
            args.push('-headers', headersStr);
        } else {
            args.push('-user_agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        args.push('-timeout', '20000000');
        args.push('-reconnect', '1');
        args.push('-reconnect_streamed', '1');
        args.push('-reconnect_delay_max', '5');
        args.push('-analyzeduration', '5000000');
        args.push('-probesize', '5000000');

        if (hwaccel === 'nvenc') {
            args.push('-hwaccel', 'cuda');
        } else if (hwaccel === 'qsv') {
            args.push('-hwaccel', 'qsv');
        } else if (hwaccel === 'vaapi') {
            args.push('-hwaccel', 'vaapi', '-hwaccel_output_format', 'vaapi');
        }

        args.push('-i', inputUrl);

        if (hwaccel === 'nvenc') {
            args.push('-c:v', 'h264_nvenc');
        } else if (hwaccel === 'qsv') {
            args.push('-c:v', 'h264_qsv');
        } else if (hwaccel === 'vaapi') {
            args.push('-c:v', 'h264_vaapi');
        } else {
            args.push('-c:v', 'libx264');
            const presets = { fast: 'ultrafast', medium: 'veryfast', high: 'medium' };
            args.push('-preset', presets[quality] || 'veryfast');
        }

        const crfValues = { fast: 30, medium: 25, high: 20 };
        if (hwaccel === 'none') {
            args.push('-crf', String(crfValues[quality] || 25));
        }

        args.push('-pix_fmt', 'yuv420p');
        args.push('-movflags', '+faststart');
        args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');

        args.push('-f', 'hls');
        args.push('-hls_time', '4');
        args.push('-hls_list_size', '10');
        args.push('-hls_flags', 'delete_segments+independent_segments');
        args.push('-hls_segment_type', 'mpegts');
        args.push('-hls_segment_filename', path.join(outputDir, 'seg_%05d.ts'));
        args.push(path.join(outputDir, 'playlist.m3u8'));

        return args;
    }

    /**
     * 获取转码文件
     */
    getFile(sessionId, filename) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.lastAccess = Date.now(); // 只要有请求，就更新活动时间
        }

        const filePath = path.join(this.cacheDir, sessionId, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }

    /**
     * 停止转码会话
     */
    stopSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            console.log(`[Transcode] Stopping session ${sessionId} (PID: ${session.proc.pid})`);
            try {
                session.proc.kill('SIGKILL');
            } catch (e) { }

            try {
                if (fs.existsSync(session.outputDir)) {
                    fs.rmSync(session.outputDir, { recursive: true, force: true });
                }
            } catch (e) { }

            this.activeSessions.delete(sessionId);
        }
    }

    /**
     * 清理过期或无活动的会话
     */
    cleanup() {
        const now = Date.now();
        const maxIdleTime = 120000; // 2分钟无访问则停止

        for (const [id, session] of this.activeSessions) {
            if (now - session.lastAccess > maxIdleTime) {
                console.log(`[Transcode] Session ${id} timed out (no access for 2min), stopping...`);
                this.stopSession(id);
            }
        }

        // 清理物理磁盘上的孤儿目录 (超过1小时的全部清理)
        try {
            const dirs = fs.readdirSync(this.cacheDir);
            for (const dir of dirs) {
                const dirPath = path.join(this.cacheDir, dir);
                const stat = fs.statSync(dirPath);
                if (stat.isDirectory() && now - stat.mtimeMs > 3600000) { // 1小时
                    if (!this.activeSessions.has(dir)) {
                        fs.rmSync(dirPath, { recursive: true, force: true });
                        console.log(`[Transcode] Removed orphan cache: ${dir}`);
                    }
                }
            }
        } catch (e) { }
    }
}

module.exports = new TranscodeService();
