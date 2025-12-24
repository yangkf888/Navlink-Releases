const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

/**
 * 获取所有分类
 * GET /api/categories
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, created_at').all();

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('[kbrag] Get categories error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建分类
 * POST /api/categories
 */
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { name, color } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: '分类名称不能为空' });
        }

        const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        // 获取最大排序值
        const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories').get();
        const sortOrder = (maxOrder?.max || 0) + 1;

        db.prepare(`
            INSERT INTO categories (id, name, color, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, name.trim(), color || '#3B82F6', sortOrder, now);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

        res.json({ success: true, data: category });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ success: false, error: '分类名称已存在' });
        }
        console.error('[kbrag] Create category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新分类
 * PUT /api/categories/:id
 */
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { name, color, sort_order } = req.body;

        const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: '分类不存在' });
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }
        if (sort_order !== undefined) {
            updates.push('sort_order = ?');
            values.push(sort_order);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: '没有要更新的字段' });
        }

        values.push(id);
        db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        res.json({ success: true, data: category });
    } catch (error) {
        console.error('[kbrag] Update category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除分类
 * DELETE /api/categories/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;

        const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: '分类不存在' });
        }

        // 将该分类下的知识条目的分类设为空
        db.prepare("UPDATE knowledge_items SET category = '' WHERE category = ?").run(existing.name);

        db.prepare('DELETE FROM categories WHERE id = ?').run(id);

        res.json({ success: true });
    } catch (error) {
        console.error('[kbrag] Delete category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
