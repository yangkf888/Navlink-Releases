/**
 * AList 网盘服务
 * 用于读取 OpenList/AList 网盘中的视频文件
 */

class AlistService {
    constructor(baseUrl, password = '') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.password = password;
        this.token = null;
    }

    /**
     * 登录获取 Token
     */
    async login() {
        if (!this.password) {
            return true; // 无密码直接访问
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: this.password
                })
            });

            const result = await response.json();
            if (result.code === 200) {
                this.token = result.data.token;
                return true;
            }
            return false;
        } catch (error) {
            console.error('[AList] Login failed:', error);
            return false;
        }
    }

    /**
     * 获取目录列表
     * @param {string} path - 目录路径
     */
    async list(path = '/') {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (this.token) {
                headers['Authorization'] = this.token;
            }

            const response = await fetch(`${this.baseUrl}/api/fs/list`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    path,
                    password: '',
                    page: 1,
                    per_page: 0,
                    refresh: false
                })
            });

            const result = await response.json();
            if (result.code === 200) {
                return result.data.content || [];
            }
            return [];
        } catch (error) {
            console.error('[AList] List failed:', error);
            return [];
        }
    }

    /**
     * 获取文件详情（含直链）
     * @param {string} path - 文件路径
     */
    async getFileInfo(path) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (this.token) {
                headers['Authorization'] = this.token;
            }

            const response = await fetch(`${this.baseUrl}/api/fs/get`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ path, password: '' })
            });

            const result = await response.json();
            if (result.code === 200) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error('[AList] Get file info failed:', error);
            return null;
        }
    }

    /**
     * 递归获取视频文件列表
     * @param {string} path - 起始路径
     * @param {number} depth - 递归深度
     */
    async getVideoFiles(path = '/', depth = 3) {
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m3u8', '.ts'];
        const videos = [];

        const processDirectory = async (dirPath, currentDepth) => {
            if (currentDepth > depth) return;

            const items = await this.list(dirPath);

            for (const item of items) {
                const itemPath = `${dirPath}/${item.name}`.replace(/\/+/g, '/');

                if (item.is_dir) {
                    await processDirectory(itemPath, currentDepth + 1);
                } else {
                    const ext = item.name.toLowerCase().match(/\.[^.]+$/)?.[0];
                    if (ext && videoExtensions.includes(ext)) {
                        videos.push({
                            name: item.name,
                            path: itemPath,
                            size: item.size,
                            modified: item.modified,
                            // 从目录名推断信息
                            ...this.parseFileName(item.name, dirPath)
                        });
                    }
                }
            }
        };

        await processDirectory(path, 1);
        return videos;
    }

    /**
     * 从文件名解析影片信息
     */
    parseFileName(fileName, dirPath) {
        // 移除扩展名
        const name = fileName.replace(/\.[^.]+$/, '');

        // 尝试匹配年份
        const yearMatch = name.match(/[（(](\d{4})[)）]/) || name.match(/\.(\d{4})\./);
        const year = yearMatch ? yearMatch[1] : null;

        // 尝试匹配集数
        const episodeMatch = name.match(/[eE](\d+)/) || name.match(/第(\d+)集/);
        const episode = episodeMatch ? parseInt(episodeMatch[1]) : null;

        // 清理标题
        let title = name
            .replace(/\.\d{4}\..*$/, '') // 移除 .年份.xxx
            .replace(/[（(]\d{4}[)）].*$/, '') // 移除 (年份)xxx
            .replace(/\./g, ' ')
            .trim();

        return { title, year, episode };
    }

    /**
     * 获取播放链接
     */
    async getPlayUrl(path) {
        const fileInfo = await this.getFileInfo(path);
        if (fileInfo && fileInfo.raw_url) {
            return fileInfo.raw_url;
        }
        // 返回 AList 的代理链接
        return `${this.baseUrl}/d${path}`;
    }
}

module.exports = { AlistService };
