import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Routes
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/licenses.js';
import pluginRoutes from './routes/plugins.js';
import registryRoutes from './routes/registry.js';
import activationRoutes from './routes/activation.js';
import configRoutes from './routes/config.js';

// Database
import { initDatabase } from './services/Database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;

// 配置
const JWT_SECRET = process.env.JWT_SECRET || 'navmanage-secret-key-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件 (前端构建产物) - 挂载到 /manage
app.use('/manage', express.static(path.join(__dirname, '../frontend/dist')));

// 认证中间件
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// 导出配置供路由使用
export { JWT_SECRET, ADMIN_PASSWORD };

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/plugins', pluginRoutes);
app.use('/api/activation', activationRoutes);
app.use('/api/config', configRoutes);
app.use('/api', registryRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路径返回 404 页面
app.get('/', (req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 Not Found</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; background-color: #f3f4f6; color: #374151; }
                h1 { font-size: 6rem; font-weight: 900; margin: 0; color: #d1d5db; }
                p { font-size: 1.5rem; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div style="text-align: center;">
                <h1>404</h1>
                <p>Page Not Found</p>
            </div>
        </body>
        </html>
    `);
});

// SPA 回退 (仅针对 /manage 下的路径)
app.get('/manage/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 可选：如果用户访问 /manage 但没有斜杠，重定向到 /manage/
app.get('/manage', (req, res) => {
    res.redirect('/manage/');
});

// 启动服务
async function start() {
    try {
        // 初始化数据库
        await initDatabase();
        console.log('[NavManage] Database initialized');

        app.listen(PORT, () => {
            console.log(`[NavManage] Server running on port ${PORT}`);
            console.log(`[NavManage] Admin password: ${ADMIN_PASSWORD === 'admin123' ? 'Using default (change in production!)' : 'Custom'}`);
        });
    } catch (error) {
        console.error('[NavManage] Failed to start:', error);
        process.exit(1);
    }
}

start();
