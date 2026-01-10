/**
 * 媒体库扫描服务
 * 扫描网盘目录，解析 NFO 文件，获取封面图片，回退 TMDB 匹配
 */

const { getDatabase } = require('../database');
const { TmdbService } = require('./TmdbService');
const { AlistService } = require('./AlistService');
const { WebdavService } = require('./WebdavService');
const { LocalService } = require('./LocalService');
const fetch = require('node-fetch');

// 并发控制配置
const DIR_SCAN_LIMIT = 5;  // 目录递归并发限制

// NFO 常见文件名
const NFO_FILES = ['movie.nfo', 'info.nfo', 'tvshow.nfo'];
// 封面图片常见文件名
const POSTER_FILES = ['poster.jpg', 'poster.png', 'folder.jpg', 'cover.jpg', 'cover.png'];
// fanart 文件名
const FANART_FILES = ['fanart.jpg', 'fanart.png', 'backdrop.jpg', 'background.jpg'];
// 视频扩展名
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m3u8', '.ts', '.webm', '.rmvb', '.rm', '.strm'];
// 排除的文件夹名称（花絮、预告、元数据等）
const EXCLUDE_FOLDERS = [
    'behind the scenes', 'trailers', 'extras', 'metadata', '.actors', 'sample', 'proof',
    'backdrops', '.discovery', 'advs', 'others', 'featurettes', 'scenes', 'shorts'
];

class MediaScanService {
    constructor() {
        this.tmdbService = new TmdbService();
        this.scanningStatus = {}; // sourceId -> { scanning: boolean, progress: number, total: number }
    }

    /**
     * 获取网盘客户端工厂
     */
    async getNetdiskClient(source) {
        let client;
        if (source.type === 'webdav') {
            client = new WebdavService(source.url, source.username, source.password);
        } else if (source.type === 'local') {
            client = new LocalService(source.root_path);
        } else {
            // 默认 alist
            client = new AlistService(source.url, source.password);
            client.username = source.username || 'admin';
            // Alist 通常需要登录获取 Token
            await client.login();
        }
        return client;
    }

    /**
     * 获取扫描状态
     */
    getScanStatus(sourceId) {
        return this.scanningStatus[sourceId] || { scanning: false, progress: 0, total: 0, paths: {} };
    }

    /**
     * 扫描指定网盘源
     * @param {number} sourceId - 网盘源 ID
     * @param {number} maxDepth - 最大扫描深度
     * @param {string} specificPath - 可选，指定扫描的子路径
     */
    async scanSource(sourceId, maxDepth = 5, specificPath = null) {
        console.log(`[MediaScan] Starting scan for source ${sourceId}, maxDepth=${maxDepth}, specificPath=${specificPath}`);
        const db = getDatabase();

        // 获取网盘源信息
        const source = db.get('SELECT * FROM netdisk_sources WHERE id = ?', [sourceId]);
        if (!source) {
            console.error('[MediaScan] Source not found:', sourceId);
            throw new Error('网盘源不存在');
        }

        // 获取 TMDB API Key
        const tmdbSetting = db.get("SELECT value FROM settings WHERE key = 'tmdb_api_key'");
        if (tmdbSetting?.value) {
            this.tmdbService.setApiKey(tmdbSetting.value);
        }

        // 创建网盘客户端
        const client = await this.getNetdiskClient(source);

        // 初始化扫描状态
        if (!this.scanningStatus[sourceId]) {
            this.scanningStatus[sourceId] = { scanning: false, paths: {} };
        }

        const status = this.scanningStatus[sourceId];
        status.scanning = true;
        status.progress = 0;
        status.total = 0;
        status.message = '正在准备扫描...';

        try {
            // 解析扫描路径
            let foldersToScan = [];
            if (source.scan_paths) {
                try {
                    const parsed = JSON.parse(source.scan_paths);
                    if (Array.isArray(parsed)) {
                        foldersToScan = parsed.map(item =>
                            typeof item === 'string' ? { name: item, path: item } : item
                        );
                    }
                } catch (e) {
                    console.error('[MediaScan] Failed to parse scan_paths:', e);
                }
            }

            // 如果没有配置扫描路径，使用 root_path
            if (foldersToScan.length === 0) {
                foldersToScan = [{ name: '全部', path: source.root_path || '/' }];
            }

            // 如果指定了 specificPath，则只扫描该路径
            if (specificPath) {
                const found = foldersToScan.find(f => f.path === specificPath);
                foldersToScan = [found || { name: '指定目录', path: specificPath }];
            }

            // 初始化各路径状态
            foldersToScan.forEach(f => {
                status.paths[f.path] = { scanning: true, progress: 0, total: 0, message: '排队中...' };
            });

            console.log(`[MediaScan] Folders to scan: ${foldersToScan.length}`);

            // 1. 递归查找所有包含视频的媒体文件夹
            for (const folderEntry of foldersToScan) {
                const tmdbEnabled = folderEntry.tmdb_enabled !== false; // 默认为启用
                status.paths[folderEntry.path].message = '正在检索目录结构...';
                console.log(`[MediaScan] Finding media in: ${folderEntry.path}, tmdbEnabled=${tmdbEnabled}`);
                const mediaFolders = await this.findMediaFolders(client, folderEntry.path, maxDepth);

                status.paths[folderEntry.path].total = mediaFolders.length;
                status.paths[folderEntry.path].message = `发现 ${mediaFolders.length} 个媒体文件夹，准备处理...`;
                status.total += mediaFolders.length;

                // 2. 处理该根路径下的所有子文件夹 (并行处理，限制并发)
                const concurrency = 5;
                for (let i = 0; i < mediaFolders.length; i += concurrency) {
                    const chunk = mediaFolders.slice(i, i + concurrency);
                    await Promise.all(chunk.map(async (folder, index) => {
                        const localIndex = i + index + 1;
                        status.paths[folderEntry.path].progress = localIndex;
                        status.paths[folderEntry.path].message = `正在解析 (${localIndex}/${mediaFolders.length}): ${folder.name}`;

                        // 全局进度更新
                        status.progress++;
                        status.message = `正在扫描 (${status.progress}/${status.total})`;

                        try {
                            await this.processMediaFolder(client, source, folder, tmdbEnabled);
                        } catch (err) {
                            console.error(`[MediaScan] Failed to process ${folder.path}:`, err.message);
                        }
                    }));
                }
                status.paths[folderEntry.path].scanning = false;
                status.paths[folderEntry.path].message = '扫描完成';
            }

            status.message = '全量扫描完成';
        } catch (err) {
            console.error(`[MediaScan] Error:`, err);
            status.message = `发生错误: ${err.message}`;
        } finally {
            status.scanning = false;
        }

        return { success: true, count: status.progress };
    }

    /**
     * 清理索引
     */
    async clearIndex(sourceId, specificPath = null) {
        const db = getDatabase();
        if (specificPath) {
            db.run('DELETE FROM netdisk_media WHERE source_id = ? AND (path = ? OR path LIKE ?)', [
                sourceId,
                specificPath,
                specificPath.endsWith('/') ? `${specificPath}%` : `${specificPath}/%`
            ]);
            console.log(`[MediaScan] Cleared path: ${specificPath}`);
        } else {
            db.run('DELETE FROM netdisk_media WHERE source_id = ?', [sourceId]);
            console.log(`[MediaScan] Cleared all for source: ${sourceId}`);
        }
        return { success: true };
    }

    /**
     * 递归查找媒体文件夹
     * 优化逻辑：如果当前目录有视频且[没有]有效子目录，则视为末梢节点并停止深搜。
     */
    async findMediaFolders(client, path, maxDepth, currentDepth = 0) {
        if (currentDepth > maxDepth) return [];

        const result = [];
        try {
            const items = await client.list(path);
            const videos = items.filter(f => !f.is_dir && this.isVideoFile(f.name));

            // 找出有效的子目录（排除干扰项）
            const dirs = items.filter(f =>
                f.is_dir &&
                !EXCLUDE_FOLDERS.includes(f.name.toLowerCase()) &&
                !f.name.startsWith('.')
            );

            // 核心逻辑改进：基于“末梢节点”判断
            // 如果有视频且没有有效子目录 -> 这是一个完整的媒体节点（电影或剧集末级），停止在此分支递归
            if (videos.length > 0 && dirs.length === 0) {
                result.push({
                    path,
                    name: path.split('/').filter(Boolean).pop() || path,
                    videos,
                    items,
                    isLeaf: true
                });
                return result;
            }

            // 如果既有视频又有子目录 -> 记录当前目录并继续深搜（兼容带子目录的合集结构）
            if (videos.length > 0) {
                result.push({
                    path,
                    name: path.split('/').filter(Boolean).pop() || path,
                    videos,
                    items
                });
            }

            // 并行递归子目录
            const subFoldersResults = await Promise.all(dirs.map(dir => {
                const subPath = (path + '/' + dir.name).replace(/\/+/g, '/');
                return this.findMediaFolders(client, subPath, maxDepth, currentDepth + 1);
            }));

            for (const subFolders of subFoldersResults) {
                result.push(...subFolders);
            }
        } catch (err) {
            console.error(`[MediaScan] List ${path} failed:`, err.message);
        }
        return result;
    }

    /**
     * 处理媒体文件夹
     */
    async processMediaFolder(client, source, folder, tmdbEnabled = true, force = false) {
        const db = getDatabase();

        // Video 2.0: 检查是否已锁定（用户手动编辑过的媒体不再覆盖）
        const existingMedia = db.get('SELECT is_locked FROM netdisk_media WHERE source_id = ? AND path = ?', [source.id, folder.path]);
        if (existingMedia && existingMedia.is_locked && !force) {
            console.log(`[MediaScan] Skipping locked media: ${folder.path}`);
            return;
        }

        // 复用 findMediaFolders 中获取到的数据，减少请求
        const items = folder.items || await client.list(folder.path);

        // 查找 NFO 和视频
        let nfoFile = items.find(f => !f.is_dir && NFO_FILES.includes(f.name.toLowerCase()));
        if (!nfoFile) nfoFile = items.find(f => !f.is_dir && f.name.toLowerCase().endsWith('.nfo'));

        const rawVideoFiles = items.filter(f => !f.is_dir && this.isVideoFile(f.name));
        const videoFiles = [];

        // 处理视频文件列表，如果是 .strm 则解析内容
        for (const file of rawVideoFiles) {
            if (file.name.toLowerCase().endsWith('.strm')) {
                try {
                    console.log(`[STRM-DEBUG-V1] Parsing .strm file: ${file.name}`);
                    const strmPath = (folder.path + '/' + file.name).replace(/\/+/g, '/');
                    const info = await client.getFileInfo(strmPath);
                    // 仅处理 2KB 以内的 strm 文件，避免意外读取大文件
                    if (info && info.raw_url && (!info.size || info.size < 2048)) {
                        const headers = client.getHeaders ? client.getHeaders() : {};
                        const content = await this.fetchNfoContent(info.raw_url, headers);
                        const url = content.split('\n').map(line => line.trim()).find(line => line.startsWith('http'));
                        if (url) {
                            videoFiles.push(`${file.name}|${url}`);
                            continue;
                        }
                    }
                } catch (err) {
                    console.error(`[Netdisk] Failed to parse .strm file: ${file.name}`, err.message);
                }
            }
            videoFiles.push(file.name);
        }

        // 查找图片
        const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

        // 1. 优先查找标准封面文件（poster, folder, cover）
        let posterFile = items.find(f => !f.is_dir && POSTER_FILES.includes(f.name.toLowerCase()));
        let fanartFile = items.find(f => !f.is_dir && FANART_FILES.includes(f.name.toLowerCase()));

        // 2. 如果没找到标准文件名，尝试查找文件名中包含 'poster' 关键字的图片
        if (!posterFile) {
            posterFile = items.find(f => {
                const name = f.name.toLowerCase();
                return !f.is_dir && IMG_EXTS.some(ext => name.endsWith(ext)) && name.includes('poster');
            });
        }

        // 3. 尝试查找视频同名且带 'poster' 关键字的海报 (如 movie-poster.jpg)
        if (!posterFile && videoFiles.length > 0) {
            const mainVideoRaw = videoFiles[0];
            const mainVideo = (mainVideoRaw.includes('|') ? mainVideoRaw.split('|')[0] : mainVideoRaw).replace(/\.[^/.]+$/, "").toLowerCase();

            posterFile = items.find(f => {
                const name = f.name.toLowerCase();
                return !f.is_dir && name.startsWith(mainVideo) &&
                    IMG_EXTS.some(ext => name.endsWith(ext)) && name.includes('poster');
            });

            // 4. 尝试查找视频同名且带 'thumb' 或 'cover' 的图片 (作为次选)
            if (!posterFile) {
                posterFile = items.find(f => {
                    const name = f.name.toLowerCase();
                    return !f.is_dir && name.startsWith(mainVideo) &&
                        IMG_EXTS.some(ext => name.endsWith(ext)) &&
                        (name.includes('thumb') || name.includes('cover'));
                });
            }
        }

        // 5. 最后回退：查找文件夹内任何图片文件
        if (!posterFile) {
            posterFile = items.find(f => !f.is_dir && IMG_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)));
        }


        let metadata = {
            title: this.parseTitle(folder.name),
            year: this.parseYear(folder.name),
            media_type: videoFiles.length > 2 ? 'tvshow' : 'movie', // 初步判定分类
            nfo_parsed: 0,
            extra_metadata: {}
        };

        // 1. 解析 NFO
        if (nfoFile) {
            try {
                const nfoPath = (folder.path + '/' + nfoFile.name).replace(/\/+/g, '/');
                const info = await client.getFileInfo(nfoPath);
                if (info && info.raw_url) {
                    const headers = client.getHeaders ? client.getHeaders() : {};
                    const content = await this.fetchNfoContent(info.raw_url, headers);
                    const parsed = this.parseNfo(content, metadata.title);
                    if (parsed) metadata = { ...metadata, ...parsed, nfo_parsed: 1 };
                }
            } catch (err) { /* ignore */ }
        }

        // 2. 获取图片直链
        // 对于 WebDAV 源，使用代理 URL；对于 Alist，使用直链
        if (posterFile && !metadata.poster_url) {
            const posterPath = (folder.path + '/' + posterFile.name).replace(/\/+/g, '/');
            if (source.type === 'webdav' || source.type === 'local') {
                // WebDAV 和本地文件都使用代理
                metadata.poster_url = `/api/plugins/video/api/netdisk/image-proxy?sourceId=${source.id}&path=${encodeURIComponent(posterPath)}`;
            } else {
                const info = await client.getFileInfo(posterPath);
                if (info) metadata.poster_url = info.raw_url;
            }
        }
        if (fanartFile && !metadata.fanart_url) {
            const fanartPath = (folder.path + '/' + fanartFile.name).replace(/\/+/g, '/');
            if (source.type === 'webdav' || source.type === 'local') {
                metadata.fanart_url = `/api/plugins/video/api/netdisk/image-proxy?sourceId=${source.id}&path=${encodeURIComponent(fanartPath)}`;
            } else {
                const info = await client.getFileInfo(fanartPath);
                if (info) metadata.fanart_url = info.raw_url;
            }
        }

        // 3. TMDB 回退
        if (tmdbEnabled && (!metadata.nfo_parsed || !metadata.poster_url)) {
            try {
                const match = await this.tmdbService.match(metadata.title, metadata.year);
                if (match) {
                    if (!metadata.overview) metadata.overview = match.overview;
                    if (!metadata.poster_url) metadata.poster_url = match.poster;
                    if (!metadata.fanart_url) metadata.fanart_url = match.backdrop;
                    metadata.tmdb_id = match.tmdb_id;
                    if (!metadata.year) metadata.year = parseInt(match.year);
                }
            } catch (err) { /* ignore */ }
        }

        // 4. 视频编码探测 - 改为异步后台处理 (Video 2.0 性能优化)
        // 扫描时不再同步调用 ffprobe，由后台 ScanQueueService 异步补全
        // 此处仅提取容器格式并标记 probe_status=0 (待探测)
        let container = null;
        if (videoFiles.length > 0) {
            const firstVideo = videoFiles[0].includes('|') ? videoFiles[0].split('|')[0] : videoFiles[0];
            const ext = firstVideo.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
            container = ext.replace('.', ''); // mp4, mkv, avi 等
        }
        metadata.container = container;
        metadata.probe_status = 0; // 0=待探测，将由后台队列处理

        // 写入数据库
        db.run(`
            INSERT OR REPLACE INTO netdisk_media 
            (source_id, path, title, original_title, year, overview, poster_url, fanart_url, rating, genres, media_type, tmdb_id, video_files, nfo_parsed, director, actor, area, tagline, studio, extra_metadata, v_codec, a_codec, duration, container, probe_status, is_locked, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            source.id, folder.path, metadata.title, metadata.original_title || null, metadata.year,
            metadata.overview, metadata.poster_url, metadata.fanart_url, metadata.rating, metadata.genres || null,
            metadata.media_type, metadata.tmdb_id, JSON.stringify(videoFiles), metadata.nfo_parsed,
            metadata.director, metadata.actor, metadata.area, metadata.tagline, metadata.studio,
            metadata.extra_metadata ? JSON.stringify(metadata.extra_metadata) : null,
            metadata.v_codec || null, metadata.a_codec || null, metadata.duration || 0,
            metadata.container || null, metadata.probe_status || 0, 0  // is_locked 默认 0
        ]);
    }

    parseTitle(name) {
        return name.replace(/[（(]\d{4}[)）]/g, '').replace(/\.\d{4}\./g, ' ').replace(/\./g, ' ').trim() || name;
    }

    parseYear(name) {
        const match = name.match(/[（(](\d{4})[)）]/) || name.match(/\.(\d{4})\./);
        return match ? parseInt(match[1]) : null;
    }

    isVideoFile(name) {
        const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
        return VIDEO_EXTENSIONS.includes(ext);
    }

    async fetchNfoContent(url, headers = {}) {
        if (url.startsWith('file://')) {
            const fs = require('fs/promises');
            const filePath = url.replace('file://', '');
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        }
        const res = await fetch(url, { headers, timeout: 10000 });
        return await res.text();
    }

    parseNfo(content, fallbackTitle) {
        try {
            let xmlBody = content.replace(/<\?xml[\s\S]*?\?>/i, '').trim();
            const rootMatch = xmlBody.match(/<(movie|tvshow|video|musicvideo)[^>]*>([\s\S]*?)<\/\1>/i);
            if (rootMatch) xmlBody = rootMatch[2].trim();

            const extra = {};
            const tagRegex = /<([a-zA-Z0-9_]+)[^>]*>([\s\S]*?)<\/\1>/gi;
            let match;

            while ((match = tagRegex.exec(xmlBody)) !== null) {
                const tag = match[1].toLowerCase();
                let value = match[2].trim();
                if (!value) continue;

                if (value.includes('<')) {
                    if (tag === 'actor') {
                        const name = value.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1].trim();
                        if (name) (extra['actor'] = extra['actor'] || []).push(name);
                    } else if (tag === 'ratings' || tag === 'rating') {
                        const val = value.match(/<value[^>]*>([\s\S]*?)<\/value>/i)?.[1].trim();
                        if (val) extra['rating'] = val;
                    } else if (tag === 'genre') {
                        (extra['genre'] = extra['genre'] || []).push(value.replace(/<[^>]+>/g, '').trim());
                    }
                } else {
                    if (extra[tag]) {
                        if (!Array.isArray(extra[tag])) extra[tag] = [extra[tag]];
                        extra[tag].push(value);
                    } else {
                        extra[tag] = value;
                    }
                }
            }

            const arrayFields = ['genre', 'director', 'actor'];
            arrayFields.forEach(f => { if (Array.isArray(extra[f])) extra[f] = extra[f].join(', '); });

            return {
                title: extra.title || fallbackTitle,
                original_title: extra.originaltitle || extra.original_title,
                year: parseInt(extra.year || extra.premiered) || null,
                overview: extra.plot || extra.outline || extra.summary,
                rating: parseFloat(extra.rating) || null,
                genres: extra.genre,
                director: extra.director,
                actor: extra.actor,
                area: extra.country || extra.region,
                tagline: extra.tagline,
                studio: extra.studio,
                media_type: content.includes('<tvshow>') ? 'tvshow' : 'movie',
                extra_metadata: extra
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * 获取已索引的媒体列表
     */
    getMedia(sourceId, options = {}) {
        const db = getDatabase();
        let sql = 'SELECT * FROM netdisk_media WHERE source_id = ?';
        const params = [sourceId];

        if (options.type && options.type !== 'all') {
            sql += ' AND media_type = ?';
            params.push(options.type);
        }

        // 按路径前缀筛选
        if (options.path) {
            sql += ' AND path LIKE ?';
            params.push(options.path + '%');
        }

        // NFO 筛选条件
        if (options.genres) {
            sql += ' AND genres LIKE ?';
            params.push('%' + options.genres + '%');
        }
        if (options.year) {
            sql += ' AND year = ?';
            params.push(parseInt(options.year));
        }
        if (options.area) {
            sql += ' AND area LIKE ?';
            params.push('%' + options.area + '%');
        }
        if (options.rating) {
            sql += ' AND rating >= ?';
            params.push(parseFloat(options.rating));
        }
        if (options.actor) {
            sql += ' AND actor LIKE ?';
            params.push('%' + options.actor + '%');
        }
        if (options.studio) {
            sql += ' AND studio LIKE ?';
            params.push('%' + options.studio + '%');
        }

        sql += ' ORDER BY title ASC';
        if (options.limit) { sql += ' LIMIT ?'; params.push(options.limit); }
        if (options.offset) { sql += ' OFFSET ?'; params.push(options.offset); }

        return db.all(sql, params).map(item => ({
            ...item,
            video_files: item.video_files ? JSON.parse(item.video_files) : [],
            genres: item.genres ? item.genres.split(', ') : [],
            extra_metadata: item.extra_metadata ? JSON.parse(item.extra_metadata) : {}
        }));
    }

    /**
     * 获取媒体总数（用于分页）
     */
    getMediaCount(sourceId, options = {}) {
        const db = getDatabase();
        let sql = 'SELECT COUNT(*) as count FROM netdisk_media WHERE source_id = ?';
        const params = [sourceId];

        if (options.type && options.type !== 'all') {
            sql += ' AND media_type = ?';
            params.push(options.type);
        }

        if (options.path) {
            sql += ' AND path LIKE ?';
            params.push(options.path + '%');
        }

        // NFO 筛选条件
        if (options.genres) {
            sql += ' AND genres LIKE ?';
            params.push('%' + options.genres + '%');
        }
        if (options.year) {
            sql += ' AND year = ?';
            params.push(parseInt(options.year));
        }
        if (options.area) {
            sql += ' AND area LIKE ?';
            params.push('%' + options.area + '%');
        }
        if (options.rating) {
            sql += ' AND rating >= ?';
            params.push(parseFloat(options.rating));
        }
        if (options.actor) {
            sql += ' AND actor LIKE ?';
            params.push('%' + options.actor + '%');
        }
        if (options.studio) {
            sql += ' AND studio LIKE ?';
            params.push('%' + options.studio + '%');
        }

        const result = db.get(sql, params);
        return result ? result.count : 0;
    }

    /**
     * 清除指定源的媒体索引
     */
    clearMedia(sourceId) {
        const db = getDatabase();
        db.run('DELETE FROM netdisk_media WHERE source_id = ?', [sourceId]);
    }

    getMediaById(id) {
        const db = getDatabase();
        const item = db.get('SELECT * FROM netdisk_media WHERE id = ?', [id]);
        if (!item) return null;
        return {
            ...item,
            video_files: item.video_files ? JSON.parse(item.video_files) : [],
            genres: item.genres ? item.genres.split(', ') : [],
            extra_metadata: item.extra_metadata ? JSON.parse(item.extra_metadata) : {}
        };
    }

    /**
     * 获取筛选选项（聚合统计）
     * @param {number} sourceId - 网盘源 ID
     * @param {string} path - 可选，按路径前缀筛选
     * @returns {Object} 筛选选项及其数量
     */
    getFilters(sourceId, path = null) {
        const db = getDatabase();
        const baseCondition = path
            ? 'WHERE source_id = ? AND path LIKE ?'
            : 'WHERE source_id = ?';
        const baseParams = path ? [sourceId, path + '%'] : [sourceId];

        // 获取所有媒体的原始数据用于聚合
        const allMedia = db.all(
            `SELECT genres, year, area, actor, studio FROM netdisk_media ${baseCondition}`,
            baseParams
        );

        // 聚合各类型
        const genresMap = new Map();
        const yearsMap = new Map();
        const areasMap = new Map();
        const actorsMap = new Map();
        const studiosMap = new Map();

        for (const item of allMedia) {
            // 处理 genres（逗号分隔）
            if (item.genres) {
                const genreList = item.genres.split(',').map(g => g.trim()).filter(Boolean);
                for (const genre of genreList) {
                    genresMap.set(genre, (genresMap.get(genre) || 0) + 1);
                }
            }

            // 处理年份
            if (item.year) {
                yearsMap.set(item.year, (yearsMap.get(item.year) || 0) + 1);
            }

            // 处理地区（可能是逗号分隔）
            if (item.area) {
                const areaList = item.area.split(/[,，/]/).map(a => a.trim()).filter(Boolean);
                for (const area of areaList) {
                    areasMap.set(area, (areasMap.get(area) || 0) + 1);
                }
            }

            // 处理演员（逗号分隔）
            if (item.actor) {
                const actorList = item.actor.split(/[,，]/).map(a => a.trim()).filter(Boolean);
                for (const actor of actorList) {
                    actorsMap.set(actor, (actorsMap.get(actor) || 0) + 1);
                }
            }

            // 处理制片厂（逗号分隔）
            if (item.studio) {
                const studioList = item.studio.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                for (const studio of studioList) {
                    studiosMap.set(studio, (studiosMap.get(studio) || 0) + 1);
                }
            }
        }

        // 转换为数组并排序
        const sortByCount = (a, b) => b.count - a.count;

        return {
            genres: Array.from(genresMap.entries())
                .map(([value, count]) => ({ value, count }))
                .sort(sortByCount),
            years: Array.from(yearsMap.entries())
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.value - a.value),  // 年份降序
            areas: Array.from(areasMap.entries())
                .map(([value, count]) => ({ value, count }))
                .sort(sortByCount),
            actors: Array.from(actorsMap.entries())
                .map(([value, count]) => ({ value, count }))
                .sort(sortByCount),
            studios: Array.from(studiosMap.entries())
                .map(([value, count]) => ({ value, count }))
                .sort(sortByCount)
        };
    }
}

const mediaScanService = new MediaScanService();
module.exports = { MediaScanService, mediaScanService };
