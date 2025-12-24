const express = require('express');
const { initDatabase } = require('./database');
const itemsRoutes = require('./routes/items');
const tagsRoutes = require('./routes/tags');
const configRoutes = require('./routes/config');
const searchRoutes = require('./routes/search');
const categoriesRoutes = require('./routes/categories');

// 导出 init 方法供 Gateway 调用
module.exports = {
    init: async (context) => {
        console.log('[kbrag] Initializing in-process plugin...');

        // 初始化数据库
        await initDatabase();

        // 创建 Router
        const router = express.Router();

        // 中间件
        router.use(express.json({ limit: '10mb' }));

        // 健康检查
        router.get('/api/health', (req, res) => {
            console.log('[kbrag] Health check called');
            res.json({ status: 'healthy', service: 'kbrag', mode: 'in-process' });
        });

        // 路由挂载
        router.use('/api/items', itemsRoutes);
        router.use('/api/tags', tagsRoutes);
        router.use('/api/config', configRoutes);
        router.use('/api/search', searchRoutes);
        router.use('/api/categories', categoriesRoutes);

        // 调试路由
        router.get('/debug', (req, res) => {
            console.log('[kbrag] Debug route called');
            res.json({ message: 'kbrag plugin debug route working' });
        });

        console.log('[kbrag] In-process plugin initialized');
        return router;
    }
};
