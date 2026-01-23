const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 3100;

// =============================================================================
// 中间件配置
// =============================================================================

// CORS 配置
app.use(cors({
    origin: true, // 允许所有来源（开发环境）
    credentials: true
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 静态文件服务（生产环境：服务前端构建产物）
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

// =============================================================================
// API 路由
// =============================================================================

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'videox',
        mode: 'standalone',
        version: '1.0.0'
    });
});

// 业务路由
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

// =============================================================================
// SPA Fallback - 所有非 API 请求返回 index.html
// =============================================================================
app.get('*', (req, res) => {
    // 排除 API 请求
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

// =============================================================================
// 启动服务
// =============================================================================
async function startServer() {
    try {
        console.log('[VideoX] Initializing...');

        // 初始化数据库
        initDatabase();
        console.log('[VideoX] Database initialized');

        // 启动后台扫描队列服务
        try {
            const { scanQueueService } = require('./services/ScanQueueService');
            setTimeout(() => {
                scanQueueService.start();
                console.log('[VideoX] Background scan queue started');
            }, 5000); // 延迟 5 秒启动
        } catch (queueError) {
            console.error('[VideoX] Failed to load ScanQueueService:', queueError.message);
        }

        // 启动 HTTP 服务器
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`[VideoX] Server running at http://localhost:${PORT}`);
            console.log(`[VideoX] API endpoint: http://localhost:${PORT}/api`);
            console.log('='.repeat(50));
        });

    } catch (error) {
        console.error('[VideoX] Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
