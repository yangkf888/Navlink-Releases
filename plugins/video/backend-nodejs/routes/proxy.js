/**
 * 代理请求 API - 解决跨域问题
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { getSystemProxyAgent } = require('../utils/fetch-agent');

/**
 * 通用代理接口
 * POST /api/proxy
 * Body: { url, method, headers, body }
 */
router.post('/', async (req, res) => {
    try {
        const { url, method = 'GET', headers = {}, body } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: '缺少 url 参数' });
        }

        const fetchOptions = {
            method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NavLink/1.0)',
                ...headers
            }
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

/**
 * 图片代理接口
 * GET /api/proxy/image?url=xxx
 */
router.get('/image', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).send('Missing url parameter');
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NavLink/1.0)',
                'Referer': new URL(url).origin
            }
        });

        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }

        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天

        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('[Proxy] Image fetch failed:', error);
        res.status(500).send('Failed to proxy image');
    }
});

/**
 * HLS 流代理接口
 * GET /api/proxy/hls?url=xxx
 * 代理 m3u8 和 ts 文件，解决 CORS 问题
 */
router.get('/hls', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).send('Missing url parameter');
        }

        const parsedUrl = new URL(url);

        // 如果开启了代理参数，获取代理 Agent
        const useProxy = req.query.proxy === '1';
        const agent = useProxy ? getSystemProxyAgent() : null;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': parsedUrl.origin + '/',
                'Origin': parsedUrl.origin,
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            agent
        });

        if (!response.ok) {
            console.error(`[Proxy] HLS fetch failed: ${response.status} ${response.statusText}`);
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

        // 设置响应头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Cache-Control', 'no-cache');

        // 如果是 m3u8 文件，需要修改其中的相对路径
        if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
            let m3u8Content = await response.text();

            // 将相对路径转换为代理路径
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

            // 替换相对路径的 ts 文件
            m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+\.ts.*)$/gm, (match) => {
                const tsUrl = match.startsWith('/')
                    ? parsedUrl.origin + match
                    : baseUrl + match;
                return `/api/plugins/video/api/proxy/hls?url=${encodeURIComponent(tsUrl)}${useProxy ? '&proxy=1' : ''}`;
            });

            // 替换相对路径的 m3u8 文件（多级播放列表）
            m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+\.m3u8.*)$/gm, (match) => {
                const subUrl = match.startsWith('/')
                    ? parsedUrl.origin + match
                    : baseUrl + match;
                return `/api/plugins/video/api/proxy/hls?url=${encodeURIComponent(subUrl)}${useProxy ? '&proxy=1' : ''}`;
            });

            // 替换绝对路径
            m3u8Content = m3u8Content.replace(/^(https?:\/\/.+)$/gm, (match) => {
                if (match.endsWith('.ts') || match.includes('.ts?') || match.endsWith('.m3u8') || match.includes('.m3u8?')) {
                    return `/api/plugins/video/api/proxy/hls?url=${encodeURIComponent(match)}${useProxy ? '&proxy=1' : ''}`;
                }
                return match;
            });

            res.send(m3u8Content);
        } else {
            // ts 文件直接转发
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        console.error('[Proxy] HLS fetch failed:', error);
        res.status(500).send('Failed to proxy HLS');
    }
});

module.exports = router;
