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
    const { url } = req.query;
    console.log(`[Proxy] HLS request: ${req.originalUrl}`);
    console.log(`[Proxy] Target URL: ${url}`);

    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    const useProxy = req.query.proxy === '1';
    const { getInsecureAgent, getSystemProxyAgent } = require('../utils/fetch-agent');

    // 尝试获取资源的主逻辑
    const fetchWithRetry = async (targetUrl, forceInsecure = false) => {
        const parsedUrl = new URL(targetUrl);
        let agent = useProxy ? getSystemProxyAgent() : null;

        // 如果强制使用不安全模式，或者之前的系统代理无效且是 https 请求
        if (forceInsecure && targetUrl.startsWith('https')) {
            agent = getInsecureAgent();
        }

        const fetchOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': parsedUrl.origin + '/',
                'Origin': parsedUrl.origin,
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            agent,
            timeout: 10000 // 10秒超时
        };

        try {
            console.log(`[Proxy] Fetching: ${targetUrl} (Proxy: ${useProxy})`);
            return await fetch(targetUrl, fetchOptions);
        } catch (error) {
            // 如果是因为证书或连接重置错误，且还没有尝试过不安全模式
            const isTlsError = error.message.includes('TLS') ||
                error.code === 'ECONNRESET' ||
                error.message.includes('certificate') ||
                error.message.includes('secure');

            if (!forceInsecure && isTlsError && targetUrl.startsWith('https')) {
                console.warn(`[Proxy] Normal fetch failed (${error.code || error.message}), retrying in insecure mode: ${targetUrl}`);
                return await fetchWithRetry(targetUrl, true);
            }
            throw error;
        }
    };

    try {
        const response = await fetchWithRetry(url);
        console.log(`[Proxy] Response status: ${response.status} for ${url}`);

        if (!response.ok) {
            console.error(`[Proxy] HLS fetch failed: ${response.status} ${response.statusText} for ${url}`);
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

        // 设置响应头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Cache-Control', 'no-cache');

        // 如果是 m3u8 文件，需要修改其中的路径
        if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
            let m3u8Content = await response.text();
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
            const parsedUrl = new URL(url);
            const queryParams = parsedUrl.search; // 获取请求参数 (?auth=...)

            // 辅助函数：获取完整 URL 并附加原有的查询参数（如果是相对路径）
            const getFullUrl = (relative) => {
                let full;
                if (relative.startsWith('http')) {
                    full = relative;
                } else if (relative.startsWith('/')) {
                    full = parsedUrl.origin + relative;
                } else {
                    full = baseUrl + relative;
                }

                // 如果原 URL 有查询参数，且生成的 URL 没有查询参数，且属于同源或相对路径，则附加参数
                // 简单策略：只要没有 ? 就补上原参数 (适配大多数 IPTV token 场景)
                if (queryParams && !full.includes('?')) {
                    full += queryParams;
                }
                return full;
            };

            const proxyUrlPrefix = `/api/plugins/video/api/proxy/hls?proxy=${useProxy ? '1' : '0'}&url=`;

            // 1. 处理 #EXT-X-KEY, #EXT-X-MAP 等标签中的 URI="..."
            m3u8Content = m3u8Content.replace(/URI="([^"]+)"/g, (match, p1) => {
                const full = getFullUrl(p1);
                return `URI="${proxyUrlPrefix}${encodeURIComponent(full)}"`;
            });

            // 2. 处理不以 # 开头的行（这通常是分片 ts 或子 m3u8 的路径）
            const lines = m3u8Content.split('\n');
            const processedLines = lines.map(line => {
                const trimmed = line.trim();
                // 如果行不为空且不以 # 开头
                if (trimmed && !trimmed.startsWith('#')) {
                    const full = getFullUrl(trimmed);
                    // 只有是 ts 或 m3u8 才代理（也可以全部代理以防万一）
                    return `${proxyUrlPrefix}${encodeURIComponent(full)}`;
                }
                return line;
            });

            res.send(processedLines.join('\n'));
        } else {
            // ts 文件直接转发
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        console.error('[Proxy] HLS critical failure:', error.message, 'URL:', url);
        res.status(500).send(`HLS Proxy Error: ${error.message}`);
    }
});

/**
 * 直播流式代理接口 (支持 FLV/MP4 等长连接流)
 * GET /api/proxy/stream?url=xxx
 */
router.get('/stream', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url');

    const parsedUrl = new URL(url);
    const isBilibili = url.includes('bilivideo.com') || url.includes('bilibili.com');
    const fetchOptions = {
        headers: {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': isBilibili ? 'https://live.bilibili.com/' : (parsedUrl.origin + '/'),
            'Origin': parsedUrl.origin
        }
    };

    try {
        const response = await fetch(url, fetchOptions);

        // 转发响应头
        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/x-flv');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 使用 pipe 转发流，避免内存占用
        response.body.pipe(res);

        req.on('close', () => {
            if (response.body.destroy) response.body.destroy();
        });
    } catch (error) {
        console.error('[Proxy] Stream failure:', error.message);
        res.status(500).send(error.message);
    }
});

module.exports = router;
