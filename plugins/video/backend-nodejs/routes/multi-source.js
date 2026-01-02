/**
 * 多视频源搜索路由
 * 实现跨源搜索和换源功能
 */
const express = require('express');
const router = express.Router();
const { CmsApiParser } = require('../services/CmsApiParser');
const { getSystemProxyAgent } = require('../utils/fetch-agent');

// 获取数据库实例
let db = null;
const getDb = () => {
    if (!db) {
        const Database = require('better-sqlite3');
        const path = require('path');
        const dbPath = process.env.VIDEO_DB_PATH || path.join(process.cwd(), 'data', 'video.db');
        db = new Database(dbPath);
    }
    return db;
};

/**
 * GET /search
 * 搜索同名视频的多个源
 * 
 * @param {string} title - 视频标题
 * @param {number} exclude_source_id - 排除的源ID（当前播放的源）
 * @param {number} episode_index - 当前播放的集数索引（可选，用于匹配）
 * @param {string} type_name - 视频类型名称（如"电影"、"电视剧"等，用于过滤）
 * @param {number} year - 年份（可选，用于精确匹配）
 */
router.get('/search', async (req, res) => {
    try {
        const { title, exclude_source_id, episode_index, type_name, year } = req.query;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: title'
            });
        }

        const excludeId = parseInt(exclude_source_id) || 0;
        const epIndex = parseInt(episode_index) || 0;
        const videoYear = year ? String(year) : null;

        // 判断是否为电影类型（电影通常只有1集）
        const isMovie = type_name && (
            type_name.includes('电影') ||
            type_name.includes('剧场') ||
            type_name.includes('动作片') ||
            type_name.includes('喜剧片') ||
            type_name.includes('恐怖片') ||
            type_name.includes('科幻片') ||
            type_name.includes('爱情片') ||
            type_name.includes('剧情片') ||
            type_name.includes('战争片') ||
            type_name.includes('纪录片')
        );

        console.log(`[MultiSource] Searching for "${title}", type="${type_name}", isMovie=${isMovie}, excluding source ${excludeId}`);

        // 获取所有启用的视频源
        const database = getDb();
        const sources = database.prepare(`
            SELECT id, name, url, proxy_enabled 
            FROM video_sources 
            WHERE enabled = 1 AND id != ?
        `).all(excludeId);

        console.log(`[MultiSource] Found ${sources.length} alternative sources to search`);

        // 并行搜索所有源
        const searchPromises = sources.map(async (source) => {
            try {
                // 获取代理设置
                const agent = source.proxy_enabled ? getSystemProxyAgent() : null;
                const parser = new CmsApiParser(source.url, agent);
                const searchResult = await parser.search(title, 1, 10);

                if (!searchResult.list || searchResult.list.length === 0) {
                    return null;
                }

                // 查找标题匹配的视频
                const normalizedTitle = normalizeTitle(title);

                // 按匹配度排序，优先完全匹配
                const matchedVideo = searchResult.list.find(v => {
                    const videoTitle = normalizeTitle(v.vod_name);
                    const titleMatch = videoTitle === normalizedTitle ||
                        videoTitle.includes(normalizedTitle) ||
                        normalizedTitle.includes(videoTitle);

                    if (!titleMatch) return false;

                    // 如果指定了类型，进行类型匹配
                    if (isMovie !== null) {
                        const resultTypeName = v.type_name || '';
                        const resultIsMovie =
                            resultTypeName.includes('电影') ||
                            resultTypeName.includes('剧场') ||
                            resultTypeName.includes('动作片') ||
                            resultTypeName.includes('喜剧片') ||
                            resultTypeName.includes('恐怖片') ||
                            resultTypeName.includes('科幻片') ||
                            resultTypeName.includes('爱情片') ||
                            resultTypeName.includes('剧情片') ||
                            resultTypeName.includes('战争片') ||
                            resultTypeName.includes('纪录片');

                        // 类型必须匹配（电影对电影，电视剧对电视剧）
                        if (isMovie !== resultIsMovie) {
                            console.log(`[MultiSource] Type mismatch: looking for ${isMovie ? 'movie' : 'series'}, found "${resultTypeName}"`);
                            return false;
                        }
                    }

                    // 如果指定了年份，进行年份匹配
                    if (videoYear && v.vod_year) {
                        const resultYear = String(v.vod_year).match(/\d{4}/)?.[0];
                        if (resultYear && resultYear !== videoYear) {
                            return false;
                        }
                    }

                    return true;
                });

                if (!matchedVideo) {
                    return null;
                }

                // 获取视频详情以获取剧集列表
                const detail = await parser.getVideoDetail(matchedVideo.vod_id);

                if (!detail || !detail.episodes || detail.episodes.length === 0) {
                    return null;
                }

                // 统计所有有效剧集数
                const totalEpisodes = detail.episodes.reduce((sum, ep) => sum + (ep.list?.length || 0), 0);

                return {
                    source_id: source.id,
                    source_name: source.name,
                    vod_id: matchedVideo.vod_id,
                    vod_name: detail.vod_name,
                    vod_pic: detail.vod_pic,
                    episodes: detail.episodes,
                    total_episodes: totalEpisodes,
                    // 检查当前集数是否可用
                    current_episode_available: checkEpisodeAvailable(detail.episodes, epIndex)
                };
            } catch (error) {
                console.error(`[MultiSource] Error searching source ${source.name}:`, error.message);
                return null;
            }
        });

        // 等待所有搜索完成（设置超时）
        const results = await Promise.allSettled(
            searchPromises.map(p =>
                Promise.race([
                    p,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 8000)
                    )
                ])
            )
        );

        // 过滤有效结果
        const alternatives = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        console.log(`[MultiSource] Found ${alternatives.length} alternative sources for "${title}"`);

        res.json({
            success: true,
            data: alternatives
        });

    } catch (error) {
        console.error('[MultiSource] Search failed:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 标准化标题用于匹配
 * 移除特殊字符、空格、括号内容等
 */
function normalizeTitle(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/\s+/g, '')           // 移除空格
        .replace(/[（(].*?[)）]/g, '')  // 移除括号内容
        .replace(/[：:]/g, '')          // 移除冒号
        .replace(/[，,。.！!？?]/g, '') // 移除标点
        .replace(/\d+$/g, '')           // 移除末尾数字（如"xxx2"）
        .trim();
}

/**
 * 检查指定集数是否在剧集列表中可用
 */
function checkEpisodeAvailable(episodes, episodeIndex) {
    if (!episodes || episodes.length === 0) return false;

    // 检查第一个播放源的对应集数
    const firstSource = episodes[0];
    if (!firstSource || !firstSource.list) return false;

    return episodeIndex < firstSource.list.length;
}

module.exports = router;
