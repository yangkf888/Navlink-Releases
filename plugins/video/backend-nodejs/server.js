const express = require('express');

const { initDatabase } = require('./database');
const sourcesRoutes = require('./routes/sources');
const categoriesRoutes = require('./routes/categories');
const videosRoutes = require('./routes/videos');
const settingsRoutes = require('./routes/settings');
const proxyRoutes = require('./routes/proxy');
const favoritesRoutes = require('./routes/favorites');
const historyRoutes = require('./routes/history');
const multiSourceRoutes = require('./routes/multi-source');

// 导出 init 方法供 Gateway 调用
module.exports = {
    init: async (context) => {
        console.log('[video] Initializing in-process plugin...');

        // 初始化数据库
        initDatabase();

        // 创建 Router
        const router = express.Router();

        // 中间件
        router.use(express.json());

        // 健康检查
        router.get('/api/health', (req, res) => {
            console.log('[video] Health check called');
            res.json({ status: 'healthy', service: 'video', mode: 'in-process' });
        });

        // API 路由
        router.use('/api/sources', sourcesRoutes);
        router.use('/api/categories', categoriesRoutes);
        router.use('/api/videos', videosRoutes);
        router.use('/api/settings', settingsRoutes);
        router.use('/api/proxy', proxyRoutes);
        router.use('/api/favorites', favoritesRoutes);
        router.use('/api/history', historyRoutes);
        router.use('/api/multi-source', multiSourceRoutes);
        router.use('/api/home', require('./routes/home'));

        // 启动时触发首页数据刷新（异步，延迟5秒执行）
        setTimeout(() => {
            console.log('[video] Triggering initial home data refresh...');
            require('./services/HomeService').refreshAll().catch(e => {
                console.error('[video] Initial home refresh failed:', e.message);
            });
        }, 5000);

        // 调试路由
        router.get('/debug', (req, res) => {
            console.log('[video] Debug route called');
            res.json({ message: 'Video plugin debug route working' });
        });

        console.log('[video] In-process plugin initialized');
        return router;
    }
};
