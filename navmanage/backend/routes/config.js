import express from 'express';
import { dbGet, dbRun } from '../services/Database.js';
import { authenticateToken } from '../server.js';

const router = express.Router();

// 获取系统配置
router.get('/', authenticateToken, async (req, res) => {
    try {
        const domain = await dbGet('SELECT value FROM settings WHERE key = ?', ['registry_domain']);
        res.json({
            registryDomain: domain?.value || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 保存系统配置
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { registryDomain } = req.body;

        // 简单的 URL 格式验证
        if (registryDomain && !registryDomain.startsWith('http')) {
            return res.status(400).json({ error: '域名必须以 http:// 或 https:// 开头' });
        }

        // 使用 UPSERT 逻辑 (SQLite 支持 REPLACE INTO 或 INSERT OR REPLACE)
        await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['registry_domain', registryDomain || '']);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
