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
     * 支持排序、过滤和分页
     */
    static async getItems(server, parentId, options = {}) {
        const { url, api_key, type, user_id } = server;
        const {
            limit,
            startIndex = 0,
            sortBy = 'SortName',
            sortOrder = 'Ascending',
            includeItemTypes = 'Movie,Series,MusicVideo,Video',
            fields = 'PrimaryImageAspectRatio,ProductionYear,Overview,Genres,CommunityRating,RunTimeTicks,UserData',
            filters = ''
        } = options;

        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            if (!effectiveUserId) throw new Error('User context missing');

            // 构造标准 PascalCase 参数，透传给 Emby/Jellyfin
            const params = {
                ParentId: parentId,
                UserId: effectiveUserId,
                Recursive: true,
                IncludeItemTypes: includeItemTypes,
                Fields: fields,
                Filters: filters,
                SortBy: sortBy,
                SortOrder: sortOrder,
                StartIndex: startIndex,
                Limit: limit,
                api_key: api_key
            };

            const endpoint = type === 'emby'
                ? `/emby/Users/${effectiveUserId}/Items`
                : `/Users/${effectiveUserId}/Items`;

            console.log(`[MediaServerService] Fetching items for Category: ${parentId} | SortBy: ${sortBy} | URL: ${url}${endpoint}`);

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
     * 上报播放开始
     */
    static async reportPlaybackStart(server, itemId) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            // 🎬 Windows 版补丁：api_key 必须保留在 URL，且部分拦截器需要 Body 里也有
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Sessions/Playing?api_key=${api_key}`;

            console.log(`[Emby/Sync] Starting playback (Windows Patch): ItemId=${itemId} | User=${effectiveUserId}`);

            const response = await axios.post(`${url}${endpoint}`, {
                ItemId: itemId,
                PlayMethod: 'DirectStream',
                CanSeek: true,
                UserId: effectiveUserId,
                // 🎬 核心：Body 补全 Token
                api_key: api_key,
                Token: api_key
            }, {
                headers: this.getReportingHeaders(api_key, effectiveUserId)
            });
            console.log(`[Emby/Sync] Start success: ${response.status}`);
            return { success: true };
        } catch (error) {
            const embyError = error.response?.data;
            console.error('[Emby/Sync] reportPlaybackStart FAILED:', JSON.stringify(embyError || error.message));
            return { success: false, error: typeof embyError === 'string' ? embyError : JSON.stringify(embyError || error.message) };
        }
    }

    /**
     * 上报播放进度
     */
    static async reportPlaybackProgress(server, itemId, positionTicks, isPaused = false) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Sessions/Playing/Progress?api_key=${api_key}`;

            const response = await axios.post(`${url}${endpoint}`, {
                ItemId: itemId,
                PositionTicks: Math.floor(positionTicks),
                IsPaused: isPaused,
                PlayMethod: 'DirectStream',
                UserId: effectiveUserId,
                api_key: api_key,
                Token: api_key
            }, {
                headers: this.getReportingHeaders(api_key, effectiveUserId)
            });
            console.log(`[Emby/Sync] Progress success: ${response.status}`);
            return { success: true };
        } catch (error) {
            const embyError = error.response?.data;
            console.error('[Emby/Sync] reportPlaybackProgress FAILED:', JSON.stringify(embyError || error.message));
            return { success: false, error: typeof embyError === 'string' ? embyError : JSON.stringify(embyError || error.message) };
        }
    }

    /**
     * 上报播放停止
     */
    static async reportPlaybackStopped(server, itemId, positionTicks) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Sessions/Playing/Stopped?api_key=${api_key}`;

            const response = await axios.post(`${url}${endpoint}`, {
                ItemId: itemId,
                PositionTicks: Math.floor(positionTicks),
                UserId: effectiveUserId,
                api_key: api_key,
                Token: api_key
            }, {
                headers: this.getReportingHeaders(api_key, effectiveUserId)
            });
            console.log(`[Emby/Sync] Stop success: ${response.status}`);
            return { success: true };
        } catch (error) {
            const embyError = error.response?.data;
            console.error('[Emby/Sync] reportPlaybackStopped FAILED:', JSON.stringify(embyError || error.message));
            return { success: false, error: typeof embyError === 'string' ? embyError : JSON.stringify(embyError || error.message) };
        }
    }

    /**
     * 获取“继续观看”内容
     */
    static async getResumeItems(server) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Users/${effectiveUserId}/Items/Resume`;
            const response = await axios.get(`${url}${endpoint}`, {
                params: {
                    api_key,
                    Limit: 12,
                    Fields: 'PrimaryImageAspectRatio,ProductionYear,Overview',
                    ImageTypeLimit: 1,
                    MediaTypes: 'Video'
                }
            });
            return { success: true, data: response.data.Items || [] };
        } catch (error) {
            console.error('[Emby/API] getResumeItems failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取全量聚合首页数据 (动态同步)
     */
    static async getFullHomeData(server) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);

            // 1. 获取继续记录 (Resume)
            const resumeRes = await this.getResumeItems(server);

            // 2. 获取媒体库视图 (Views)
            const viewsRes = await this.getLibraries(server);
            const views = viewsRes.success ? viewsRes.data : [];

            // 3. 为每个视图获取“最新内容”
            const sectionPromises = views.map(view =>
                this.getLatestItemsByParent(server, view.Id, 16)
                    .then(res => ({
                        title: view.Name,
                        id: view.Id,
                        type: view.CollectionType || 'unknown',
                        items: res.success ? res.data : []
                    }))
            );

            const sections = await Promise.all(sectionPromises);

            return {
                success: true,
                data: {
                    resume: resumeRes.success ? resumeRes.data : [],
                    sections: sections.filter(s => s.items.length > 0)
                }
            };
        } catch (error) {
            console.error('[Emby/API] getFullHomeData failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取特定父节点的“最新添加”内容
     */
    static async getLatestItemsByParent(server, parentId, limit = 16) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Users/${effectiveUserId}/Items/Latest`;
            const response = await axios.get(`${url}${endpoint}`, {
                params: {
                    api_key,
                    ParentId: parentId,
                    Limit: limit,
                    Fields: 'PrimaryImageAspectRatio,ProductionYear',
                    ImageTypeLimit: 1
                }
            });
            return { success: true, data: response.data || [] };
        } catch (error) {
            console.error('[Emby/API] getLatestItemsByParent failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取“最新添加”内容 (全局)
     */
    static async getLatestItems(server, limit = 16) {
        const { url, api_key, type, user_id } = server;
        try {
            const effectiveUserId = user_id || await this.getPublicUserId(server);
            // 获取聚合的最新项，不分分类
            const endpoint = `${type === 'emby' ? '/emby' : ''}/Users/${effectiveUserId}/Items/Latest`;
            const response = await axios.get(`${url}${endpoint}`, {
                params: {
                    api_key,
                    Limit: limit,
                    Fields: 'PrimaryImageAspectRatio,ProductionYear',
                    ImageTypeLimit: 1
                }
            });
            return { success: true, data: response.data || [] };
        } catch (error) {
            console.error('[Emby/API] getLatestItems failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取统一的上报 Headers
     */
    static getReportingHeaders(apiKey) {
        // 🎬 核心：Emby API 在处理控制指令时，有时对 X-Emby-Authorization 这一单一长串有极强的依赖
        // 即使 URL 里有 api_key，某些严格版本如果 Headers 里没有 Client 信息也会报 Parameter key null
        const authHeader = `Emby UserId="${encodeURIComponent('NavLink')}", Client="NavLink Web", Device="NavLink-Web-Plugin", DeviceId="NavLink-Web-Plugin", Version="1.0.1", Token="${apiKey}"`;
        return {
            'X-Emby-Authorization': authHeader,
            'X-Emby-Token': apiKey, // 双重保险
            'Accept': 'application/json'
        };
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
