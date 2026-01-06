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
        this.ffmpegPath = 'ffmpeg'; // 可通过 setFfmpegPath 配置

        // 确保缓存目录存在
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        // 定期清理过期会话
        setInterval(() => this.cleanup(), 300000); // 每5分钟清理一次
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
     * 启动转码会话
     * @param {string} inputUrl - 原始视频 URL
     * @param {object} options - 转码选项
     * @returns {Promise<{sessionId: string, playlistUrl: string}>}
     */
    async startTranscode(inputUrl, options = {}) {
        const { quality = 'medium', hwaccel = 'none' } = options;

        // 生成会话 ID
        const sessionId = crypto.createHash('md5')
            .update(inputUrl + Date.now())
            .digest('hex')
            .slice(0, 12);

        const outputDir = path.join(this.cacheDir, sessionId);
        fs.mkdirSync(outputDir, { recursive: true });

        const playlistPath = path.join(outputDir, 'playlist.m3u8');

        // 构建 FFmpeg 参数
        const args = this._buildArgs(inputUrl, outputDir, { quality, hwaccel });

        console.log(`[Transcode] Starting session ${sessionId}`);
        console.log(`[Transcode] Input URL: ${inputUrl.substring(0, 100)}...`);
        console.log(`[Transcode] FFmpeg args: ${args.join(' ')}`);

        const proc = spawn(this.ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let lastLog = '';
        proc.stderr.on('data', (data) => {
            const log = data.toString().trim();
            // 只记录有意义的日志，避免刷屏
            if (log.includes('frame=') || log.includes('Error') || log.includes('error')) {
                if (log !== lastLog) {
                    console.log(`[FFmpeg:${sessionId}] ${log.substring(0, 200)}`);
                    lastLog = log;
                }
            }
        });

        proc.on('error', (err) => {
            console.error(`[Transcode] FFmpeg process error:`, err.message);
        });

        proc.on('close', (code) => {
            console.log(`[Transcode] Session ${sessionId} ended with code ${code}`);
        });

        this.activeSessions.set(sessionId, {
            proc,
            outputDir,
            playlistPath,
            inputUrl,
            startTime: Date.now(),
            quality,
            hwaccel
        });

        // 等待 m3u8 文件生成
        try {
            await this._waitForPlaylist(playlistPath, 15000);
        } catch (err) {
            console.error(`[Transcode] Failed to start:`, err.message);
            this.stopSession(sessionId);
            throw err;
        }

        return {
            sessionId,
            playlistUrl: `/api/plugins/video/api/transcode/${sessionId}/playlist.m3u8`
        };
    }

    /**
     * 构建 FFmpeg 参数
     */
    _buildArgs(inputUrl, outputDir, options) {
        const { quality, hwaccel } = options;
        const args = [];

        // 网络超时设置
        args.push('-timeout', '30000000'); // 30秒超时
        args.push('-reconnect', '1');
        args.push('-reconnect_streamed', '1');
        args.push('-reconnect_delay_max', '5');

        // 硬件加速输入
        if (hwaccel === 'nvenc') {
            args.push('-hwaccel', 'cuda');
        } else if (hwaccel === 'qsv') {
            args.push('-hwaccel', 'qsv');
        } else if (hwaccel === 'vaapi') {
            args.push('-hwaccel', 'vaapi', '-hwaccel_output_format', 'vaapi');
        }

        // 输入源
        args.push('-i', inputUrl);

        // 视频编码器
        if (hwaccel === 'nvenc') {
            args.push('-c:v', 'h264_nvenc');
            args.push('-profile:v', 'main');
        } else if (hwaccel === 'qsv') {
            args.push('-c:v', 'h264_qsv');
        } else if (hwaccel === 'vaapi') {
            args.push('-c:v', 'h264_vaapi');
        } else {
            args.push('-c:v', 'libx264');
            // CPU 编码预设
            const presets = { fast: 'veryfast', medium: 'medium', high: 'slow' };
            args.push('-preset', presets[quality] || 'medium');
        }

        // 视频质量 (CRF 模式)
        const crfValues = { fast: 28, medium: 23, high: 18 };
        if (hwaccel === 'none') {
            args.push('-crf', String(crfValues[quality] || 23));
        }

        // 视频格式兼容性
        args.push('-pix_fmt', 'yuv420p');
        args.push('-profile:v', 'main');
        args.push('-level', '4.0');

        // 音频编码
        args.push('-c:a', 'aac');
        args.push('-b:a', '128k');
        args.push('-ac', '2'); // 立体声

        // HLS 输出配置
        args.push('-f', 'hls');
        args.push('-hls_time', '4');
        args.push('-hls_list_size', '0');
        args.push('-hls_flags', 'delete_segments+append_list+independent_segments');
        args.push('-hls_segment_type', 'mpegts');
        args.push('-hls_segment_filename', path.join(outputDir, 'seg_%05d.ts'));
        args.push(path.join(outputDir, 'playlist.m3u8'));

        return args;
    }

    /**
     * 等待 playlist.m3u8 文件生成
     */
    async _waitForPlaylist(playlistPath, timeout = 15000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            if (fs.existsSync(playlistPath)) {
                const content = fs.readFileSync(playlistPath, 'utf-8');
                // 确保至少有一个分片信息
                if (content.includes('#EXTINF')) {
                    return true;
                }
            }
            await new Promise(r => setTimeout(r, 300));
        }

        throw new Error('转码启动超时：播放列表未就绪');
    }

    /**
     * 获取转码文件
     */
    getFile(sessionId, filename) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            // 尝试从磁盘读取（可能是刚创建的会话）
            const filePath = path.join(this.cacheDir, sessionId, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
            return null;
        }

        const filePath = path.join(session.outputDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }

    /**
     * 获取会话信息
     */
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    /**
     * 获取所有活跃会话
     */
    getActiveSessions() {
        const sessions = [];
        for (const [id, session] of this.activeSessions) {
            sessions.push({
                id,
                startTime: session.startTime,
                duration: Date.now() - session.startTime,
                quality: session.quality,
                hwaccel: session.hwaccel
            });
        }
        return sessions;
    }

    /**
     * 停止转码会话
     */
    stopSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            console.log(`[Transcode] Stopping session ${sessionId}`);
            try {
                session.proc.kill('SIGTERM');
            } catch (e) {
                // 进程可能已经结束
            }

            // 延迟清理文件，防止正在读取
            setTimeout(() => {
                try {
                    if (fs.existsSync(session.outputDir)) {
                        fs.rmSync(session.outputDir, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error(`[Transcode] Cleanup error:`, e.message);
                }
            }, 3000);

            this.activeSessions.delete(sessionId);
        }
    }

    /**
     * 清理过期会话
     * @param {number} maxAgeMs - 最大存活时间（毫秒），默认1小时
     */
    cleanup(maxAgeMs = 3600000) {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [id, session] of this.activeSessions) {
            if (now - session.startTime > maxAgeMs) {
                this.stopSession(id);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`[Transcode] Cleaned up ${cleanedCount} expired sessions`);
        }

        // 同时清理磁盘上的孤儿目录
        try {
            const dirs = fs.readdirSync(this.cacheDir);
            for (const dir of dirs) {
                const dirPath = path.join(this.cacheDir, dir);
                const stat = fs.statSync(dirPath);
                if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
                    if (!this.activeSessions.has(dir)) {
                        fs.rmSync(dirPath, { recursive: true, force: true });
                        console.log(`[Transcode] Removed orphan cache: ${dir}`);
                    }
                }
            }
        } catch (e) {
            // 忽略清理错误
        }
    }
}

module.exports = new TranscodeService();
