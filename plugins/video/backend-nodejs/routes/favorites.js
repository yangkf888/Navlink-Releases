/**
 * 收藏管理 API
 * GET /api/favorites - 获取收藏列表
 * POST /api/favorites - 添加收藏
 * DELETE /api/favorites/:id - 删除收藏
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

/**
 * 获取收藏列表
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        const favorites = db.prepare(`
            SELECT f.*, s.name as source_name
            FROM favorites f
            LEFT JOIN video_sources s ON f.source_id = s.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `).all(userId);

        res.json({ success: true, data: favorites });
    } catch (error) {
        console.error('[Favorites] Get list failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 检查是否已收藏
 */
router.get('/check', (req, res) => {
    try {
        const { source_id, vod_id } = req.query;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        const favorite = db.prepare(`
            SELECT id FROM favorites 
            WHERE user_id = ? AND source_id = ? AND vod_id = ?
        `).get(userId, source_id, vod_id);

        res.json({ success: true, data: { isFavorite: !!favorite } });
    } catch (error) {
        console.error('[Favorites] Check failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 添加收藏
 */
router.post('/', (req, res) => {
    try {
        const { source_id, vod_id, title, cover, year } = req.body;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        // 检查是否已存在
        const existing = db.prepare(`
            SELECT id FROM favorites 
            WHERE user_id = ? AND source_id = ? AND vod_id = ?
        `).get(userId, source_id, vod_id);

        if (existing) {
            return res.json({ success: true, data: { id: existing.id }, message: '已收藏' });
        }

        const result = db.prepare(`
            INSERT INTO favorites (user_id, source_id, vod_id, title, cover, year)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, source_id, vod_id, title, cover, year);

        res.json({ success: true, data: { id: result.lastInsertRowid } });
    } catch (error) {
        console.error('[Favorites] Add failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除收藏
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(id, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[Favorites] Delete failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 按 source_id 和 vod_id 删除收藏
 */
router.delete('/', (req, res) => {
    try {
        const { source_id, vod_id } = req.query;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        db.prepare(`
            DELETE FROM favorites 
            WHERE user_id = ? AND source_id = ? AND vod_id = ?
        `).run(userId, source_id, vod_id);

        res.json({ success: true });
    } catch (error) {
        console.error('[Favorites] Delete by vod_id failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
