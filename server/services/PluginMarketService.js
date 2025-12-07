import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';

/**
 * 插件市场服务
 * 负责从远程仓库下载、安装、更新和卸载插件
 */
export class PluginMarketService {
    constructor(pluginsDir, pluginManager) {
        this.pluginsDir = pluginsDir;
        this.pluginManager = pluginManager;

        // 插件仓库配置 (GitHub或自定义服务器)
        this.registryUrl = process.env.PLUGIN_REGISTRY_URL ||
            'https://raw.githubusercontent.com/your-org/navlink-plugins/main/registry.json';

        // 本地缓存
        this.cachedRegistry = null;
        this.lastFetch = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5分钟
    }

    /**
     * 获取插件市场列表 (从远程注册表)
     */
    async getMarketPlugins() {
        const now = Date.now();

        // 使用缓存
        if (this.cachedRegistry && (now - this.lastFetch) < this.cacheDuration) {
            return this.enrichWithLocalStatus(this.cachedRegistry);
        }

        try {
            console.log('[PluginMarket] Fetching registry from URL:', this.registryUrl);
            const response = await this.fetchJson(this.registryUrl);
            this.cachedRegistry = response.plugins || [];
            this.lastFetch = now;

            return this.enrichWithLocalStatus(this.cachedRegistry);
        } catch (error) {
            console.error('[PluginMarket] Failed to fetch registry:', error.message);

            // 如果有缓存则返回缓存
            if (this.cachedRegistry) {
                return this.enrichWithLocalStatus(this.cachedRegistry);
            }

            // Fallback: 总是尝试加载本地模拟数据 (无论环境如何)
            console.log('[PluginMarket] Remote fetch failed, attempting to load mock data from docs...');
            try {
                const mockPath = path.join(process.cwd(), 'docs/plugin-registry-example.json');
                if (await fs.access(mockPath).then(() => true).catch(() => false)) {
                    const mockContent = await fs.readFile(mockPath, 'utf-8');
                    const mockData = JSON.parse(mockContent);
                    console.log('[PluginMarket] Successfully loaded mock data:', mockData.plugins?.length, 'plugins');
                    return this.enrichWithLocalStatus(mockData.plugins || []);
                } else {
                    console.warn('[PluginMarket] Mock file not found at:', mockPath);
                }
            } catch (err) {
                console.warn('[PluginMarket] Failed to load mock docs:', err);
            }

            throw new Error('Failed to fetch plugin registry and no local mock data found');
        }
    }

    /**
     * 为市场插件添加本地安装状态
     */
    enrichWithLocalStatus(marketPlugins) {
        const installedPlugins = this.pluginManager.getPlugins();
        const installedMap = new Map(installedPlugins.map(p => [p.id, p]));

        return marketPlugins.map(plugin => {
            const installed = installedMap.get(plugin.id);

            return {
                ...plugin,
                installed: !!installed,
                installedVersion: installed?.version,
                status: installed?.status || 'not_installed',
                updateAvailable: installed && this.isUpdateAvailable(installed.version, plugin.version)
            };
        });
    }

    /**
     * 检查是否有更新
     */
    isUpdateAvailable(currentVersion, latestVersion) {
        const current = this.parseVersion(currentVersion);
        const latest = this.parseVersion(latestVersion);

        return latest.major > current.major ||
            (latest.major === current.major && latest.minor > current.minor) ||
            (latest.major === current.major && latest.minor === current.minor && latest.patch > current.patch);
    }

    parseVersion(version) {
        const [major = 0, minor = 0, patch = 0] = (version || '0.0.0')
            .split('.')
            .map(v => parseInt(v) || 0);
        return { major, minor, patch };
    }

    /**
     * 下载并安装插件
     */
    async installPlugin(pluginId, options = {}) {
        console.log(`[PluginMarket] Installing plugin: ${pluginId} (Force: ${options.force})`);

        // 1. 从注册表获取插件信息
        const marketPlugins = await this.getMarketPlugins();
        const pluginInfo = marketPlugins.find(p => p.id === pluginId);

        if (!pluginInfo) {
            throw new Error(`Plugin ${pluginId} not found in registry`);
        }

        // Allow update if force is true
        if (!options.force && pluginInfo.installed) {
            throw new Error(`Plugin ${pluginId} is already installed`);
        }

        const pluginDir = path.join(this.pluginsDir, pluginId);

        // 2. 下载插件压缩包
        const downloadUrl = pluginInfo.downloadUrl;
        const tempFile = path.join(this.pluginsDir, `${pluginId}.zip`);

        try {
            await this.downloadFile(downloadUrl, tempFile);
            console.log(`[PluginMarket] Downloaded ${pluginId}`);

            // 3. 解压到插件目录
            await this.extractZip(tempFile, pluginDir);
            console.log(`[PluginMarket] Extracted to ${pluginDir}`);

            // 4. 验证manifest.json
            const manifestPath = path.join(pluginDir, 'manifest.json');
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);

            if (manifest.id !== pluginId) {
                throw new Error('Plugin ID mismatch');
            }

            //  4.1 为 Node.js 插件安装依赖
            if (manifest.type === 'node') {
                const backendDir = path.join(pluginDir, 'backend-nodejs');
                const packageJsonPath = path.join(backendDir, 'package.json');

                // 检查是否有 package.json
                try {
                    await fs.access(packageJsonPath);
                    console.log(`[PluginMarket] Installing dependencies for ${pluginId}...`);

                    // 运行 npm install
                    const { spawn } = await import('child_process');
                    await new Promise((resolve, reject) => {
                        const npm = spawn('npm', ['install', '--production'], {
                            cwd: backendDir,
                            shell: true
                        });

                        npm.on('close', (code) => {
                            if (code === 0) {
                                console.log(`[PluginMarket] ✓ Dependencies installed for ${pluginId}`);
                                resolve();
                            } else {
                                reject(new Error(`npm install failed with code ${code}`));
                            }
                        });

                        npm.on('error', reject);
                    });
                } catch (err) {
                    console.warn(`[PluginMarket] No package.json found for ${pluginId}, skipping npm install`);
                }
            }

            // 4.2 确保二进制文件有执行权限
            if (manifest.type === 'binary' && manifest.entry) {
                const binaryPath = path.join(pluginDir, manifest.entry);
                try {
                    await fs.chmod(binaryPath, 0o755);
                    console.log(`[PluginMarket] Set executable permissions for ${binaryPath}`);
                } catch (chmodError) {
                    console.warn(`[PluginMarket] Failed to set permissions for ${binaryPath}:`, chmodError);
                }
            }

            // 5. 重新扫描插件
            await this.pluginManager.loadPluginManifest(pluginId);

            // 6. 清理临时文件
            await fs.unlink(tempFile);

            console.log(`[PluginMarket] ✓ Plugin ${pluginId} installed successfully`);

            return {
                success: true,
                plugin: this.pluginManager.plugins.get(pluginId)
            };

        } catch (error) {
            // 清理失败的安装
            try {
                await fs.rm(pluginDir, { recursive: true, force: true });
                await fs.unlink(tempFile).catch(() => { });
            } catch (cleanupError) {
                console.error('[PluginMarket] Cleanup failed:', cleanupError);
            }

            throw new Error(`Failed to install plugin ${pluginId}: ${error.message}`);
        }
    }

    /**
     * 更新插件
     */
    async updatePlugin(pluginId) {
        console.log(`[PluginMarket] Updating plugin: ${pluginId}`);

        const plugin = this.pluginManager.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not installed`);
        }

        const wasRunning = plugin.status === 'running';

        // 1. 停止插件
        if (wasRunning) {
            await this.pluginManager.stopPlugin(pluginId);
        }

        // 2. 备份当前版本
        const pluginDir = path.join(this.pluginsDir, pluginId);
        const backupDir = path.join(this.pluginsDir, `${pluginId}.backup`);

        try {
            await fs.rename(pluginDir, backupDir);

            // 3. 重新安装 (Force install to bypass "already installed" check)
            await this.installPlugin(pluginId, { force: true });

            // 3.1. 恢复数据 (关键步骤)
            const backupDataDir = path.join(backupDir, 'data');
            const targetDataDir = path.join(pluginDir, 'data');

            if (await fs.access(backupDataDir).then(() => true).catch(() => false)) {
                console.log(`[PluginMarket] Restoring data for ${pluginId}...`);
                // 如果新安装的插件也有data目录，先删除（或者合并，这里选择覆盖以保留用户数据）
                await fs.rm(targetDataDir, { recursive: true, force: true }).catch(() => { });
                await fs.cp(backupDataDir, targetDataDir, { recursive: true });
            }

            // 4. 删除备份
            await fs.rm(backupDir, { recursive: true, force: true });

            // 5. 如果之前在运行,重新启动
            if (wasRunning) {
                await this.pluginManager.startPlugin(pluginId);
            }

            console.log(`[PluginMarket] ✓ Plugin ${pluginId} updated successfully`);
            return { success: true };

        } catch (error) {
            // 恢复备份
            try {
                await fs.rm(pluginDir, { recursive: true, force: true }).catch(() => { });
                await fs.rename(backupDir, pluginDir);

                // 重新加载
                await this.pluginManager.loadPluginManifest(pluginId);

                // 如果之前在运行,重新启动
                if (wasRunning) {
                    await this.pluginManager.startPlugin(pluginId);
                }
            } catch (rollbackError) {
                console.error('[PluginMarket] Rollback failed:', rollbackError);
            }

            throw new Error(`Failed to update plugin ${pluginId}: ${error.message}`);
        }
    }

    /**
     * 卸载插件
     */
    async uninstallPlugin(pluginId) {
        console.log(`[PluginMarket] Uninstalling plugin: ${pluginId}`);

        const plugin = this.pluginManager.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        // 1. 停止插件
        if (plugin.status === 'running') {
            await this.pluginManager.stopPlugin(pluginId);
        }

        // 2. 删除插件目录
        const pluginDir = path.join(this.pluginsDir, pluginId);
        await fs.rm(pluginDir, { recursive: true, force: true });

        // 3. 从内存中移除
        this.pluginManager.plugins.delete(pluginId);

        console.log(`[PluginMarket] ✓ Plugin ${pluginId} uninstalled successfully`);

        return { success: true };
    }

    /**
     * 下载文件
     */
    async downloadFile(url, destination) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'NavLink-PluginMarket/1.0',
                    ...(process.env.PLUGIN_REGISTRY_TOKEN ? { 'Authorization': `token ${process.env.PLUGIN_REGISTRY_TOKEN}` } : {})
                }
            }, (response) => {
                // 处理重定向
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.downloadFile(response.headers.location, destination)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                    return;
                }

                const file = createWriteStream(destination);
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    fs.unlink(destination).catch(() => { });
                    reject(err);
                });
            }).on('error', reject);
        });
    }

    /**
     * 解压ZIP文件
     */
    async extractZip(zipPath, destination) {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(destination, true);
    }

    /**
     * 从URL获取JSON
     */
    async fetchJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'NavLink-PluginMarket/1.0',
                    'Accept': 'application/json',
                    ...(process.env.PLUGIN_REGISTRY_TOKEN ? { 'Authorization': `token ${process.env.PLUGIN_REGISTRY_TOKEN}` } : {})
                }
            }, (response) => {
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
                        reject(new Error('Invalid JSON response'));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cachedRegistry = null;
        this.lastFetch = 0;
    }
}
