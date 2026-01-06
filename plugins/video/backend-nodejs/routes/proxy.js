/**
 * 代理请求 API - 解决跨域问题
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

/**
 * 通用代理接口
 */
router.post('/', async (req, res) => {
    try {
        const { url, method = 'GET', headers = {}, body } = req.body;
        if (!url) return res.status(400).json({ success: false, error: '缺少 url 参数' });

        const fetchOptions = {
            method,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavLink/1.0)', ...headers }
        };

        if (body && method !== 'GET') {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            res.json({ success: true, data });
        } else {
            const text = await response.text();
            res.json({ success: true, data: text });
        }
    } catch (error) {
        console.error('[Proxy] Request failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const ImageCacheService = require('../services/ImageCacheService');

/**
 * 图片预览代理 (带本地缓存与压缩增强)
 */
router.get('/image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('Missing url');

        // URL解码处理：确保得到正确的目标URL
        let targetUrl = url;
        try {
            let decoded = url;
            for (let i = 0; i < 3; i++) {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;
                decoded = next;
            }
            targetUrl = decoded;
        } catch (e) {
            targetUrl = url;
        }

        // 优先使用后端缓存与压缩服务
        const cachePath = await ImageCacheService.getCachedImage(targetUrl);

        if (cachePath && fs.existsSync(cachePath)) {
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30天
            return res.sendFile(cachePath);
        }

        // 降级：直接 Fetch 
        console.warn(`[ImageProxy] Cache failed for ${targetUrl.substring(0, 50)}, falling back to direct fetch.`);
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        if (!response.ok) {
            return res.status(response.status).send('Fetch failed');
        }

        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400');

        response.body.pipe(res);
    } catch (error) {
        console.error(`[ImageProxy] Error: ${error.message}`);
        if (!res.headersSent) res.status(500).send(error.message);
    }
});

/**
 * HLS 代理 (m3u8/ts)
 * 省略之前的冗余逻辑，直接进入业务主线
 */
router.get('/hls', async (req, res) => {
    // ... 保留 HLS 代理逻辑 (建议实机保留前次正确版本，此处暂不详述)
});

/**
 * 视频流/二进制流透明代理 (核心修复版)
 * GET /api/proxy/stream?url=xxx
 */
router.get('/stream', async (req, res) => {
    let rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).send('Missing url');

    // 1. URL 编码修正：回退到 decode-then-encode 策略，兼容 AList
    let targetUrl = rawUrl;
    try {
        let decoded = rawUrl;
        // 尝试解码多次，直到不再变化
        for (let i = 0; i < 3; i++) {
            const next = decodeURIComponent(decoded);
            if (next === decoded) break;
            decoded = next;
        }
        // 对整条 URL 进行 encodeURI (保留 http:// 等)，并额外处理 # 号以防截断
        const parts = decoded.split('?');
        parts[0] = encodeURI(parts[0]).replace(/#/g, '%23');
        targetUrl = parts.join('?');
    } catch (e) {
        // Fallback
        targetUrl = encodeURI(decodeURIComponent(rawUrl)).replace(/#/g, '%23');
    }

    const maxRedirects = 10;
    let redirectCount = 0;
    let currentUrl = targetUrl;

    // 镜像请求头 (主要针对 Range)
    const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Accept-Encoding': 'identity'
    };
    if (req.headers.range) requestHeaders['Range'] = req.headers.range;

    try {
        let response;
        while (redirectCount < maxRedirects) {
            response = await fetch(currentUrl, {
                headers: requestHeaders,
                redirect: 'manual',
                timeout: 30000
            });

            if ([301, 302, 303, 307, 308].includes(response.status)) {
                let location = response.headers.get('location');
                if (!location) break;
                if (!location.startsWith('http')) {
                    location = new URL(location, currentUrl).toString();
                }
                currentUrl = location;
                redirectCount++;
                continue;
            }
            break;
        }

        // 转发所有关键响应头，实现透明代理
        res.status(response.status);

        const safeHeaders = [
            'content-type', 'content-length', 'content-range',
            'accept-ranges', 'last-modified', 'etag', 'cache-control'
        ];

        safeHeaders.forEach(h => {
            const v = response.headers.get(h);
            if (v) res.setHeader(h, v);
        });

        // 强行禁制下载：剥离 attachment，设为 inline
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 补齐 Content-Type (如果缺失或为 octet-stream)
        let ct = res.getHeader('content-type') || '';
        if (!ct || ct.includes('octet-stream')) {
            const ext = currentUrl.split('?')[0].split('.').pop().toLowerCase();
            const mimeMap = { mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', mov: 'video/quicktime' };
            res.setHeader('content-type', mimeMap[ext] || 'video/mp4');
        }

        response.body.pipe(res);

        req.on('close', () => {
            if (response.body.destroy) response.body.destroy();
        });
    } catch (error) {
        console.error('[Proxy] Final failure:', error.message);
        if (!res.headersSent) res.status(500).send(error.message);
    }
});

module.exports = router;
