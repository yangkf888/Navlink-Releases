import express from 'express';
import { dbAll, dbGet } from '../services/Database.js';

const router = express.Router();

// 生成 registry.json (公开 API，供 NavLink 使用)
router.get('/registry.json', async (req, res) => {
    try {
        // 优先使用配置的域名，否则回退到 BASE_URL 或请求 Host
        // 优先使用配置的域名，否则回退到 BASE_URL 或请求 Host
        const config = await dbGet('SELECT value FROM settings WHERE key = ?', ['registry_domain']);
        let baseUrl = config?.value || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        // 确保没有尾部斜杠
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        // 确保有协议 (如果配置里漏了)
        if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;

        const plugins = await dbAll(`
            SELECT p.*, 
                   pv.version as latest_version,
                   pv.changelog as latest_changelog
            FROM plugins p
            LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
            WHERE pv.version = (
                SELECT version FROM plugin_versions 
                WHERE plugin_id = p.id 
                ORDER BY created_at DESC LIMIT 1
            )
            ORDER BY p.name
        `);

        const registry = {
            plugins: plugins.map(p => ({
                id: p.id,
                name: p.name,
                version: p.latest_version || '1.0.0',
                description: p.description,
                author: p.author,
                category: p.category,
                icon: p.icon,
                homepage: p.homepage,
                downloadUrl: `${baseUrl}/api/plugins/${p.id}/download/${p.latest_version || '1.0.0'}`,
                changelog: p.latest_changelog
            }))
        };

        res.json(registry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
