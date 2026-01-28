const express = require('express');
const http = require('http');
const path = require('path');
const { initDatabase } = require('./database');

const sourcesRoutes = require('./routes/sources');
const categoriesRoutes = require('./routes/categories');
const videosRoutes = require('./routes/videos');
const settingsRoutes = require('./routes/settings');
const proxyRoutes = require('./routes/proxy');
const favoritesRoutes = require('./routes/favorites');
const historyRoutes = require('./routes/history');
const multiSourceRoutes = require('./routes/multi-source');

async function startServer() {
    try {
        console.log('[videox] Initializing standalone backend...');

        // 初始化数据库
        initDatabase();

        // 启动后台扫描服务
        try {
            const { scanQueueService } = require('./services/ScanQueueService');
            setTimeout(() => {
                scanQueueService.start();
                console.log('[videox] Background scan queue started');
            }, 5000);
        } catch (queueError) {
            console.error('[videox] Failed to load ScanQueueService:', queueError.stack);
        }

        const app = express();
        const server = http.createServer(app);

        // 中间件
        app.use(express.json());

        // 跨域设置 (仅开发模式或根据需要配置)
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });

        // 健康检查
        app.get('/api/health', (req, res) => {
            res.json({ status: 'healthy', service: 'videox', mode: 'standalone' });
        });

        // API 路由 (直接挂载到 /api，不再经过 gateway 路径)
        app.use('/api/sources', sourcesRoutes);
        app.use('/api/categories', categoriesRoutes);
        app.use('/api/videos', videosRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/proxy', proxyRoutes);
        app.use('/api/favorites', favoritesRoutes);
        app.use('/api/history', historyRoutes);
        app.use('/api/multi-source', multiSourceRoutes);
        app.use('/api/home', require('./routes/home'));
        app.use('/api/tv', require('./routes/tv'));
        app.use('/api/live', require('./routes/live'));
        app.use('/api/netdisk', require('./routes/netdisk'));
        app.use('/api/transcode', require('./routes/transcode'));
        app.use('/api/media-servers', require('./routes/media-servers'));

        const PORT = 3100;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[videox] Standalone backend listening on port ${PORT}`);
        });

    } catch (error) {
        console.error('[videox] CRITICAL STARTUP ERROR:', error.stack);
        process.exit(1);
    }
}

// 启动
startServer();

