const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const { getSystemProxyAgent } = require('../utils/fetch-agent');

/**
 * 获取视频列表
 * GET /api/videos
 * Query: source_id, category_id, page, limit
 */
router.get('/', async (req, res) => {
    try {
        const { source_id, category_id, page = 1, limit = 20 } = req.query;

        if (!source_id) {
            return res.status(400).json({ success: false, error: 'source_id is required' });
        }

        const db = getDatabase();
        const source = db.get('SELECT * FROM video_sources WHERE id = ?', [source_id]);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        // 使用 CMS API 解析器获取视频列表
        const { CmsApiParser } = require('../services/CmsApiParser');
        // 获取代理设置
        const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
        const parser = new CmsApiParser(source.url, agent);

        const result = await parser.getVideos({
            categoryId: category_id,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: result.list,
            pagination: {
                page: result.page,
                pagecount: result.pagecount,
                limit: result.limit,
                total: result.total
            }
        });
    } catch (error) {
        console.error('[videos] Failed to get videos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 搜索视频
 * GET /api/videos/search
 * Query: keyword, source_id (可选), page, limit
 * 
 * 注意：此路由必须在 /:id 之前定义，否则 'search' 会被当作 id
 */
router.get('/search', async (req, res) => {
    try {
        const { keyword, source_id, page = 1, limit = 20 } = req.query;

        if (!keyword) {
            return res.status(400).json({ success: false, error: 'keyword is required' });
        }

        const db = getDatabase();
        let sources = [];

        if (source_id) {
            const source = db.get('SELECT * FROM video_sources WHERE id = ? AND enabled = 1', [source_id]);
            if (source) sources.push(source);
        } else {
            sources = db.all('SELECT * FROM video_sources WHERE enabled = 1 ORDER BY sort_order');
        }

        if (sources.length === 0) {
            return res.json({ success: true, data: [], message: 'No enabled sources' });
        }

        const { CmsApiParser } = require('../services/CmsApiParser');
        const results = [];

        // 从所有启用的源搜索
        for (const source of sources) {
            try {
                // 获取代理设置
                const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
                const parser = new CmsApiParser(source.url, agent);
                const result = await parser.search(keyword, parseInt(page), parseInt(limit));

                // 给每个结果添加源信息
                for (const item of result.list || []) {
                    item.source_id = source.id;
                    item.source_name = source.name;
                    results.push(item);
                }
            } catch (err) {
                console.warn(`[videos] Search failed for source ${source.name}:`, err.message);
            }
        }

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[videos] Failed to search videos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取 Banner 数据
 * GET /api/videos/banner
 * 
 * 注意：此路由必须在 /:id 之前定义
 */
router.get('/banner', async (req, res) => {
    try {
        const db = getDatabase();

        // 获取 Banner 设置
        const bannerCountSetting = db.get("SELECT value FROM settings WHERE key = 'banner_count'");
        const bannerSourcesSetting = db.get("SELECT value FROM settings WHERE key = 'banner_sources'");

        const bannerCount = parseInt(bannerCountSetting?.value || '6');
        let sourceIds = [];

        try {
            sourceIds = JSON.parse(bannerSourcesSetting?.value || '[]');
        } catch (e) {
            sourceIds = [];
        }

        // 如果没有指定源，使用所有启用的源
        let sources;
        if (sourceIds.length > 0) {
            sources = db.all(`SELECT * FROM video_sources WHERE id IN (${sourceIds.map(() => '?').join(',')}) AND enabled = 1`, sourceIds);
        } else {
            sources = db.all('SELECT * FROM video_sources WHERE enabled = 1 ORDER BY sort_order LIMIT 3');
        }

        if (sources.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { CmsApiParser } = require('../services/CmsApiParser');
        const bannerVideos = [];

        // 从每个源获取热门视频
        const videosPerSource = Math.ceil(bannerCount / sources.length);

        for (const source of sources) {
            try {
                // 获取代理设置
                const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
                const parser = new CmsApiParser(source.url, agent);
                const result = await parser.getVideos({ page: 1, limit: videosPerSource });

                for (const video of (result.list || []).slice(0, videosPerSource)) {
                    if (bannerVideos.length >= bannerCount) break;
                    video.source_id = source.id;
                    video.source_name = source.name;
                    bannerVideos.push(video);
                }
            } catch (err) {
                console.warn(`[videos] Banner fetch failed for source ${source.name}:`, err.message);
            }
        }

        res.json({ success: true, data: bannerVideos });
    } catch (error) {
        console.error('[videos] Failed to get banner:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取视频详情
 * GET /api/videos/:id
 * Query: source_id
 * 
 * 注意：此路由必须放在 /search 和 /banner 之后
 */
router.get('/:id', async (req, res) => {
    try {
        const { source_id } = req.query;

        if (!source_id) {
            return res.status(400).json({ success: false, error: 'source_id is required' });
        }

        const db = getDatabase();
        const source = db.get('SELECT * FROM video_sources WHERE id = ?', [source_id]);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Source not found' });
        }

        const { CmsApiParser } = require('../services/CmsApiParser');
        const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
        const parser = new CmsApiParser(source.url, agent);

        const video = await parser.getVideoDetail(req.params.id);

        if (!video) {
            return res.status(404).json({ success: false, error: 'Video not found' });
        }

        // 添加源信息
        video.source_id = source.id;
        video.source_name = source.name;
        video.source_proxy_enabled = !!source.proxy_enabled;

        res.json({ success: true, data: video });
    } catch (error) {
        console.error('[videos] Failed to get video detail:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取收藏列表
 * GET /api/videos/favorites
 */
router.get('/favorites', (req, res) => {
    try {
        const db = getDatabase();
        const favorites = db.all(`
            SELECT f.*, s.name as source_name 
            FROM favorites f
            LEFT JOIN video_sources s ON f.source_id = s.id
            ORDER BY f.created_at DESC
        `);
        res.json({ success: true, data: favorites });
    } catch (error) {
        console.error('[videos] Failed to get favorites:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 添加收藏
 * POST /api/videos/favorites
 */
router.post('/favorites', (req, res) => {
    try {
        const { source_id, vod_id, title, cover, year } = req.body;

        if (!source_id || !vod_id) {
            return res.status(400).json({ success: false, error: 'source_id and vod_id are required' });
        }

        const db = getDatabase();

        // 检查是否已收藏
        const existing = db.get(
            'SELECT * FROM favorites WHERE source_id = ? AND vod_id = ?',
            [source_id, vod_id]
        );

        if (existing) {
            return res.status(400).json({ success: false, error: 'Already in favorites' });
        }

        const result = db.run(
            'INSERT INTO favorites (source_id, vod_id, title, cover, year) VALUES (?, ?, ?, ?, ?)',
            [source_id, vod_id, title, cover, year]
        );

        const newFavorite = db.get('SELECT * FROM favorites WHERE id = ?', [result.lastID]);
        res.json({ success: true, data: newFavorite });
    } catch (error) {
        console.error('[videos] Failed to add favorite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除收藏
 * DELETE /api/videos/favorites/:id
 */
router.delete('/favorites/:id', (req, res) => {
    try {
        const db = getDatabase();
        db.run('DELETE FROM favorites WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Favorite deleted' });
    } catch (error) {
        console.error('[videos] Failed to delete favorite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 检查是否已收藏
 * GET /api/videos/favorites/check
 */
router.get('/favorites/check', (req, res) => {
    try {
        const { source_id, vod_id } = req.query;
        const db = getDatabase();

        // 处理 vod_id 可能的格式差异（如 "116810" vs "116810.0"）
        const vodIdStr = String(vod_id);
        const vodIdNum = parseFloat(vod_id);

        // 尝试多种格式匹配
        let favorite = db.get(
            'SELECT * FROM favorites WHERE source_id = ? AND (vod_id = ? OR vod_id = ? OR vod_id = ?)',
            [source_id, vodIdStr, vodIdNum, String(vodIdNum)]
        );

        console.log('[favorites/check] source_id:', source_id, 'vod_id:', vod_id, 'found:', !!favorite);

        res.json({ success: true, data: { isFavorite: !!favorite, favorite } });
    } catch (error) {
        console.error('[videos] Failed to check favorite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取播放历史
 * GET /api/videos/history
 */
router.get('/history', (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const db = getDatabase();

        const history = db.all(`
            SELECT h.*, s.name as source_name 
            FROM play_history h
            LEFT JOIN video_sources s ON h.source_id = s.id
            ORDER BY h.updated_at DESC
            LIMIT ?
        `, [parseInt(limit)]);

        res.json({ success: true, data: history });
    } catch (error) {
        console.error('[videos] Failed to get history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新播放进度
 * POST /api/videos/history
 */
router.post('/history', (req, res) => {
    try {
        const { source_id, vod_id, title, cover, episode, episode_name, progress, duration } = req.body;

        if (!source_id || !vod_id) {
            return res.status(400).json({ success: false, error: 'source_id and vod_id are required' });
        }

        const db = getDatabase();

        // 尝试更新或插入
        const existing = db.get(
            'SELECT * FROM play_history WHERE source_id = ? AND vod_id = ?',
            [source_id, vod_id]
        );

        if (existing) {
            db.run(
                `UPDATE play_history 
                 SET title = ?, cover = ?, episode = ?, episode_name = ?, 
                     progress = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE source_id = ? AND vod_id = ?`,
                [title, cover, episode || 1, episode_name, progress || 0, duration || 0, source_id, vod_id]
            );
        } else {
            db.run(
                `INSERT INTO play_history (source_id, vod_id, title, cover, episode, episode_name, progress, duration)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [source_id, vod_id, title, cover, episode || 1, episode_name, progress || 0, duration || 0]
            );
        }

        res.json({ success: true, message: 'History updated' });
    } catch (error) {
        console.error('[videos] Failed to update history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 清除播放历史
 * DELETE /api/videos/history
 */
router.delete('/history', (req, res) => {
    try {
        const db = getDatabase();
        db.run('DELETE FROM play_history');
        res.json({ success: true, message: 'History cleared' });
    } catch (error) {
        console.error('[videos] Failed to clear history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
