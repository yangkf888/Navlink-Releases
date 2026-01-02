const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const fetch = require('node-fetch');
const { getSystemProxyAgent } = require('../utils/fetch-agent');

// ============================================
// 静态路由（必须放在动态路由 /:id 之前）
// ============================================

/**
 * 获取所有视频源
 * GET /api/sources
 * 如果启用了密码保护，未认证时过滤隐藏的视频源
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        let sources = db.all('SELECT * FROM video_sources ORDER BY sort_order ASC');

        // 检查是否需要过滤隐藏的视频源
        const adminPassword = req.headers['x-admin-password'];
        const enabledSetting = db.get("SELECT value FROM settings WHERE key = 'admin_password_enabled'");
        const passwordSetting = db.get("SELECT value FROM settings WHERE key = 'admin_password'");

        const isPasswordEnabled = enabledSetting?.value === 'true';
        const storedPassword = passwordSetting?.value || '';

        // 如果密码保护开启且密码不匹配，过滤掉隐藏的视频源
        if (isPasswordEnabled) {
            const isAuthorized = adminPassword === storedPassword;
            if (!isAuthorized) {
                sources = sources.filter(s => !s.hidden);
            }
        }

        res.json({ success: true, data: sources });
    } catch (error) {
        console.error('[sources] Failed to get sources:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 导出视频源
 * GET /api/sources/export
 */
router.get('/export', (req, res) => {
    try {
        const db = getDatabase();
        const sources = db.all('SELECT name, url, type, api_key, enabled, hidden, tags, remark, sort_order FROM video_sources ORDER BY sort_order ASC');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=video_sources.json');
        res.json({ success: true, data: sources, exportedAt: new Date().toISOString() });
    } catch (error) {
        console.error('[sources] Failed to export sources:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 辅助函数：同步视频源分类
 */
async function syncCategoriesForSource(db, source) {
    // 动态导入 CMS API 解析器
    const { CmsApiParser } = require('../services/CmsApiParser');
    // 获取代理设置
    const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
    const parser = new CmsApiParser(source.url, agent);

    console.log(`[sources] Syncing categories for source: ${source.name}`);
    const categories = await parser.getCategories();

    if (!categories || categories.length === 0) {
        return [];
    }

    // 清除旧分类
    db.run('DELETE FROM categories WHERE source_id = ?', [source.id]);

    // 插入新分类
    const stmt = db.prepare(`
        INSERT INTO categories (source_id, type_id, name, parent_id, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `);

    let sortOrder = 0;
    for (const cat of categories) {
        stmt.run([source.id, cat.type_id, cat.type_name, cat.type_pid || 0, sortOrder++]);
    }

    const savedCategories = db.all('SELECT * FROM categories WHERE source_id = ? ORDER BY sort_order', [source.id]);
    console.log(`[sources] Synced ${savedCategories.length} categories for source: ${source.name}`);
    return savedCategories;
}

/**
 * 添加视频源
 * POST /api/sources
 */
router.post('/', async (req, res) => {
    try {
        const { name, url, type = 'cms_api', api_key, enabled = true, hidden = false, tags = '', remark = '', sort_order = 0 } = req.body;

        if (!name || !url) {
            return res.status(400).json({ success: false, error: 'Name and URL are required' });
        }

        const db = getDatabase();
        const result = db.run(
            `INSERT INTO video_sources (name, url, type, api_key, enabled, hidden, proxy_enabled, tags, remark, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, url, type, api_key || null, enabled ? 1 : 0, hidden ? 1 : 0, req.body.proxy_enabled ? 1 : 0, tags, remark, sort_order]
        );

        const newSource = db.get('SELECT * FROM video_sources WHERE id = ?', [result.lastID]);

        // 自动同步分类
        try {
            await syncCategoriesForSource(db, newSource);
        } catch (syncError) {
            console.warn(`[sources] Failed to auto-sync categories for new source ${newSource.name}:`, syncError.message);
            // 不中断，仅记录错误
        }

        res.json({ success: true, data: newSource });
    } catch (error) {
        console.error('[sources] Failed to create source:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ... (keep batch-test, batch-update, batch-delete, import routes as is)

/**
 * 批量测速
 * POST /api/sources/batch-test
 */
router.post('/batch-test', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'IDs are required' });
        }

        const db = getDatabase();
        const results = [];

        for (const id of ids) {
            const source = db.get('SELECT * FROM video_sources WHERE id = ?', [id]);
            if (!source) continue;

            const startTime = Date.now();
            try {
                // 如果启用了代理，获取代理 Agent
                const agent = source.proxy_enabled ? getSystemProxyAgent() : null;

                const response = await fetch(source.url + '?ac=list&pg=1', {
                    method: 'GET',
                    timeout: 10000,
                    agent
                });
                const responseTime = Date.now() - startTime;

                if (response.ok) {
                    db.run(
                        'UPDATE video_sources SET response_time = ?, last_test_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [responseTime, id]
                    );
                    results.push({ id, success: true, responseTime });
                } else {
                    results.push({ id, success: false, error: `HTTP ${response.status}`, responseTime });
                }
            } catch (fetchError) {
                const responseTime = Date.now() - startTime;
                results.push({ id, success: false, error: fetchError.message, responseTime });
            }
        }

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[sources] Failed to batch test:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量更新状态
 * POST /api/sources/batch-update
 */
router.post('/batch-update', (req, res) => {
    try {
        const { ids, updates } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'IDs are required' });
        }

        const db = getDatabase();
        const updateFields = [];
        const params = [];

        if (updates.enabled !== undefined) { updateFields.push('enabled = ?'); params.push(updates.enabled ? 1 : 0); }
        if (updates.hidden !== undefined) { updateFields.push('hidden = ?'); params.push(updates.hidden ? 1 : 0); }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        for (const id of ids) {
            db.run(
                `UPDATE video_sources SET ${updateFields.join(', ')} WHERE id = ?`,
                [...params, id]
            );
        }

        const sources = db.all('SELECT * FROM video_sources ORDER BY sort_order ASC');
        res.json({ success: true, data: sources });
    } catch (error) {
        console.error('[sources] Failed to batch update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量删除
 * POST /api/sources/batch-delete
 */
router.post('/batch-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'IDs are required' });
        }

        const db = getDatabase();
        for (const id of ids) {
            db.run('DELETE FROM video_sources WHERE id = ?', [id]);
        }

        res.json({ success: true, message: `Deleted ${ids.length} sources` });
    } catch (error) {
        console.error('[sources] Failed to batch delete:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 导入视频源
 * POST /api/sources/import
 */
router.post('/import', (req, res) => {
    try {
        const { sources, mode = 'append' } = req.body;
        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            return res.status(400).json({ success: false, error: 'Sources array is required' });
        }

        const db = getDatabase();

        // 如果是替换模式，先清空
        if (mode === 'replace') {
            db.run('DELETE FROM video_sources');
        }

        const stmt = db.prepare(`
            INSERT INTO video_sources (name, url, type, api_key, enabled, hidden, proxy_enabled, tags, remark, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let imported = 0;
        for (const source of sources) {
            try {
                stmt.run([
                    source.name,
                    source.url,
                    source.type || 'cms_api',
                    source.api_key || null,
                    source.enabled !== undefined ? (source.enabled ? 1 : 0) : 1,
                    source.hidden !== undefined ? (source.hidden ? 1 : 0) : 0,
                    source.proxy_enabled !== undefined ? (source.proxy_enabled ? 1 : 0) : 0,
                    source.tags || '',
                    source.remark || '',
                    source.sort_order || 0
                ]);
                imported++;
            } catch (err) {
                console.warn(`[sources] Failed to import source ${source.name}:`, err.message);
            }
        }

        const allSources = db.all('SELECT * FROM video_sources ORDER BY sort_order ASC');
        res.json({ success: true, data: allSources, imported });
    } catch (error) {
        console.error('[sources] Failed to import sources:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// 动态路由（使用 :id 参数，必须放在静态路由之后）
// ============================================

/**
 * 获取单个视频源
 * GET /api/sources/:id
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const source = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);
        if (!source) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }
        res.json({ success: true, data: source });
    } catch (error) {
        console.error('[sources] Failed to get source:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新视频源
 * PUT /api/sources/:id
 */
router.put('/:id', (req, res) => {
    try {
        const { name, url, type, api_key, enabled, hidden, proxy_enabled, tags, remark, sort_order, response_time, last_test_at } = req.body;
        const db = getDatabase();

        // 检查是否存在
        const existing = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        // 构建更新语句
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (url !== undefined) { updates.push('url = ?'); params.push(url); }
        if (type !== undefined) { updates.push('type = ?'); params.push(type); }
        if (api_key !== undefined) { updates.push('api_key = ?'); params.push(api_key); }
        if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
        if (hidden !== undefined) { updates.push('hidden = ?'); params.push(hidden ? 1 : 0); }
        if (proxy_enabled !== undefined) { updates.push('proxy_enabled = ?'); params.push(proxy_enabled ? 1 : 0); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
        if (remark !== undefined) { updates.push('remark = ?'); params.push(remark); }
        if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
        if (response_time !== undefined) { updates.push('response_time = ?'); params.push(response_time); }
        if (last_test_at !== undefined) { updates.push('last_test_at = ?'); params.push(last_test_at); }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        db.run(
            `UPDATE video_sources SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const updated = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('[sources] Failed to update source:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除视频源
 * DELETE /api/sources/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();

        // 检查是否存在
        const existing = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        db.run('DELETE FROM video_sources WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Source deleted' });
    } catch (error) {
        console.error('[sources] Failed to delete source:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 同步视频源分类
 * POST /api/sources/:id/sync
 */
router.post('/:id/sync', async (req, res) => {
    try {
        const db = getDatabase();
        const source = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        const savedCategories = await syncCategoriesForSource(db, source);
        res.json({ success: true, data: savedCategories });
    } catch (error) {
        console.error('[sources] Failed to sync categories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 测速单个视频源
 * POST /api/sources/:id/test
 */
router.post('/:id/test', async (req, res) => {
    try {
        const db = getDatabase();
        const source = db.get('SELECT * FROM video_sources WHERE id = ?', [req.params.id]);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        const startTime = Date.now();
        try {
            // 获取代理设置
            const agent = source.proxy_enabled ? getSystemProxyAgent() : null;

            const response = await fetch(source.url + '?ac=list&pg=1', {
                method: 'GET',
                timeout: 10000,
                agent
            });
            const responseTime = Date.now() - startTime;

            if (response.ok) {
                // 更新响应时间
                db.run(
                    'UPDATE video_sources SET response_time = ?, last_test_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [responseTime, source.id]
                );

                const updated = db.get('SELECT * FROM video_sources WHERE id = ?', [source.id]);
                res.json({ success: true, data: updated, responseTime });
            } else {
                res.json({ success: false, error: `HTTP ${response.status}`, responseTime });
            }
        } catch (fetchError) {
            const responseTime = Date.now() - startTime;
            res.json({ success: false, error: fetchError.message, responseTime });
        }
    } catch (error) {
        console.error('[sources] Failed to test source:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
