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
        try {
            console.log('[video] Initializing in-process plugin...');

            // 初始化数据库
            initDatabase();

            // Video 2.0: 启动后台探测队列服务
            try {
                const { scanQueueService } = require('./services/ScanQueueService');
                setTimeout(() => {
                    scanQueueService.start();
                    console.log('[video] Background scan queue started');
                }, 10000); // 延迟 10 秒启动，等待系统稳定
            } catch (queueError) {
                console.error('[video] Failed to load ScanQueueService:', queueError.stack);
            }

            // 创建 Router
            const router = express.Router();

            // 中间件
            router.use(express.json());

            // 健康检查
            router.get('/api/health', (req, res) => {
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
            router.use('/api/tv', require('./routes/tv'));
            router.use('/api/live', require('./routes/live'));
            router.use('/api/netdisk', require('./routes/netdisk'));
            router.use('/api/transcode', require('./routes/transcode'));

            console.log('[video] In-process plugin initialized successfully');
            return router;
        } catch (error) {
            console.error('[video] CRITICAL INITIALIZATION ERROR:', error.stack);
            throw error; // 重新抛出以通知 Gateway 加载失败
        }
    }
};
