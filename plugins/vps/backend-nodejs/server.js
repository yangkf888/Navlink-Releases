const express = require('express');
const { initDatabase } = require('./database');
const vpsRoutes = require('./routes/index');
const websocket = require('./websocket');

module.exports = {
    init: async (context) => {
        console.log('[VPS] Initializing in-process plugin...');

        // Clear websocket.js module cache to ensure latest code is loaded
        const websocketPath = require.resolve('./websocket.js');
        delete require.cache[websocketPath];
        console.log('[VPS] Cleared module cache for websocket.js');

        // 初始化数据库
        try {
            initDatabase();
        } catch (error) {
            console.error('[VPS] Database initialization failed:', error);
            throw error;
        }

        const router = express.Router();

        router.use(express.json());

        // 挂载核心业务路由
        // Frontend expects: /api/apps/vps/api/... (proxy rewrites to /api/plugins/vps/api/...)
        // So we mount at /api (relative to plugin base)
        router.use('/api', vpsRoutes);

        router.get('/health', (req, res) => {
            res.json({ status: 'healthy', service: 'vps', mode: 'in-process' });
        });

        console.log('[VPS] Plugin initialized successfully');

        // Expose WebSocket Upgrade Handler
        router.handleUpgrade = websocket.handleUpgrade;

        return router;
    }
};
