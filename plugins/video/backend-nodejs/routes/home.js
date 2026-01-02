const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const homeService = require('../services/HomeService');

/**
 * GET /api/home
 * 获取首页所有缓存数据
 */
/**
 * GET /api/home
 * 获取首页所有缓存数据（支持流式增量更新）
 */
router.get('/', async (req, res) => {
    const { stream } = req.query;

    try {
        const db = getDatabase();
        const rows = db.prepare('SELECT key, data FROM home_cache').all();

        const result = {};
        rows.forEach(row => {
            const key = row.key;
            let data = [];
            try { data = JSON.parse(row.data); } catch (e) { }

            if (key === 'home_hot') {
                result.hot = data;
            } else if (key.startsWith('home_')) {
                const parts = key.split('_');
                const section = parts[1];
                const sub = parts[2];
                if (!result[section]) result[section] = {};
                result[section][sub] = data;
            }
        });

        if (stream === 'true' || stream === '1') {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            if (typeof res.flushHeaders === 'function') res.flushHeaders();

            // 1. 发送现有缓存内容
            res.write(`data: ${JSON.stringify({ type: 'cache', data: result })}\n\n`);
            if (typeof res.flush === 'function') res.flush();

            // 2. 触发刷新并流式推送更新
            homeService.refreshAll((section, sub, data) => {
                const update = { type: 'update', section, sub, data };
                res.write(`data: ${JSON.stringify(update)}\n\n`);
                if (typeof res.flush === 'function') res.flush();
            }).then(() => {
                res.write('data: [DONE]\n\n');
                if (typeof res.flush === 'function') res.flush();
                res.end();
            }).catch(err => {
                console.error('[Home/Stream] Refresh failed:', err);
                res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
                res.end();
            });
            return;
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Home] Failed to get home data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/home/refresh
 * 手动触发刷新
 */
router.post('/refresh', async (req, res) => {
    try {
        // 异步执行，不阻塞响应
        homeService.refreshAll().catch(e => console.error(e));
        res.json({ success: true, message: 'Refresh started in background' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
