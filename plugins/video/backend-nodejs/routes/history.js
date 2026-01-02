/**
 * 播放历史 API
 * GET /api/history - 获取播放历史
 * POST /api/history - 更新播放进度
 * DELETE /api/history - 清空历史
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

/**
 * 获取播放历史
 */
router.get('/', (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        const history = db.prepare(`
            SELECT h.*, s.name as source_name
            FROM play_history h
            LEFT JOIN video_sources s ON h.source_id = s.id
            WHERE h.user_id = ?
            ORDER BY h.updated_at DESC
            LIMIT ?
        `).all(userId, parseInt(limit));

        res.json({ success: true, data: history });
    } catch (error) {
        console.error('[History] Get list failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新播放进度
 */
router.post('/', (req, res) => {
    try {
        const { source_id, vod_id, title, cover, episode, episode_name, progress, duration } = req.body;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        // 检查是否已存在
        const existing = db.prepare(`
            SELECT id FROM play_history 
            WHERE user_id = ? AND source_id = ? AND vod_id = ?
        `).get(userId, source_id, vod_id);

        if (existing) {
            // 更新记录
            db.prepare(`
                UPDATE play_history 
                SET title = ?, cover = ?, episode = ?, episode_name = ?, 
                    progress = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(title, cover, episode, episode_name, progress, duration, existing.id);

            res.json({ success: true, data: { id: existing.id } });
        } else {
            // 新增记录
            const result = db.prepare(`
                INSERT INTO play_history 
                (user_id, source_id, vod_id, title, cover, episode, episode_name, progress, duration)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, source_id, vod_id, title, cover, episode, episode_name, progress, duration);

            res.json({ success: true, data: { id: result.lastInsertRowid } });
        }
    } catch (error) {
        console.error('[History] Update failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除单条记录
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        db.prepare('DELETE FROM play_history WHERE id = ? AND user_id = ?').run(id, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[History] Delete failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 清空所有历史
 */
router.delete('/', (req, res) => {
    try {
        const db = getDb();
        const userId = req.headers['x-nav-user-id'] || '0';

        db.prepare('DELETE FROM play_history WHERE user_id = ?').run(userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[History] Clear failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
