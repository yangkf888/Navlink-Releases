import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 系统更新服务
 * 负责检查版本更新、获取更新日志、触发系统升级
 */
export class UpdateService {
    constructor() {
        // GitHub 仓库配置
        this.owner = config.services.update.owner;
        this.repo = config.services.update.repo;
        this.githubApiBase = config.services.update.apiBase;

        // Docker 镜像配置
        this.imageRegistry = config.services.update.imageRegistry;
        this.imageName = `${this.imageRegistry}/${this.owner.toLowerCase()}/${this.repo.toLowerCase()}`;

        // 缓存配置
        this.cachedRelease = null;
        this.lastFetch = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5分钟缓存

        // 当前版本 (从 package.json 读取)
        this.currentVersion = null;

        // 更新状态 (用于通知)
        this.updateStatus = {
            hasUpdate: false,
            latestVersion: null,
            currentVersion: null,
            lastChecked: null,
            dismissed: false  // 用户是否已关闭通知
        };

        // 定时任务
        this.cronJob = null;
    }

    /**
     * 启动定时检查任务
     * 默认每天凌晨 4:00 检查一次
     */
    async startScheduledCheck() {
        // 动态导入 node-cron
        const cron = (await import('node-cron')).default;

        // 立即执行一次检查
        this.performScheduledCheck();

        // Schedule: 0 4 * * * (每天 04:00)
        this.cronJob = cron.schedule('0 4 * * *', () => {
            console.log('[UpdateService] Running scheduled update check...');
            this.performScheduledCheck();
        });

        console.log('[UpdateService] Scheduled daily update check at 04:00');
    }

    /**
     * 执行定时检查
     */
    async performScheduledCheck() {
        try {
            const result = await this.checkForUpdate();
            this.updateStatus = {
                hasUpdate: result.hasUpdate,
                latestVersion: result.latestVersion,
                currentVersion: result.currentVersion,
                lastChecked: result.checkedAt,
                dismissed: false  // 新版本时重置 dismissed 状态
            };

            if (result.hasUpdate) {
                console.log(`[UpdateService] New version available: ${result.latestVersion} (current: ${result.currentVersion})`);
            } else {
                console.log('[UpdateService] No update available');
            }
        } catch (error) {
            console.error('[UpdateService] Scheduled check failed:', error.message);
        }
    }

    /**
     * 获取更新通知状态（供前端调用）
     */
    getUpdateNotification() {
        return {
            hasUpdate: this.updateStatus.hasUpdate && !this.updateStatus.dismissed,
            latestVersion: this.updateStatus.latestVersion,
            currentVersion: this.updateStatus.currentVersion,
            lastChecked: this.updateStatus.lastChecked
        };
    }

    /**
     * 关闭更新通知
     */
    dismissUpdateNotification() {
        this.updateStatus.dismissed = true;
        return { success: true };
    }

    /**
     * 获取当前应用版本
     */
    async getCurrentVersion() {
        if (this.currentVersion) {
            return this.currentVersion;
        }

        try {
            const packagePath = path.join(__dirname, '../../package.json');
            const packageContent = await fs.readFile(packagePath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            this.currentVersion = packageJson.version;
            return this.currentVersion;
        } catch (error) {
            console.error('[UpdateService] Failed to read package.json:', error.message);
            return '0.0.0';
        }
    }

    /**
     * 获取最新发布版本信息
     */
    async getLatestRelease() {
        const now = Date.now();

        // 使用缓存
        if (this.cachedRelease && (now - this.lastFetch) < this.cacheDuration) {
            return this.cachedRelease;
        }

        try {
            const url = `${this.githubApiBase}/repos/${this.owner}/${this.repo}/releases/latest`;
            console.log('[UpdateService] Fetching latest release from:', url);

            const release = await this.fetchJson(url);

            this.cachedRelease = {
                version: release.tag_name?.replace(/^v/, '') || release.name,
                tagName: release.tag_name,
                name: release.name,
                body: release.body,
                publishedAt: release.published_at,
                htmlUrl: release.html_url,
                assets: release.assets?.map(asset => ({
                    name: asset.name,
                    downloadUrl: asset.browser_download_url,
                    size: asset.size
                })) || []
            };
            this.lastFetch = now;

            return this.cachedRelease;
        } catch (error) {
            console.error('[UpdateService] Failed to fetch latest release:', error.message);

            // 返回缓存数据
            if (this.cachedRelease) {
                return this.cachedRelease;
            }

            throw new Error('无法获取最新版本信息');
        }
    }

    /**
     * 获取所有发布版本列表
     */
    async getReleases(limit = 10) {
        try {
            const url = `${this.githubApiBase}/repos/${this.owner}/${this.repo}/releases?per_page=${limit}`;
            const releases = await this.fetchJson(url);

            return releases.map(release => ({
                version: release.tag_name?.replace(/^v/, '') || release.name,
                tagName: release.tag_name,
                name: release.name,
                body: release.body,
                publishedAt: release.published_at,
                htmlUrl: release.html_url,
                prerelease: release.prerelease,
                draft: release.draft
            }));
        } catch (error) {
            console.error('[UpdateService] Failed to fetch releases:', error.message);
            throw new Error('无法获取版本列表');
        }
    }

    /**
     * 检查是否有可用更新
     */
    async checkForUpdate() {
        const currentVersion = await this.getCurrentVersion();

        try {
            const latestRelease = await this.getLatestRelease();
            const hasUpdate = this.isNewer(latestRelease.version, currentVersion);

            return {
                currentVersion,
                latestVersion: latestRelease.version,
                hasUpdate,
                releaseInfo: hasUpdate ? latestRelease : null,
                checkedAt: new Date().toISOString()
            };
        } catch (error) {
            // 如果无法获取最新版本（如没有发布任何 Release），返回当前版本已是最新
            console.log('[UpdateService] No releases found, assuming current version is latest:', error.message);
            return {
                currentVersion,
                latestVersion: currentVersion,
                hasUpdate: false,
                releaseInfo: null,
                checkedAt: new Date().toISOString(),
                note: '暂无发布版本，当前版本为最新'
            };
        }
    }

    /**
     * 获取当前版本与最新版本之间的更新日志
     */
    async getChangelog(fromVersion = null) {
        const releases = await this.getReleases(20);
        const currentVersion = fromVersion || await this.getCurrentVersion();

        // 过滤出比当前版本新的发布
        const newReleases = releases.filter(release =>
            this.isNewer(release.version, currentVersion)
        );

        return newReleases.map(release => ({
            version: release.version,
            name: release.name,
            changelog: release.body,
            publishedAt: release.publishedAt
        }));
    }

    /**
     * 获取版本详细信息
     */
    async getVersionInfo() {
        const currentVersion = await this.getCurrentVersion();

        return {
            version: currentVersion,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            env: process.env.NODE_ENV || 'development',
            dockerImage: this.imageName
        };
    }

    /**
     * 比较版本号，判断 version1 是否比 version2 更新
     */
    isNewer(version1, version2) {
        const v1 = this.parseVersion(version1);
        const v2 = this.parseVersion(version2);

        if (v1.major !== v2.major) return v1.major > v2.major;
        if (v1.minor !== v2.minor) return v1.minor > v2.minor;
        return v1.patch > v2.patch;
    }

    /**
     * 解析版本号
     */
    parseVersion(version) {
        const cleanVersion = (version || '0.0.0').replace(/^v/, '');
        const [major = 0, minor = 0, patch = 0] = cleanVersion
            .split('.')
            .map(v => parseInt(v) || 0);
        return { major, minor, patch };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cachedRelease = null;
        this.lastFetch = 0;
        this.currentVersion = null;
    }

    /**
     * 从 URL 获取 JSON 数据
     */
    async fetchJson(url) {
        return new Promise((resolve, reject) => {
            // ⚠️ 安全警告：
            // 尽量避免使用硬编码 Token。如果必须使用，请确保该 Token 只有只读权限。
            const options = {
                headers: {
                    'User-Agent': 'NavLink-UpdateService/1.0',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            // 只有在配置了 Token 时才添加 Authorization 头
            // 对于公共仓库 (Navlink-Releases)，通常不需要 Token
            const token = process.env.GITHUB_TOKEN || process.env.PLUGIN_REGISTRY_TOKEN;
            if (token) {
                options.headers['Authorization'] = `token ${token}`;
            }

            https.get(url, options, (response) => {
                // 处理重定向
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.fetchJson(response.headers.location)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode === 404) {
                    reject(new Error('未找到版本信息 (404)'));
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error('无效的 JSON 响应'));
                    }
                });
            }).on('error', reject);
        });
    }
}

// 导出单例
export const updateService = new UpdateService();
