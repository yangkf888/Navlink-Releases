/**
 * FFmpeg 转码路由
 * 提供 STRM 视频的实时转码服务
 */
const express = require('express');
const router = express.Router();
const transcodeService = require('../services/TranscodeService');
const path = require('path');
const os = require('os');
const ffmpegInstaller = require('../services/FfmpegInstaller');

/**
 * 安装 FFmpeg (自动下载)
 * POST /install
 */
router.post('/install', async (req, res) => {
    try {
        // 异步开始安装，不阻塞响应
        ffmpegInstaller.install().catch(err => {
            console.error('[Transcode] Install error:', err);
        });
        res.json({ success: true, message: 'Installation started' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 获取安装进度
 * GET /install/status
 */
router.get('/install/status', (req, res) => {
    res.json({ success: true, data: ffmpegInstaller.getStatus() });
});

/**
 * 检测 FFmpeg 可用性
 * GET /detect?path=/custom/path/to/ffmpeg
 */
router.get('/detect', async (req, res) => {
    try {
        const { path: customPath } = req.query;
        const result = await transcodeService.detectFFmpeg(customPath);

        if (result.available) {
            const hwaccel = await transcodeService.detectHwAccel();
            result.hwaccel = hwaccel;
        }

        // 增加操作系统平台信息，方便前端判断是否显示安装按钮
        result.platform = os.platform(); // 'linux', 'darwin', 'win32' 等

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('[Transcode] Detect error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 启动转码会话
 * POST /start
 * Body: { url: string, quality?: 'fast'|'medium'|'high', hwaccel?: 'none'|'nvenc'|'qsv'|'vaapi' }
 */
router.post('/start', async (req, res) => {
    const { url, quality = 'medium', hwaccel = 'none' } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: '缺少视频 URL' });
    }

    try {
        console.log(`[Transcode] Received start request for URL: ${url.substring(0, 80)}...`);
        const result = await transcodeService.startTranscode(url, { quality, hwaccel });

        res.json({
            success: true,
            data: {
                sessionId: result.sessionId,
                playlistUrl: result.playlistUrl
            }
        });
    } catch (err) {
        console.error('[Transcode] Start failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 获取活跃的转码会话列表
 * GET /sessions
 */
router.get('/sessions', (req, res) => {
    try {
        const sessions = transcodeService.getActiveSessions();
        res.json({ success: true, data: sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 获取转码文件 (m3u8 播放列表或 ts 分片)
 * GET /:sessionId/:filename
 */
router.get('/:sessionId/:filename', (req, res) => {
    const { sessionId, filename } = req.params;

    // 安全检查：防止路径遍历
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ success: false, error: '非法文件名' });
    }

    const filePath = transcodeService.getFile(sessionId, filename);

    if (!filePath) {
        return res.status(404).json({ success: false, error: '文件不存在或会话已过期' });
    }

    // 设置正确的 Content-Type
    if (filename.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store');
    } else if (filename.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'max-age=3600');
    }

    // 支持 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.sendFile(filePath);
});

/**
 * 停止转码会话
 * POST /:sessionId/stop
 */
router.post('/:sessionId/stop', (req, res) => {
    const { sessionId } = req.params;

    try {
        transcodeService.stopSession(sessionId);
        res.json({ success: true, message: '会话已停止' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 手动清理过期会话
 * POST /cleanup
 */
router.post('/cleanup', (req, res) => {
    try {
        transcodeService.cleanup(req.body.maxAgeMs);
        res.json({ success: true, message: '清理完成' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
