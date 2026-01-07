const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');

class TranscodeService {
    constructor() {
        this.cacheDir = path.join(process.cwd(), 'data', 'transcode');
        this.activeSessions = new Map();
        this.segmentDuration = 10; // 10秒一个分片
        this.ffmpegPath = '';

        // 初始化
        this._init();
    }

    async _init() {
        if (!fsSync.existsSync(this.cacheDir)) {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } else {
            // 💡 启动时兜底：清空所有残留缓存
            try {
                const files = await fs.readdir(this.cacheDir);
                for (const file of files) {
                    await fs.rm(path.join(this.cacheDir, file), { recursive: true, force: true });
                }
                console.log('[Transcode] Startup cache cleared');
            } catch (e) {
                console.warn('[Transcode] Failed to clear startup cache:', e.message);
            }
        }
        await this.detectFFmpeg();

        // 启动定期清理
        setInterval(() => this.cleanup(), 60000);
    }

    async detectFFmpeg(customPath = '') {
        const pathsToTry = [
            customPath,
            process.env.FFMPEG_PATH,
            'ffmpeg',
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg'
        ].filter(p => p);

        for (const p of pathsToTry) {
            try {
                const isAvail = await new Promise((resolve) => {
                    const proc = spawn(p, ['-version']);
                    proc.on('error', () => resolve(false));
                    proc.on('close', (code) => resolve(code === 0));
                });
                if (isAvail) {
                    this.ffmpegPath = p;
                    ffmpeg.setFfmpegPath(p);
                    console.log(`[Transcode] Using FFmpeg: ${p}`);
                    return { available: true, path: p };
                }
            } catch (e) { }
        }
        return { available: false, error: 'FFmpeg not found' };
    }

    async detectHwAccel() {
        if (!this.ffmpegPath) return [];
        return new Promise((resolve) => {
            const proc = spawn(this.ffmpegPath, ['-hwaccels']);
            let output = '';
            proc.stdout.on('data', (data) => output += data);
            proc.on('close', () => {
                const accels = output.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.includes('Hardware acceleration methods:'));
                resolve(accels);
            });
        });
    }

    /**
     * 透明代理流 (模仿 Jellyfin Direct Stream/Proxy)
     */
    async proxyStream(inputUrl, reqHeaders, res) {
        console.log(`[Proxy] Start Request: ${inputUrl.substring(0, 100)}...`);
        console.log(`[Proxy] Incoming Range: ${reqHeaders.range || 'none'}`);

        try {
            const headers = {};
            if (reqHeaders.range) {
                headers['Range'] = reqHeaders.range;
            }
            headers['User-Agent'] = reqHeaders['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

            const response = await axios({
                method: 'get',
                url: inputUrl,
                headers,
                responseType: 'stream',
                timeout: 30000,
                validateStatus: null,
                maxRedirects: 5,
                decompress: false
            });

            if (response.status >= 400) {
                console.error(`[Proxy] Upstream Error: ${response.status} ${response.statusText}`);
                res.status(response.status).send(`Upstream server error: ${response.status}`);
                return;
            }

            res.status(response.status);
            const importantHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
            importantHeaders.forEach(h => {
                if (response.headers[h]) res.setHeader(h, response.headers[h]);
            });

            if (!res.getHeader('Accept-Ranges')) {
                res.setHeader('Accept-Ranges', 'bytes');
            }

            response.data.pipe(res);
            res.on('close', () => {
                if (response.data && response.data.destroy) response.data.destroy();
            });
            response.data.on('error', (err) => {
                console.error('[Proxy] Stream data error:', err.message);
                res.end();
            });
        } catch (err) {
            console.error('[Proxy] Stream error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: '代理流访问失败' });
            }
        }
    }

    async getMediaInfo(url, headers = {}) {
        return new Promise((resolve, reject) => {
            ffmpeg(url)
                .inputOptions(Object.entries(headers).flatMap(([k, v]) => ['-headers', `${k}: ${v}`]))
                .ffprobe((err, data) => {
                    if (err) return reject(err);
                    const stream = data.streams.find(s => s.codec_type === 'video');
                    const audio = data.streams.find(s => s.codec_type === 'audio');
                    resolve({
                        duration: parseFloat(data.format.duration) || 0,
                        videoCodec: stream ? stream.codec_name : '',
                        audioCodec: audio ? audio.codec_name : '',
                        format: data.format.format_name,
                        width: stream ? stream.width : 0,
                        height: stream ? stream.height : 0
                    });
                });
        });
    }

    generateVodPlaylist(duration) {
        let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-PLAYLIST-TYPE:VOD\n';
        const count = Math.ceil(duration / this.segmentDuration);
        for (let i = 0; i < count; i++) {
            const actualDuration = (i === count - 1) ? (duration % this.segmentDuration || this.segmentDuration) : this.segmentDuration;
            playlist += `#EXTINF:${actualDuration.toFixed(3)},\nsegment${i}.ts\n`;
        }
        playlist += '#EXT-X-ENDLIST\n';
        return playlist;
    }

    async startTranscode(inputUrl, options = {}) {
        const { quality = 'medium', hwaccel = 'none', headers = {} } = options;
        const sessionId = crypto.createHash('md5').update(inputUrl + quality + hwaccel).digest('hex').slice(0, 12);

        if (this.activeSessions.has(sessionId)) {
            const session = this.activeSessions.get(sessionId);
            session.lastAccess = Date.now();
            return {
                sessionId,
                playMethod: session.playMethod,
                playUrl: session.playMethod === 'proxy'
                    ? `/api/plugins/video/api/transcode/${sessionId}/stream`
                    : `/api/plugins/video/api/transcode/${sessionId}/playlist.m3u8`,
                duration: session.videoDuration
            };
        }

        const outputDir = path.join(this.cacheDir, sessionId);
        if (fsSync.existsSync(outputDir)) {
            try { await fs.rm(outputDir, { recursive: true, force: true }); } catch (e) { }
        }
        await fs.mkdir(outputDir, { recursive: true });

        let mediaInfo = options.mediaInfo;
        if (!mediaInfo) {
            try {
                mediaInfo = await this.getMediaInfo(inputUrl, headers);
            } catch (err) {
                mediaInfo = { duration: 7200, videoCodec: 'h264' };
            }
        }

        const vCodec = (mediaInfo.videoCodec || '').toLowerCase();
        const aCodec = (mediaInfo.audioCodec || '').toLowerCase();
        const videoDuration = mediaInfo.duration;
        const segmentCount = Math.ceil(videoDuration / this.segmentDuration);

        let playMethod = 'hls';
        let strategy = 'transcode';

        const isH264 = vCodec === 'h264' || vCodec === 'avc1';
        const isAudioCompatible = aCodec === 'aac' || aCodec === 'mp3' || !aCodec;
        const isMp4 = (mediaInfo.format || '').toLowerCase().includes('mp4') || inputUrl.toLowerCase().includes('.mp4');

        if (isH264 && isAudioCompatible && isMp4) {
            playMethod = 'proxy';
            strategy = 'none';
        } else if (isH264) {
            playMethod = 'hls';
            strategy = 'transmux';
        } else {
            playMethod = 'hls';
            strategy = 'transcode';
        }

        if (playMethod === 'hls') {
            const playlist = this.generateVodPlaylist(videoDuration);
            await fs.writeFile(path.join(outputDir, 'playlist.m3u8'), playlist);
        }

        this.activeSessions.set(sessionId, {
            outputDir, inputUrl, headers, videoDuration, mediaInfo, strategy, playMethod,
            segmentCount, startTime: Date.now(), lastAccess: Date.now(), quality, hwaccel,
            transcodeProc: null, transcodeStartSegment: -1, completedSegments: new Set(), pendingRequests: new Map()
        });

        return {
            sessionId, playMethod, duration: videoDuration,
            playUrl: playMethod === 'proxy'
                ? `/api/plugins/video/api/transcode/${sessionId}/stream`
                : `/api/plugins/video/api/transcode/${sessionId}/playlist.m3u8`
        };
    }

    async requestSegment(sessionId, segmentIndex) {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('会话不存在');
        session.lastAccess = Date.now();
        const segmentPath = path.join(session.outputDir, `segment${segmentIndex}.ts`);

        console.log(`[Transcode] Segment ${segmentIndex} requested for session ${sessionId}`);

        try {
            await fs.access(segmentPath);
            if ((await fs.stat(segmentPath)).size > 0) {
                session.completedSegments.add(segmentIndex);
                console.log(`[Transcode] Segment ${segmentIndex} already exists, returning immediately`);
                return segmentPath;
            }
        } catch (e) { }

        if (session.pendingRequests.has(segmentIndex)) {
            console.log(`[Transcode] Segment ${segmentIndex} already pending, waiting...`);
            return session.pendingRequests.get(segmentIndex);
        }

        const currentProgress = session.transcodeStartSegment;
        const needNewTranscode = !session.transcodeProc || segmentIndex < currentProgress || segmentIndex > currentProgress + 15;

        console.log(`[Transcode] Segment ${segmentIndex}: currentProgress=${currentProgress}, needNewTranscode=${needNewTranscode}, hasProc=${!!session.transcodeProc}`);

        if (needNewTranscode) {
            this._stopTranscodeProcess(session);
            this._startContinuousTranscode(session, segmentIndex);
        }

        const waitPromise = this._waitForSegment(session, segmentIndex, segmentPath);
        session.pendingRequests.set(segmentIndex, waitPromise);
        return waitPromise;
    }

    _waitForSegment(session, index, filePath, timeout = 90000) {
        console.log(`[Transcode] Waiting for segment ${index} at ${filePath}...`);
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = setInterval(async () => {
                if (fsSync.existsSync(filePath) && (await fs.stat(filePath)).size > 0) {
                    clearInterval(check);
                    session.completedSegments.add(index);
                    console.log(`[Transcode] Segment ${index} ready after ${Date.now() - start}ms`);
                    resolve(filePath);
                } else if (Date.now() - start > timeout) {
                    clearInterval(check);
                    console.error(`[Transcode] Segment ${index} TIMEOUT after ${timeout}ms!`);
                    reject(new Error(`Segment ${index} timeout`));
                }
            }, 500);
        });
    }

    _startContinuousTranscode(session, startSegment) {
        const startTime = startSegment * this.segmentDuration;
        session.transcodeStartSegment = startSegment;

        const args = [
            '-analyzeduration', '100000000', // 100M
            '-probesize', '100000000',       // 100M
            '-ss', startTime.toString(),
            '-i', session.inputUrl,
            '-y'
        ];

        if (session.strategy === 'transmux') {
            args.push('-c', 'copy');
        } else {
            // 💡 强制每隔 segment_time 秒插入关键帧，确保精确切分
            args.push(
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
                '-force_key_frames', `expr:gte(t,n_forced*${this.segmentDuration})`,
                '-c:a', 'aac', '-b:a', '128k'
            );
        }

        args.push(
            '-f', 'segment',
            '-segment_time', this.segmentDuration.toString(),
            '-segment_time_delta', '0.5',  // 允许 0.5 秒偏差
            '-segment_start_number', startSegment.toString(),
            '-segment_format', 'mpegts',
            // 不使用 -reset_timestamps，让 PTS 保持连续
            path.join(session.outputDir, 'segment%d.ts')
        );

        console.log(`[Transcode] Starting FFmpeg: ${this.ffmpegPath} ${args.join(' ')}`);
        session.transcodeProc = spawn(this.ffmpegPath, args);
        session.transcodeProc.stderr.on('data', (data) => {
            // 可选：解析进度
        });
        session.transcodeProc.on('close', () => {
            session.transcodeProc = null;
        });
    }

    _stopTranscodeProcess(session) {
        if (session.transcodeProc) {
            session.transcodeProc.kill('SIGKILL');
            session.transcodeProc = null;
        }
    }

    async getFileAsync(sessionId, filename) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        const filePath = path.join(session.outputDir, filename);
        if (fsSync.existsSync(filePath)) return filePath;
        return null;
    }

    async stopSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            console.log(`[Transcode] Stopping session ${sessionId} and clearing cache...`);
            this._stopTranscodeProcess(session);

            // 💡 物理删除对应的分片缓存目录
            const dir = session.outputDir;
            this.activeSessions.delete(sessionId);

            try {
                if (fsSync.existsSync(dir)) {
                    await fs.rm(dir, { recursive: true, force: true });
                    console.log(`[Transcode] Physics cache cleared for session: ${sessionId}`);
                }
            } catch (err) {
                console.warn(`[Transcode] Failed to delete cache dir ${dir}:`, err.message);
            }
        }
    }

    async cleanup() {
        const now = Date.now();
        const maxIdle = 300000; // 5 分钟空闲超时，避免播放时会话被清理
        for (const [id, session] of this.activeSessions) {
            if (now - session.lastAccess > maxIdle) {
                console.log(`[Transcode] Session ${id} idle too long, cleaning up...`);
                this.stopSession(id);
            }
        }
        try {
            const dirs = await fs.readdir(this.cacheDir);
            for (const dir of dirs) {
                const dirPath = path.join(this.cacheDir, dir);
                const stat = await fs.stat(dirPath);
                if (stat.isDirectory() && now - stat.mtimeMs > 3600000) {
                    if (!this.activeSessions.has(dir)) await fs.rm(dirPath, { recursive: true, force: true });
                }
            }
        } catch (e) { }
    }

    getSessionStatus(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        // 💡 主动扫描磁盘上已生成的分片文件，更新 completedSegments
        this._scanCompletedSegments(session);

        return {
            playMethod: session.playMethod,
            strategy: session.strategy,
            videoDuration: session.videoDuration,
            segmentCount: session.segmentCount,
            completedSegments: Array.from(session.completedSegments).sort((a, b) => a - b),
            maxContinuousSegment: this._getMaxContinuousSegment(session)
        };
    }

    _scanCompletedSegments(session) {
        // 扫描输出目录中所有的 .ts 分片文件
        try {
            const files = fsSync.readdirSync(session.outputDir);
            for (const file of files) {
                const match = file.match(/^segment(\d+)\.ts$/);
                if (match) {
                    const segmentIndex = parseInt(match[1], 10);
                    const filePath = path.join(session.outputDir, file);
                    try {
                        const stat = fsSync.statSync(filePath);
                        if (stat.size > 0) {
                            session.completedSegments.add(segmentIndex);
                        }
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.warn('[Transcode] Failed to scan segments:', e.message);
        }
    }

    _getMaxContinuousSegment(session) {
        const completed = Array.from(session.completedSegments).sort((a, b) => a - b);
        if (completed.length === 0) return -1;

        // 找到从 0 开始的最大连续分片索引
        let maxContinuous = -1;
        for (let i = 0; i < completed.length; i++) {
            if (completed[i] === i) {
                maxContinuous = i;
            } else {
                break;
            }
        }
        return maxContinuous;
    }
}

module.exports = new TranscodeService();
