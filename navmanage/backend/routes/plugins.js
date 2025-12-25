import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dbAll, dbGet, dbRun, dbInsert } from '../services/Database.js';
import { authenticateToken } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
    destination: path.join(__dirname, '../uploads'),
    filename: (req, file, cb) => {
        const pluginId = req.params.id || 'unknown';
        const version = req.body.version || '1.0.0';
        cb(null, `${pluginId}-${version}.zip`);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 获取所有插件
router.get('/', async (req, res) => {
    try {
        const plugins = await dbAll(`
            SELECT p.*, 
                   (SELECT version FROM plugin_versions WHERE plugin_id = p.id ORDER BY created_at DESC LIMIT 1) as latest_version,
                   (SELECT SUM(download_count) FROM plugin_versions WHERE plugin_id = p.id) as total_downloads
            FROM plugins p
            ORDER BY p.updated_at DESC
        `);
        res.json(plugins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个插件详情
router.get('/:id', async (req, res) => {
    try {
        const plugin = await dbGet('SELECT * FROM plugins WHERE id = ?', [req.params.id]);
        if (!plugin) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        const versions = await dbAll('SELECT * FROM plugin_versions WHERE plugin_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json({ ...plugin, versions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新插件
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id, name, description, author, category, icon, homepage } = req.body;

        if (!id || !name) {
            return res.status(400).json({ error: 'id and name are required' });
        }

        await dbRun(
            `INSERT INTO plugins (id, name, description, author, category, icon, homepage)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name, description || '', author || 'NavLink Team', category || 'Utility', icon || '📦', homepage || '']
        );

        res.json({ success: true, id });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Plugin ID already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// 更新插件信息
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, description, author, category, icon, homepage } = req.body;
        await dbRun(
            `UPDATE plugins 
             SET name = ?, description = ?, author = ?, category = ?, icon = ?, homepage = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, description, author, category, icon, homepage, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 上传新版本
router.post('/:id/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { version, changelog } = req.body;
        const pluginId = req.params.id;

        if (!version || !req.file) {
            return res.status(400).json({ error: 'version and file are required' });
        }

        // 检查插件是否存在
        const plugin = await dbGet('SELECT * FROM plugins WHERE id = ?', [pluginId]);
        if (!plugin) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        // 保存版本记录
        const filePath = req.file.path;
        const fileSize = req.file.size;

        // 删除旧版本记录(如果同版本存在)
        await dbRun('DELETE FROM plugin_versions WHERE plugin_id = ? AND version = ?', [pluginId, version]);

        await dbRun(
            `INSERT INTO plugin_versions (plugin_id, version, changelog, file_path, file_size)
             VALUES (?, ?, ?, ?, ?)`,
            [pluginId, version, changelog || '', filePath, fileSize]
        );

        // 更新插件的 updated_at
        await dbRun(`UPDATE plugins SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [pluginId]);

        res.json({ success: true, version, filePath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 下载插件
router.get('/:id/download/:version', async (req, res) => {
    try {
        const { id, version } = req.params;

        const versionInfo = await dbGet(
            'SELECT * FROM plugin_versions WHERE plugin_id = ? AND version = ?',
            [id, version]
        );

        if (!versionInfo) {
            return res.status(404).json({ error: 'Version not found' });
        }

        // 增加下载计数
        await dbRun(
            'UPDATE plugin_versions SET download_count = download_count + 1 WHERE plugin_id = ? AND version = ?',
            [id, version]
        );

        // 发送文件
        res.download(versionInfo.file_path, `${id}-${version}.zip`);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除插件
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // 获取所有版本的文件路径
        const versions = await dbAll('SELECT file_path FROM plugin_versions WHERE plugin_id = ?', [req.params.id]);

        // 删除文件
        for (const v of versions) {
            try {
                await fs.unlink(v.file_path);
            } catch (e) {
                console.warn('Failed to delete file:', v.file_path);
            }
        }

        // 删除数据库记录
        await dbRun('DELETE FROM plugin_versions WHERE plugin_id = ?', [req.params.id]);
        await dbRun('DELETE FROM plugins WHERE id = ?', [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
