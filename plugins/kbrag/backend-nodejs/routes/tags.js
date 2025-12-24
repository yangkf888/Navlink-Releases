const express = require('express');
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * 获取所有标签
 * GET /api/tags
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
        res.json({ success: true, data: tags });
    } catch (error) {
        console.error('[kbrag] Get tags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建标签
 * POST /api/tags
 */
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { name, color = '#3B82F6' } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
            .run(id, name, color, now);

        res.json({ success: true, data: { id, name, color, created_at: now } });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ success: false, error: 'Tag already exists' });
        }
        console.error('[kbrag] Create tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新标签
 * PUT /api/tags/:id
 */
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { name, color } = req.body;

        const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Tag not found' });
        }

        db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
            .run(name ?? existing.name, color ?? existing.color, id);

        res.json({ success: true });
    } catch (error) {
        console.error('[kbrag] Update tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除标签
 * DELETE /api/tags/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;

        // 获取标签名称
        const tag = db.prepare('SELECT name FROM tags WHERE id = ?').get(id);
        if (!tag) {
            return res.status(404).json({ success: false, error: 'Tag not found' });
        }

        // 删除标签
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);

        // 从知识条目中移除该标签 (更新 JSON 数组)
        // 注意: SQLite 不能直接操作 JSON 数组，需要在应用层处理
        // 这里简化处理，实际可能需要遍历更新

        res.json({ success: true });
    } catch (error) {
        console.error('[kbrag] Delete tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
