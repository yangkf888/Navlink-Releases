import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import dockerRoutes from './routes/docker.js';
import authRoutes from './routes/auth.js';
import { initDatabase } from './database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// 导出 init 方法供 Gateway 调用
export default {
    init: async (context) => {
        console.log('[docker] Initializing in-process plugin...');

        // 初始化数据库
        initDatabase();

        // 创建 Router
        const router = express.Router();

        // 中间件
        router.use(express.json());

        // 路由挂载
        // Gateway 挂载点: /api/plugins/docker

        // 认证路由
        router.use('/api/auth', authRoutes);

        // Docker 业务路由
        // 兼容 /api/apps/docker/api (旧代理路径) 和 /api (新路径)
        // 注意：前端请求 /api/apps/docker/api/servers -> Gateway rewrite -> /api/plugins/docker/api/servers
        // 所以我们需要匹配 /api/servers
        // 但旧代码有 app.use('/api/apps/docker/api', dockerRoutes);

        // 我们统一使用 /api 前缀
        router.use('/api', dockerRoutes);

        // 健康检查
        router.get('/api/health', (req, res) => {
            res.json({ status: 'healthy', service: 'docker', mode: 'in-process' });
        });

        console.log('[docker] In-process plugin initialized');
        return router;
    }
};