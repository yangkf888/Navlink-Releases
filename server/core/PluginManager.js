import fs from 'fs/promises';
import path from 'path';
import { ProcessManager } from './ProcessManager.js';
import { HandshakeManager } from './HandshakeManager.js';
import { HealthChecker } from './HealthChecker.js';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('插件管理');

// 插件启动阶段定义
const STARTUP_PHASES = {
    INITIALIZING: { step: 1, total: 4, message: '正在初始化...' },
    STARTING: { step: 2, total: 4, message: '正在启动插件服务...' },
    HEALTH_CHECK: { step: 3, total: 4, message: '正在进行健康检查...' },
    READY: { step: 4, total: 4, message: '运行中' },
    FAILED: { step: 0, total: 4, message: '启动失败' }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载固定端口配置
let PLUGIN_PORTS = {};
try {
    const portsPath = path.join(__dirname, '../config/plugin-ports.json');
    const portsContent = await fs.readFile(portsPath, 'utf-8');
    PLUGIN_PORTS = JSON.parse(portsContent);
    logger.debug('[PluginManager] Loaded fixed port configuration:', PLUGIN_PORTS);
} catch (err) {
    logger.warn('[PluginManager] Failed to load plugin-ports.json, using dynamic ports');
}

export class PluginManager {
    constructor(pluginsDir, app, context, io) {
        this.pluginsDir = pluginsDir;
        this.app = app; // Express app instance
        this.context = context || {}; // Shared context for plugins
        this.io = io; // Socket.IO instance
        this.processManager = new ProcessManager();
        this.handshakeManager = new HandshakeManager();
        this.healthChecker = new HealthChecker(this);
        this.plugins = new Map(); // pluginId -> pluginConfig
    }

    /**
     * 推送插件启动进度
     */
    emitStartupProgress(pluginId, phase, error = null) {
        if (!this.io) return;

        const phaseInfo = STARTUP_PHASES[phase];
        const data = {
            pluginId,
            phase,
            step: phaseInfo.step,
            total: phaseInfo.total,
            message: phaseInfo.message,
            progress: Math.round((phaseInfo.step / phaseInfo.total) * 100),
            timestamp: new Date().toISOString()
        };

        if (error) {
            data.error = error;
        }

        logger.debug(`[${pluginId}] ${phaseInfo.message}`);
        this.io.emit('plugin:startup:progress', data);

        // 更新插件状态
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.startupPhase = phase;
            plugin.startupMessage = phaseInfo.message;
        }
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
                logger.debug(`[PluginManager] Plugin ${id} enabled: ${plugin.enabled}`);
            }

            logger.info(`Scanned ${this.plugins.size} plugins.`);
        } catch (error) {
            logger.error('Error scanning plugins:', error);
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

            // 保留已存在插件的运行状态
            const existingPlugin = this.plugins.get(pluginId);

            this.plugins.set(pluginId, {
                ...manifest,
                dir: path.join(this.pluginsDir, pluginId),
                // 保留原有状态，如果插件正在运行
                status: existingPlugin?.status || 'stopped',
                port: existingPlugin?.port,
                mode: existingPlugin?.mode,
                instance: existingPlugin?.instance,
                startupPhase: existingPlugin?.startupPhase,
                startupMessage: existingPlugin?.startupMessage
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

        try {
            // 阶段1: 初始化
            plugin.status = 'starting';
            this.emitStartupProgress(pluginId, 'INITIALIZING');

            const entryPoint = path.join(plugin.dir, plugin.entry);

            // 进程内加载 Node.js 插件
            if (plugin.type === 'node') {
                try {
                    logger.info(`加载进程内插件: ${pluginId}`);

                    // 阶段2: 启动
                    this.emitStartupProgress(pluginId, 'STARTING');

                    // 动态导入插件入口
                    const pluginModule = await import(entryPoint);

                    // 初始化插件，传入上下文
                    if (pluginModule.default && typeof pluginModule.default.init === 'function') {
                        const router = await pluginModule.default.init(this.context);
                        plugin.instance = router;

                        if (this.app) {
                            logger.info(`挂载插件 ${pluginId} 到 /api/plugins/${pluginId}`);

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
                            logger.info(`✓ 插件 ${pluginId} 已挂载到 /api/plugins/${pluginId}`);
                            logger.info(`  💡 首次启动可能较慢，插件需要初始化数据库和加载依赖，请耐心等待或者过一会再刷新！`);

                            // 添加调试路由
                            this.app.get(`/api/plugins/${pluginId}/debug`, (req, res) => {
                                res.json({
                                    pluginId,
                                    message: 'Plugin route is working',
                                    timestamp: new Date().toISOString()
                                });
                            });
                        } else {
                            logger.error(`Express 应用不可用，无法挂载插件 ${pluginId}`);
                        }
                    } else if (pluginModule.init && typeof pluginModule.init === 'function') {
                        const router = await pluginModule.init(this.context);
                        plugin.instance = router;
                        if (this.app) {
                            const statusCheckMiddleware = (req, res) => {
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
                            logger.info(`✓ 插件 ${pluginId} 已挂载到 /api/plugins/${pluginId}`);
                        }
                    } else {
                        logger.warn(`插件 ${pluginId} 未导出 init 函数`);
                    }

                    // 阶段3: 健康检查（进程内插件跳过）
                    // 阶段4: 就绪
                    plugin.status = 'running';
                    plugin.mode = 'in-process';
                    this.emitStartupProgress(pluginId, 'READY');

                    // Persist state
                    await this.savePluginState(pluginId, true);

                    return 0; // 进程内插件没有端口
                } catch (error) {
                    logger.error(`加载进程内插件 ${pluginId} 失败:`, error);
                    plugin.status = 'failed';
                    this.emitStartupProgress(pluginId, 'FAILED', error.message);
                    throw error;
                }
            }

            // 二进制插件继续使用子进程模式
            const fixedPort = PLUGIN_PORTS[pluginId];
            const preferredPort = fixedPort || plugin.port;

            if (fixedPort) {
                logger.info(`使用固定端口 ${fixedPort} 启动 ${pluginId}`);
            } else if (preferredPort) {
                logger.info(`使用清单端口 ${preferredPort} 启动 ${pluginId}`);
            }

            // 阶段2: 启动进程
            this.emitStartupProgress(pluginId, 'STARTING');

            const port = await this.processManager.startPlugin(
                pluginId,
                entryPoint,
                plugin.type,
                plugin.dir,
                preferredPort
            );

            // 阶段3: 健康检查
            this.emitStartupProgress(pluginId, 'HEALTH_CHECK');

            // 等待一小段时间让插件完全启动
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 直接标记为运行中
            plugin.status = 'running';
            plugin.mode = 'process';
            plugin.port = port;

            // 阶段4: 就绪
            this.emitStartupProgress(pluginId, 'READY');
            logger.info(`✓ 插件 ${pluginId} 已在端口 ${port} 上启动`);

            // Persist state
            await this.savePluginState(pluginId, true);

            return port;

        } catch (error) {
            plugin.status = 'failed';
            plugin.failureReason = error.message;
            this.emitStartupProgress(pluginId, 'FAILED', error.message);
            logger.error(`插件 ${pluginId} 启动失败:`, error);
            throw error;
        }
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
