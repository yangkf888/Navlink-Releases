import fs from 'fs/promises';
import path from 'path';
import { ProcessManager } from './ProcessManager.js';
import { HandshakeManager } from './HandshakeManager.js';
import { HealthChecker } from './HealthChecker.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载固定端口配置
let PLUGIN_PORTS = {};
try {
    const portsPath = path.join(__dirname, '../config/plugin-ports.json');
    const portsContent = await fs.readFile(portsPath, 'utf-8');
    PLUGIN_PORTS = JSON.parse(portsContent);
    console.log('[PluginManager] Loaded fixed port configuration:', PLUGIN_PORTS);
} catch (err) {
    console.warn('[PluginManager] Failed to load plugin-ports.json, using dynamic ports');
}

export class PluginManager {
    constructor(pluginsDir, app, context) {
        this.pluginsDir = pluginsDir;
        this.app = app; // Express app instance
        this.context = context || {}; // Shared context for plugins
        this.processManager = new ProcessManager();
        this.handshakeManager = new HandshakeManager();
        this.healthChecker = new HealthChecker(this);
        this.plugins = new Map(); // pluginId -> pluginConfig
    }

    /**
     * Scan for installed plugins
     */
    async scanPlugins() {
        try {
            const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
            const pluginDirs = entries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

            for (const dir of pluginDirs) {
                await this.loadPluginManifest(dir);
            }

            // Load and apply persistent states
            const states = await this.loadPluginStates();
            for (const [id, plugin] of this.plugins) {
                // If state is explicitly false, set enabled to false. Otherwise true.
                plugin.enabled = states[id] !== false;
                console.log(`[PluginManager] Plugin ${id} enabled: ${plugin.enabled}`);
            }

            console.log(`Scanned ${this.plugins.size} plugins.`);
        } catch (error) {
            console.error('Error scanning plugins:', error);
        }
    }

    /**
     * Load manifest.json for a plugin
     */
    async loadPluginManifest(pluginId) {
        try {
            const manifestPath = path.join(this.pluginsDir, pluginId, 'manifest.json');
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);

            // Basic validation
            if (!manifest.id || !manifest.entry || !manifest.type) {
                console.warn(`Invalid manifest for plugin ${pluginId}`);
                return;
            }

            this.plugins.set(pluginId, {
                ...manifest,
                dir: path.join(this.pluginsDir, pluginId),
                status: 'stopped'
            });
        } catch (error) {
            // Ignore if manifest doesn't exist (might be a non-plugin folder)
        }
    }

    /**
     * Start a specific plugin
     */
    /**
     * Start a specific plugin
     */
    /**
     * Start a specific plugin
     */
    async startPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        const entryPoint = path.join(plugin.dir, plugin.entry);

        // 进程内加载 Node.js 插件
        if (plugin.type === 'node') {
            try {
                console.log(`[PluginManager] Loading in-process plugin: ${pluginId}`);
                // 动态导入插件入口
                const pluginModule = await import(entryPoint);

                // 初始化插件，传入上下文
                // 注意：这里假设插件导出了 init 方法并返回 express.Router
                if (pluginModule.default && typeof pluginModule.default.init === 'function') {
                    const router = await pluginModule.default.init(this.context); // 需要在构造函数中传入context
                    // 挂载路由: /api/plugins/<pluginId> -> Plugin Router
                    // 注意：这里我们使用 /api/plugins/<pluginId> 作为统一前缀
                    // 但为了兼容现有前端代码，我们可能需要保留 /api/<pluginId> 或者让前端改
                    // 根据之前的讨论，前端请求的是 /apps/sub/api/subscriptions -> Gateway重写为 /api/subscriptions -> 转发给插件
                    // 现在Gateway直接挂载，路径应该是 /api/plugins/sub/subscriptions
                    // 或者为了兼容，我们挂载到 /api/plugins/sub，然后让前端请求 /api/plugins/sub/...

                    // 实际上，为了保持兼容性，我们可以挂载到 /api/plugins/<pluginId>
                    // 并且在 server.js 中配置 rewrite 规则，将 /apps/<pluginId>/api/* 重写为 /api/plugins/<pluginId>/*

                    // 暂时挂载到 /api/plugins/<pluginId>
                    // 注意：this.app 需要在构造函数中传入
                    if (this.app) {
                        console.log(`[PluginManager] Mounting plugin ${pluginId} at /api/plugins/${pluginId}`);
                        console.log(`[PluginManager] Router type:`, typeof router);
                        console.log(`[PluginManager] Router keys:`, Object.keys(router));
                        // 状态检查中间件
                        const statusCheckMiddleware = (req, res, next) => {
                            const plugin = this.plugins.get(pluginId);
                            if (!plugin || plugin.status !== 'running') {
                                return res.status(503).json({
                                    error: 'Plugin not available',
                                    message: `Plugin ${pluginId} is currently stopped`
                                });
                            }
                            next();
                        };

                        this.app.use(`/api/plugins/${pluginId}`, statusCheckMiddleware, router);
                        console.log(`[PluginManager] ✓ Plugin ${pluginId} mounted at /api/plugins/${pluginId}`);

                        // 添加调试路由
                        this.app.get(`/api/plugins/${pluginId}/debug`, (req, res) => {
                            res.json({
                                pluginId,
                                message: 'Plugin route is working',
                                timestamp: new Date().toISOString()
                            });
                        });

                        // 添加另一个调试路由
                        this.app.get(`/api/plugins/${pluginId}/test`, (req, res) => {
                            res.json({
                                pluginId,
                                message: 'Test route working',
                                timestamp: new Date().toISOString()
                            });
                        });
                    } else {
                        console.error(`[PluginManager] Express app not available for plugin ${pluginId}`);
                    }
                } else {
                    // 尝试兼容旧的 module.exports = { init: ... } 格式 (CommonJS)
                    // 但由于我们是 ESM 环境，import() 应该能处理 CommonJS
                    if (pluginModule.init && typeof pluginModule.init === 'function') {
                        const router = await pluginModule.init(this.context);
                        if (this.app) {
                            // 状态检查中间件
                            const statusCheckMiddleware = (req, res, next) => {
                                const plugin = this.plugins.get(pluginId);
                                if (!plugin || plugin.status !== 'running') {
                                    return res.status(503).json({
                                        error: 'Plugin not available',
                                        message: `Plugin ${pluginId} is currently stopped`
                                    });
                                }
                                next();
                            };

                            this.app.use(`/api/plugins/${pluginId}`, statusCheckMiddleware, router);
                            console.log(`[PluginManager] ✓ Plugin ${pluginId} mounted at /api/plugins/${pluginId}`);
                        }
                    } else {
                        console.warn(`[PluginManager] Plugin ${pluginId} does not export init function`);
                    }
                }

                plugin.status = 'running';
                plugin.mode = 'in-process';

                // Persist state
                await this.savePluginState(pluginId, true);

                return 0; // 进程内插件没有端口
            } catch (error) {
                console.error(`[PluginManager] Failed to load in-process plugin ${pluginId}:`, error);
                throw error;
            }
        }

        // 二进制插件继续使用子进程模式

        // 优先使用固定端口配置
        const fixedPort = PLUGIN_PORTS[pluginId];
        const preferredPort = fixedPort || plugin.port; // manifest.json中也可以配置

        if (fixedPort) {
            console.log(`[PluginManager] Using fixed port ${fixedPort} for ${pluginId}`);
        } else if (preferredPort) {
            console.log(`[PluginManager] Using manifest port ${preferredPort} for ${pluginId}`);
        }

        const port = await this.processManager.startPlugin(
            pluginId,
            entryPoint,
            plugin.type,
            plugin.dir,
            preferredPort
        );

        // 直接标记为运行中(简化版本,跳过握手)
        plugin.status = 'running';
        plugin.mode = 'process';
        plugin.port = port;

        console.log(`[PluginManager] ✓ Plugin ${pluginId} started on port ${port}`);

        // Persist state
        await this.savePluginState(pluginId, true);

        return port;
    }

    /**
     * Stop a specific plugin
     */
    async stopPlugin(pluginId) {
        console.log(`[PluginManager] Stopping plugin ${pluginId}...`);
        // 清除握手记录
        this.handshakeManager.clearHandshake(pluginId);

        await this.processManager.stopPlugin(pluginId);
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.status = 'stopped';
            plugin.port = undefined;
            plugin.handshakeInfo = undefined;
            console.log(`[PluginManager] Plugin ${pluginId} marked as stopped.`);

            // Persist state
            await this.savePluginState(pluginId, false);
        }
    }

    /**
     * Save plugin state to file
     */
    async savePluginState(pluginId, enabled) {
        try {
            const statesPath = path.join(process.cwd(), 'data', 'plugin-states.json');
            let states = {};
            try {
                const content = await fs.readFile(statesPath, 'utf-8');
                states = JSON.parse(content);
            } catch (e) {
                // Ignore read error (file may not exist)
            }

            states[pluginId] = enabled;

            // Ensure data dir exists
            await fs.mkdir(path.dirname(statesPath), { recursive: true });
            await fs.writeFile(statesPath, JSON.stringify(states, null, 2));
        } catch (error) {
            console.error('[PluginManager] Failed to save plugin state:', error);
        }
    }

    /**
     * Load plugin states
     */
    async loadPluginStates() {
        try {
            const statesPath = path.join(process.cwd(), 'data', 'plugin-states.json');
            const content = await fs.readFile(statesPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    }

    /**
     * Get all plugins info
     */
    getPlugins() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get active plugin info (for proxy)
     */
    getActivePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.status === 'running') {
            return plugin;
        }
        return null;
    }
}
