const axios = require('axios');

class MediaServerService {
    /**
     * 测试服务器连接并获取基本信息
     */
    static async testConnection(server) {
        const { url, api_key, type } = server;
        try {
            const endpoint = type === 'emby' ? '/emby/System/Info' : '/System/Info';
            const response = await axios.get(`${url}${endpoint}`, {
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                },
                timeout: 5000
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[MediaServerService] Test failed for ${url}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取媒体库列表 (Views)
     */
    static async getLibraries(server) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            if (!effectiveUserId) throw new Error('Could not find a valid user ID');

            const endpoint = type === 'emby'
                ? `/emby/Users/${effectiveUserId}/Views`
                : `/Users/${effectiveUserId}/Views`;

            const response = await axios.get(`${url}${endpoint}`, {
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });

            const libraries = (response.data.Items || []).filter(item =>
                ['movies', 'tvshows', 'musicvideos', 'homevideos', 'boxsets'].includes(item.CollectionType) || !item.CollectionType
            );

            return { success: true, data: libraries };
        } catch (error) {
            console.error(`[MediaServerService] GetLibraries failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取库内的项目 (Items)
     */
    static async getItems(server, parentId, options = {}) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            if (!effectiveUserId) throw new Error('User context missing');

            // 构造标准 PascalCase 参数
            const params = {
                ParentId: parentId,
                UserId: effectiveUserId,
                Recursive: true,
                IncludeItemTypes: 'Movie,Series,MusicVideo,Video',
                Fields: 'PrimaryImageAspectRatio,ProductionYear,Overview,Genres',
                StartIndex: 0,
                Limit: 500, // 增加到 500
                api_key: api_key
            };

            const endpoint = type === 'emby'
                ? `/emby/Users/${effectiveUserId}/Items`
                : `/Users/${effectiveUserId}/Items`;

            console.log(`[MediaServerService] Fetching items for Category: ${parentId} | URL: ${url}${endpoint}`);

            const response = await axios.get(`${url}${endpoint}`, {
                params,
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });

            const items = response.data.Items || [];
            console.log(`[MediaServerService] SUCCESS: Found ${items.length} items`);

            return {
                success: true,
                data: {
                    Items: items,
                    TotalRecordCount: response.data.TotalRecordCount || items.length
                }
            };
        } catch (error) {
            if (error.response) {
                console.error(`[MediaServerService] GetItems ERROR [${error.response.status}]:`, JSON.stringify(error.response.data));
            } else {
                console.error(`[MediaServerService] GetItems FAILED:`, error.message);
            }
            return { success: false, error: '获取媒体项失败: ' + (error.response?.statusText || error.message) };
        }
    }

    /**
     * 辅助：获取公共用户 ID
     */
    static async getPublicUserId(server) {
        const { url, api_key, type } = server;
        try {
            const endpoint = type === 'emby' ? '/emby/Users' : '/Users';
            const response = await axios.get(`${url}${endpoint}`, {
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });
            const userId = response.data[0]?.Id;
            return userId;
        } catch (error) {
            console.error(`[MediaServerService] PublicUserId Error:`, error.message);
            return null;
        }
    }

    /**
     * 获取项目详情 (Item Details)
     */
    static async getItemDetail(server, itemId) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = type === 'emby'
                ? `/emby/Users/${effectiveUserId}/Items/${itemId}`
                : `/Users/${effectiveUserId}/Items/${itemId}`;

            const response = await axios.get(`${url}${endpoint}`, {
                params: { api_key },
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[MediaServerService] GetItemDetail failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取相似项目 (Similar Items)
     */
    static async getSimilarItems(server, itemId) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            // Emby 的相似项目接口：/Items/{id}/Similar
            const endpoint = type === 'emby'
                ? `/emby/Items/${itemId}/Similar`
                : `/Items/${itemId}/Similar`;

            const response = await axios.get(`${url}${endpoint}`, {
                params: {
                    api_key,
                    UserId: effectiveUserId,
                    Limit: 12,
                    Fields: 'PrimaryImageAspectRatio,ProductionYear'
                },
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: response.data.Items || [] };
        } catch (error) {
            console.error(`[MediaServerService] GetSimilarItems failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取播放信息 (包含流媒体地址)
     */
    static async getPlaybackInfo(server, itemId) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = type === 'emby'
                ? `/emby/Items/${itemId}/PlaybackInfo`
                : `/Items/${itemId}/PlaybackInfo`;

            const response = await axios.post(`${url}${endpoint}`, {}, {
                params: {
                    UserId: effectiveUserId,
                    api_key: api_key
                },
                headers: {
                    'X-Emby-Token': api_key,
                    'Accept': 'application/json'
                }
            });

            const mediaSources = response.data.MediaSources || [];
            console.log(`[MediaServerService] PlaybackInfo for ${itemId}: ${mediaSources.length} sources found`);

            if (mediaSources.length > 0) {
                const source = mediaSources[0];
                console.log(`[MediaServerService] Selected source ${source.Id} | Container: ${source.Container}`);

                // 更稳健的流地址构造，排除掉可能引起问题的 static=true 或强加容器名
                const container = source.Container || 'mp4';
                const streamUrl = `${url}${type === 'emby' ? '/emby' : ''}/videos/${itemId}/stream.${container}?MediaSourceId=${source.Id}&Static=true&api_key=${api_key}`;

                return { success: true, data: { ...response.data, streamUrl } };
            }
            return { success: false, error: '未找到可用的媒体源' };
        } catch (error) {
            console.error(`[MediaServerService] GetPlaybackInfo failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取海报图片 URL
     */
    static getImageUrl(server, itemId, tag, type = 'Primary', maxWidth = 400) {
        const { url, api_key } = server;
        if (!tag) return null;
        return `${url}/emby/Items/${itemId}/Images/${type}?maxWidth=${maxWidth}&tag=${tag}&api_key=${api_key}`;
    }
}

module.exports = MediaServerService;
