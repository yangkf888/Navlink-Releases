const { getDatabase } = require('../database');
const fetch = require('node-fetch');

class LiveService {
    /**
     * 获取所有直播源
     */
    getAllSources() {
        const db = getDatabase();
        return db.all('SELECT * FROM live_sources ORDER BY sort_order ASC, id ASC');
    }

    /**
     * 添加直播源
     */
    addSource(data) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO live_sources (name, platform, channel_id, streamer_name, category, cover_url, enabled, sort_order, tags, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run([
            data.name,
            data.platform,
            data.channel_id,
            data.streamer_name || null,
            data.category || null,
            data.cover_url || null,
            data.enabled !== undefined ? data.enabled : 1,
            data.sort_order || 0,
            data.tags || null,
            data.remark || null
        ]);
    }

    /**
     * 更新直播源
     */
    updateSource(id, data) {
        const db = getDatabase();
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }
        if (data.platform !== undefined) {
            fields.push('platform = ?');
            values.push(data.platform);
        }
        if (data.channel_id !== undefined) {
            fields.push('channel_id = ?');
            values.push(data.channel_id);
        }
        if (data.streamer_name !== undefined) {
            fields.push('streamer_name = ?');
            values.push(data.streamer_name);
        }
        if (data.category !== undefined) {
            fields.push('category = ?');
            values.push(data.category);
        }
        if (data.cover_url !== undefined) {
            fields.push('cover_url = ?');
            values.push(data.cover_url);
        }
        if (data.enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(data.enabled);
        }
        if (data.sort_order !== undefined) {
            fields.push('sort_order = ?');
            values.push(data.sort_order);
        }
        if (data.tags !== undefined) {
            fields.push('tags = ?');
            values.push(data.tags);
        }
        if (data.remark !== undefined) {
            fields.push('remark = ?');
            values.push(data.remark);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const stmt = db.prepare(`UPDATE live_sources SET ${fields.join(', ')} WHERE id = ?`);
        return stmt.run(values);
    }

    /**
     * 删除直播源
     */
    deleteSource(id) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM live_sources WHERE id = ?');
        return stmt.run([id]);
    }

    /**
     * 获取所有直播状态
     */
    getAllStatus() {
        const db = getDatabase();
        return db.all(`
            SELECT ls.*, lsc.is_live, lsc.title, lsc.viewer_count, lsc.stream_url, lsc.updated_at as status_updated_at
            FROM live_sources ls
            LEFT JOIN live_status_cache lsc ON ls.id = lsc.source_id
            WHERE ls.enabled = 1
            ORDER BY ls.sort_order ASC, ls.id ASC
        `);
    }

    /**
     * 获取指定直播源的状态
     */
    getStatus(sourceId) {
        const db = getDatabase();
        return db.get(`
            SELECT ls.*, lsc.is_live, lsc.title, lsc.viewer_count, lsc.stream_url, lsc.updated_at as status_updated_at
            FROM live_sources ls
            LEFT JOIN live_status_cache lsc ON ls.id = lsc.source_id
            WHERE ls.id = ?
        `, [sourceId]);
    }

    /**
     * 更新直播状态缓存
     */
    updateStatusCache(sourceId, status) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO live_status_cache (source_id, is_live, title, viewer_count, stream_url, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        return stmt.run([
            sourceId,
            status.is_live ? 1 : 0,
            status.title || null,
            status.viewer_count || null,
            status.stream_url || null
        ]);
    }

    /**
     * 检查直播状态（根据平台）
     */
    async checkLiveStatus(source) {
        try {
            let status = null;

            switch (source.platform) {
                case 'bilibili':
                    status = await this.checkBilibiliLive(source.channel_id);
                    break;
                case 'douyu':
                    status = await this.checkDouyuLive(source.channel_id);
                    break;
                case 'huya':
                    status = await this.checkHuyaLive(source.channel_id);
                    break;
                // 其他平台暂未实现
                default:
                    console.log(`[LiveService] Platform ${source.platform} not supported yet`);
                    return null;
            }

            if (status) {
                this.updateStatusCache(source.id, status);
            }

            return status;
        } catch (error) {
            console.error(`[LiveService] Error checking live status for ${source.name}:`, error);
            return null;
        }
    }

    /**
     * B站直播状态检测
     */
    async checkBilibiliLive(roomId) {
        try {
            const url = `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const data = await response.json();

            if (data.code === 0 && data.data) {
                return {
                    is_live: data.data.live_status === 1,
                    title: data.data.title || '',
                    viewer_count: data.data.online || 0,
                    stream_url: `https://live.bilibili.com/${roomId}`,
                    platform: 'bilibili',
                    channel_id: roomId
                };
            }
            return null;
        } catch (error) {
            console.error(`[LiveService] Bilibili API error for room ${roomId}:`, error);
            return null;
        }
    }

    /**
     * 斗鱼直播状态检测
     */
    async checkDouyuLive(roomId) {
        try {
            const url = `https://open.douyucdn.cn/api/RoomApi/room/${roomId}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const data = await response.json();

            if (data.error === 0 && data.data) {
                return {
                    is_live: data.data.room_status === '1',
                    title: data.data.room_name || '',
                    viewer_count: parseInt(data.data.online || 0),
                    stream_url: `https://www.douyu.com/${roomId}`,
                    platform: 'douyu',
                    channel_id: roomId
                };
            }
            return null;
        } catch (error) {
            console.error(`[LiveService] Douyu API error for room ${roomId}:`, error);
            return null;
        }
    }

    /**
     * 虎牙直播状态检测（简化版，实际可能需要更复杂的解析）
     */
    async checkHuyaLive(roomId) {
        try {
            // 虎牙没有公开API，这里提供一个基本框架
            // 实际使用可能需要爬虫或第三方服务
            console.log(`[LiveService] Huya live check for ${roomId} - not fully implemented`);
            return {
                is_live: false,
                title: '',
                viewer_count: 0,
                stream_url: `https://www.huya.com/${roomId}`
            };
        } catch (error) {
            console.error(`[LiveService] Huya check error for room ${roomId}:`, error);
            return null;
        }
    }

    /**
     * 获取真实播放地址
     */
    async getPlayUrl(sourceId) {
        const source = await this.getStatus(sourceId);
        if (!source || !source.is_live) return null;

        switch (source.platform) {
            case 'bilibili':
                return await this.getBilibiliStreamUrl(source.channel_id);
            case 'douyu':
                // 暂时返回原始 H5 URL，前端可以用 iframe 或尝试解析
                return { url: `https://www.douyu.com/topic/h5show?room_id=${source.channel_id}`, type: 'iframe' };
            default:
                return { url: source.stream_url, type: 'link' };
        }
    }

    /**
     * B站真实流地址解析
     */
    async getBilibiliStreamUrl(roomId) {
        try {
            // 首先通过 room_id 获取真实 room_id (避免短号)
            const roomInfoUrl = `https://api.live.bilibili.com/room/v1/Room/room_init?id=${roomId}`;
            const roomInfoRes = await fetch(roomInfoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://live.bilibili.com/'
                }
            });
            const roomInfo = await roomInfoRes.json();

            if (roomInfo.code !== 0 || !roomInfo.data) {
                console.error(`[LiveService] Bilibili room_init failed for ${roomId}:`, roomInfo.message);
                return null;
            }

            const realRoomId = roomInfo.data.room_id;

            // 获取播放地址 - 使用更稳定的 v1 API
            const url = `https://api.live.bilibili.com/room/v1/Room/playUrl?cid=${realRoomId}&qn=10000&platform=web`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': `https://live.bilibili.com/${realRoomId}`
                }
            });
            const data = await response.json();

            if (data.code === 0 && data.data && data.data.durl && data.data.durl.length > 0) {
                const finalUrl = data.data.durl[0].url;
                return {
                    url: finalUrl,
                    type: finalUrl.includes('.m3u8') ? 'm3u8' : 'flv',
                    is_live: true
                };
            }

            console.error(`[LiveService] Bilibili playUrl API error for ${realRoomId}:`, data.message);
            return null;
        } catch (error) {
            console.error(`[LiveService] Bilibili stream parse error for room ${roomId}:`, error);
            return null;
        }
    }

    /**
     * 批量刷新所有直播状态
     */
    async refreshAllStatus() {
        const sources = await this.getAllSources();
        const enabledSources = sources.filter(s => s.enabled === 1);
        const results = [];

        for (const source of enabledSources) {
            const status = await this.checkLiveStatus(source);
            results.push({ source_id: source.id, status });
        }

        return results;
    }
}

module.exports = new LiveService();
