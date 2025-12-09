import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PluginManager } from './server/core/PluginManager.js';
import { PluginMarketService } from './server/services/PluginMarketService.js';
import { ServiceRegistry } from './server/core/ServiceRegistry.js';
import { createPluginRouter, handlePluginWebSocket } from './server/core/PluginRouter.js';
import { initAuthDB } from './server/database/initAuthDB.js';
import { initConfigDB } from './server/database/initConfigDB.js';
import { AuthService } from './server/services/AuthService.js';
import { TenantService } from './server/services/TenantService.js';
import cacheService from './server/services/CacheService.js';
import { authenticateToken, requireAdmin, optionalAuth, requirePermission } from './server/middleware/auth.js';
import { enforceTenantIsolation, injectTenantId, checkTenantStatus, requireSuperAdmin } from './server/middleware/tenantIsolation.js';
import { PERMISSIONS, getRolePermissions, getAllRoles, updateRolePermissions } from './server/config/permissions.js';
import logger, { createLogger, LogQuery } from './server/utils/logger.js';
import config, { validateConfig, displayConfig } from './server/config/env.js';
import {
    helmetConfig,
    hppProtection,
    validateInput,
    loginRateLimiter,
    apiRateLimiter,
    securityLogger
} from './server/middleware/security.js';
import { cacheMiddleware, tenantCacheMiddleware, invalidateCacheMiddleware } from './server/middleware/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;
const authService = new AuthService();
const tenantService = new TenantService();

// 创建各个模块的logger
const serverLogger = createLogger('Server');
const proxyLogger = createLogger('Proxy');
const authLogger = createLogger('Auth');
const securityLoggerMiddleware = securityLogger(authLogger);

// Initialize Plugin Manager
const pluginsDir = path.join(__dirname, 'plugins');
const DATA_DIR = path.join(process.cwd(), 'data');
// 构建全局上下文传给插件
const pluginContext = {
    db: {
        // 传递主应用的数据库连接或工具，如果需要
        // 目前插件各自管理数据库，这里可以传一些共享工具
    },
    logger: createLogger('Plugin'),
    config: config,
    authService: authService, // 允许插件使用主应用的认证服务
    tenantService: tenantService
};
const pluginManager = new PluginManager(pluginsDir, app, pluginContext);
const pluginMarketService = new PluginMarketService(pluginsDir, pluginManager);

// 初始化服务注册中心
const serviceRegistry = new ServiceRegistry();
serverLogger.info('Service Registry initialized');

// 启动服务健康检查
serviceRegistry.startHealthCheck();

// --- Security Middleware (MUST BE FIRST) ---
// Helmet - Security headers
app.use(helmetConfig);

// Security Logger - Audit trail
app.use(securityLoggerMiddleware);

// HPP Protection - HTTP Parameter Pollution
app.use(hppProtection);

// ==========================================================================
// 插件静态文件服务 - /apps/:pluginId/*
// 这个必须在body parser之前，因为它不需要解析body
// ==========================================================================
app.use('/apps/:pluginId', (req, res, next) => {
    const pluginId = req.params.pluginId;
    const plugin = pluginManager.getActivePlugin(pluginId);

    if (!plugin) {
        return res.status(404).send('Plugin not found');
    }

    // 只对API请求进行认证，静态文件不需要
    const isApiRequest = req.path.startsWith('/api');
    if (isApiRequest) {
        return authenticateToken(req, res, () => {
            handlePluginRequest(req, res, next, plugin, pluginId);
        });
    }

    handlePluginRequest(req, res, next, plugin, pluginId);
});

function handlePluginRequest(req, res, next, plugin, pluginId) {
    // 进程内插件: 直接服务静态文件
    if (plugin.mode === 'in-process') {
        const distPath = path.join(plugin.dir, 'frontend', 'dist');

        // 服务静态文件
        express.static(distPath)(req, res, (err) => {
            if (err) return next(err);

            // SPA Fallback: 返回 index.html (非API请求)
            if (!req.path.startsWith('/api') && req.accepts('html')) {
                res.sendFile(path.join(distPath, 'index.html'), (err) => {
                    if (err) next(err);
                });
            } else {
                next(); // 让其他中间件处理
            }
        });
        return;
    }

    // 进程外插件 (VPS): 代理到插件端口
    createProxyMiddleware({
        target: `http://localhost:${plugin.port}`,
        changeOrigin: true,
        pathRewrite: {
            [`^/apps/${pluginId}`]: '',
        },
        onProxyReq: (proxyReq, req, res) => {
            // 注入用户上下文headers（如果已认证）
            if (req.user) {
                proxyReq.setHeader('X-Nav-User-Id', req.user.id);
                proxyReq.setHeader('X-Nav-Tenant-Id', req.user.tenantId);
                proxyReq.setHeader('X-Nav-User-Role', req.user.role);
                proxyReq.setHeader('X-Nav-Username', req.user.username);
            }
        }
    })(req, res, next);
}

// ==========================================================================
// Global Middleware (POST-Plugin Static)
// ==========================================================================
app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials
}));
app.use(express.json({ limit: '10mb' }));

// Input Validation - XSS Protection
app.use(validateInput);

// ==========================================================================
// Plugin Market API
// ==========================================================================
app.get('/api/market/plugins', authenticateToken, async (req, res) => {
    try {
        const plugins = await pluginMarketService.getMarketPlugins();
        res.json(plugins);
    } catch (error) {
        serverLogger.error(`Failed to fetch market plugins: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch plugins' });
    }
});

app.post('/api/market/install', authenticateToken, async (req, res) => {
    try {
        const { pluginId } = req.body;
        if (!pluginId) return res.status(400).json({ error: 'Plugin ID required' });

        const result = await pluginMarketService.installPlugin(pluginId);
        res.json(result);
    } catch (error) {
        serverLogger.error(`Failed to install plugin: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================================================
// Auth Routes
// ==========================================================================


// --- Core Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '2.0.0', mode: 'gateway' });
});

// --- Plugin Management ---
// Get all plugins - 认证用户可访问 + 缓存
app.get('/api/plugins', authenticateToken, cacheMiddleware({ ttl: 60 }), (req, res) => {
    res.json(pluginManager.getPlugins());
});

// Start a plugin - 仅管理员
app.post('/api/plugins/:id/start', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const port = await pluginManager.startPlugin(req.params.id);
        res.json({ success: true, port });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop a plugin - 仅管理员
app.post('/api/plugins/:id/stop', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pluginManager.stopPlugin(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 服务注册中心 API ---
// 插件自注册接口
app.post('/api/registry/register', express.json(), (req, res) => {
    try {
        const result = serviceRegistry.register(req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 取消注册
app.post('/api/registry/unregister/:id', (req, res) => {
    const result = serviceRegistry.unregister(req.params.id);
    res.json(result);
});

// 获取注册服务列表
app.get('/api/registry/services', authenticateToken, requireAdmin, (req, res) => {
    const services = serviceRegistry.list();
    res.json(services);
});

// 获取服务统计
app.get('/api/registry/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = serviceRegistry.getStats();
    res.json(stats);
});

// --- 统一插件路由 (新增) ---
// 格式: /plugin/{pluginId}/*
app.use('/plugin', authenticateToken, createPluginRouter(serviceRegistry));

// --- Plugin Market API ---

// 获取插件市场列表 (包含安装状态)
app.get('/api/plugin-market', authenticateToken, async (req, res) => {
    try {
        const plugins = await pluginMarketService.getMarketPlugins();
        res.json(plugins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 安装插件 - 仅管理员
app.post('/api/plugin-market/:id/install', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pluginMarketService.installPlugin(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新插件 - 仅管理员
app.post('/api/plugin-market/:id/update', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pluginMarketService.updatePlugin(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 卸载插件 - 仅管理员
app.delete('/api/plugin-market/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pluginMarketService.uninstallPlugin(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 刷新插件市场缓存 - 仅管理员
app.post('/api/plugin-market/refresh', authenticateToken, requireAdmin, async (req, res) => {
    try {
        pluginMarketService.clearCache();
        const plugins = await pluginMarketService.getMarketPlugins();
        res.json({ success: true, plugins });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rescan plugins and restart changed ones - 仅管理员 + 失效缓存
app.post('/api/plugins/rescan',
    authenticateToken,
    requireAdmin,
    invalidateCacheMiddleware(['api:*']),
    async (req, res) => {
        try {
            console.log('[Rescan] Rescanning all plugins...');

            // Get current plugin states before rescan
            const oldPlugins = new Map(pluginManager.plugins);

            // Rescan manifests
            await pluginManager.scanPlugins();

            // Restart plugins that changed
            for (const [id, plugin] of pluginManager.plugins) {
                const oldPlugin = oldPlugins.get(id);

                // Check if plugin type or entry changed
                if (oldPlugin &&
                    (oldPlugin.type !== plugin.type || oldPlugin.entry !== plugin.entry)) {
                    console.log(`[Rescan] Plugin ${id} configuration changed, restarting...`);

                    // Stop old version if running
                    if (oldPlugin.status === 'running') {
                        try {
                            await pluginManager.stopPlugin(id);
                        } catch (err) {
                            console.error(`[Rescan] Failed to stop ${id}:`, err);
                        }
                    }

                    // Start new version if it should be auto-started
                    // For now, we'll auto-start all plugins that were previously running
                    if (oldPlugin.status === 'running') {
                        try {
                            await pluginManager.startPlugin(id);
                            console.log(`[Rescan] Plugin ${id} restarted on port ${plugin.port}`);
                        } catch (err) {
                            console.error(`[Rescan] Failed to start ${id}:`, err);
                        }
                    }
                }
            }

            res.json({ success: true, message: 'Plugins rescanned successfully' });
        } catch (error) {
            console.error('[Rescan] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

// ==========================================================================
// 配置管理 - 使用 SiteConfigDAO (单表 JSON 存储)
// ==========================================================================
import siteConfigDAO from './server/database/dao/SiteConfigDAO.js';

// 获取配置 - 添加缓存
app.get('/api/config', cacheMiddleware({ ttl: 300, keyPrefix: 'config:' }), async (req, res) => {
    try {
        const configData = await siteConfigDAO.getConfig();
        res.json(configData || {});
    } catch (error) {
        serverLogger.error('Failed to get config:', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

// 保存配置 - 失效缓存
app.post('/api/config', authenticateToken, requireAdmin, invalidateCacheMiddleware(['config:*']), async (req, res) => {
    try {
        const success = await siteConfigDAO.save(req.body);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to save configuration' });
        }
    } catch (error) {
        serverLogger.error('Failed to save config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// --- 真实 JWT 认证路由 ---

// 登录接口 - 使用真实 JWT + 限流保护
app.post('/api/login', loginRateLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            authLogger.warn('Login attempt with missing credentials', { ip: req.ip });
            return res.status(400).json({ error: 'Username and password required' });
        }

        const result = await authService.login(username, password);
        authLogger.info('Login successful', { username, ip: req.ip });
        res.json(result);
    } catch (error) {
        authLogger.error('Login failed', {
            username: req.body.username,
            ip: req.ip,
            error: error.message
        });
        res.status(error.code || 500).json({ error: error.message });
    }
});

// Token 验证接口 - 使用真实验证
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

// 修改密码接口
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        await authService.changePassword(req.user.id, oldPassword, newPassword);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 获取所有用户 (仅管理员)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await authService.getUsers(req.user);
        res.json(users);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 创建用户接口 (仅管理员)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await authService.createUser(req.user, req.body);
        res.json(user);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 更新用户状态 (仅管理员)
app.put('/api/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await authService.updateUserStatus(req.user, req.params.id, req.body.status);
        res.json({ success: true });
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 删除用户 (仅管理员)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await authService.deleteUser(req.user, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// --- 权限管理 API ---

// 获取所有可用角色
app.get('/api/roles', authenticateToken, (req, res) => {
    const roles = getAllRoles();
    res.json(roles);
});

// 获取指定角色的权限
app.get('/api/roles/:role/permissions', authenticateToken, (req, res) => {
    const { role } = req.params;
    const permissions = getRolePermissions(role);

    if (permissions.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
    }

    res.json({ role, permissions });
});

// 获取所有权限列表
app.get('/api/permissions', authenticateToken, (req, res) => {
    res.json(PERMISSIONS);
});

// 获取当前用户的权限
app.get('/api/user/permissions', authenticateToken, (req, res) => {
    const permissions = getRolePermissions(req.user.role);
    res.json({
        role: req.user.role,
        permissions
    });
});

// 更新指定角色的权限
app.put('/api/roles/:role/permissions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role } = req.params;
        const { permissions } = req.body;

        // 验证角色存在
        if (!getAllRoles().includes(role)) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // 验证permissions是数组
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions must be an array' });
        }

        // 更新权限
        const success = updateRolePermissions(role, permissions);

        if (success) {
            serverLogger.info(`Role permissions updated`, {
                admin: req.user.username,
                role,
                permissionCount: permissions.length,
                context: 'System'
            });

            res.json({
                success: true,
                role,
                permissions
            });
        } else {
            throw new Error('Failed to update permissions');
        }
    } catch (error) {
        serverLogger.error('Failed to update role permissions', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/plugins/:id/stop', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pluginManager.stopPlugin(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Gateway Handshake API ---

// 插件握手接口 - 插件启动后调用
app.post('/api/gateway/handshake', express.json(), (req, res) => {
    try {
        const { pluginId, version, capabilities, metadata } = req.body;

        if (!pluginId) {
            return res.status(400).json({
                success: false,
                error: 'pluginId is required'
            });
        }

        console.log(`[Gateway] Received handshake from plugin: ${pluginId}`);

        // 处理握手
        const response = pluginManager.handshakeManager.handleHandshake(pluginId, {
            version,
            capabilities,
            metadata
        });

        res.json(response);
    } catch (error) {
        console.error('[Gateway] Handshake error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取握手统计信息
app.get('/api/gateway/handshake/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = pluginManager.handshakeManager.getStats();
    res.json(stats);
});

// --- Health Check API ---

// 获取健康检查统计信息
app.get('/api/health-check/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = pluginManager.healthChecker.getStats();
    res.json(stats);
});

// 启动健康检查
app.post('/api/health-check/start', authenticateToken, requireAdmin, (req, res) => {
    pluginManager.healthChecker.start();
    res.json({ success: true, message: 'Health checker started' });
});

// 停止健康检查
app.post('/api/health-check/stop', authenticateToken, requireAdmin, (req, res) => {
    pluginManager.healthChecker.stop();
    res.json({ success: true, message: 'Health checker stopped' });
});

// 手动触发健康检查
app.post('/api/health-check/trigger', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { pluginId } = req.body;
        await pluginManager.healthChecker.triggerCheck(pluginId);
        res.json({ success: true, message: pluginId ? `Checked plugin ${pluginId}` : 'Checked all plugins' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Tenant Management API ---

// 获取所有租户 (仅超级管理员)
app.get('/api/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await tenantService.getAllTenants();

        // 为每个租户添加用户统计
        const tenantsWithStats = await Promise.all(
            tenants.map(async (tenant) => {
                const userCount = await tenantService.getTenantUserCount(tenant.id);
                return { ...tenant, userCount };
            })
        );

        res.json(tenantsWithStats);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 创建租户 (仅超级管理员)
app.post('/api/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tenant name is required' });
        }

        const tenant = await tenantService.createTenant(name);
        res.json(tenant);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 获取租户详情和统计
app.get('/api/tenants/:tenantId', authenticateToken, enforceTenantIsolation, async (req, res) => {
    try {
        const stats = await tenantService.getTenantStats(req.params.tenantId);
        res.json(stats);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 更新租户状态 (仅超级管理员)
app.put('/api/tenants/:tenantId/status', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await tenantService.updateTenantStatus(req.params.tenantId, status);
        res.json({ success: true });
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 删除租户 (仅超级管理员)
app.delete('/api/tenants/:tenantId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        await tenantService.deleteTenant(req.params.tenantId);
        res.json({ success: true });
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// 获取当前用户的租户信息
app.get('/api/tenant/current', authenticateToken, async (req, res) => {
    try {
        const tenant = await tenantService.getTenant(req.user.tenantId);
        res.json(tenant);
    } catch (error) {
        res.status(error.code || 500).json({ error: error.message });
    }
});

// --- Logging API ---

// 查询日志
app.get('/api/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { level, context, startDate, endDate, limit, logType } = req.query;

        const logs = await LogQuery.queryLogs({
            level,
            context,
            startDate,
            endDate,
            limit: limit ? parseInt(limit) : 100,
            logType: logType || 'combined'
        });

        res.json(logs);
    } catch (error) {
        serverLogger.error('Failed to query logs', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 获取日志统计信息
app.get('/api/logs/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await LogQuery.getStats();
        res.json(stats);
    } catch (error) {
        serverLogger.error('Failed to get log stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 获取日志文件列表
app.get('/api/logs/files', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const files = LogQuery.listFiles();
        res.json(files);
    } catch (error) {
        serverLogger.error('Failed to list log files', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 清理所有日志文件
app.delete('/api/logs/clear', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const logsDir = path.join(__dirname, 'logs');

        // 确保logs目录存在
        if (!fs.existsSync(logsDir)) {
            return res.json({ success: true, message: '日志目录不存在，无需清理' });
        }

        // 读取所有文件
        const files = fs.readdirSync(logsDir);
        let deletedCount = 0;

        // 删除所有.log文件
        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(logsDir, file);
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }

        serverLogger.info(`Log files cleared by admin`, {
            admin: req.user.username,
            deletedCount,
            context: 'System'
        });

        res.json({
            success: true,
            message: `已清理 ${deletedCount} 个日志文件`
        });
    } catch (error) {
        serverLogger.error('Failed to clear log files', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// --- Dynamic Proxy for Plugins ---


import uploadRoutes from './server/routes/upload.js';
import navlinkRoutes from './server/routes/navlink.js';
import { UPLOAD_DIR } from './server/config.js';



// Mount Routes
app.use('/api', uploadRoutes);
app.use('/api', navlinkRoutes);

// Serve Uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// --- HTTP Proxy for Plugins ---
// --- HTTP Proxy for Plugins (Removed duplicate) ---

// --- Plugin Frontend API Proxy ---
// 处理插件前端的API调用: /apps/:pluginId/api/* -> /api/apps/:pluginId/api/*
app.use('/apps/:pluginId/api', optionalAuth, (req, res, next) => {
    const pluginId = req.params.pluginId;
    const plugin = pluginManager.getActivePlugin(pluginId);

    if (!plugin) {
        console.error(`[Plugin Frontend Proxy] Plugin ${pluginId} not found or not running`);
        return res.status(404).json({ error: `Plugin ${pluginId} not running` });
    }

    // 如果没有认证用户，使用默认用户上下文
    if (!req.user) {
        req.user = {
            id: 'user_1001',
            tenantId: 'default',
            role: 'user',
            username: 'default-user'
        };
    }

    // 进程内插件：代理到本机的 /api/plugins/:pluginId
    if (plugin.mode === 'in-process') {
        console.log(`[Plugin Frontend Proxy] [In-Process] ${req.method} /apps/${pluginId}/api${req.path} -> /api/plugins/${pluginId}/api${req.path}`);

        createProxyMiddleware({
            target: `http://localhost:${PORT}`,
            changeOrigin: true,
            pathRewrite: {
                [`^/apps/${pluginId}/api`]: `/api/plugins/${pluginId}/api`
            },
            onProxyReq: (proxyReq, req, res) => {
                // 注入用户上下文
                proxyReq.setHeader('X-Nav-User-Id', req.user.id);
                proxyReq.setHeader('X-Nav-Tenant-Id', req.user.tenantId);
                proxyReq.setHeader('X-Nav-User-Role', req.user.role);
                proxyReq.setHeader('X-Nav-Username', req.user.username);
            }
        })(req, res, next);
        return;
    }

    // 进程外插件：代理到插件端口
    const apiPath = req.path; // e.g., /servers, /groups
    console.log(`[Plugin Frontend Proxy] [Process] ${req.method} /apps/${pluginId}/api${apiPath} -> http://localhost:${plugin.port}/api${apiPath}`);

    createProxyMiddleware({
        target: `http://localhost:${plugin.port}`,
        changeOrigin: true,
        pathRewrite: {
            [`^/apps/${pluginId}/api`]: '/api' // /apps/vps/api/servers -> /api/servers
        },
        onProxyReq: (proxyReq, req, res) => {
            // 注入用户上下文
            proxyReq.setHeader('X-Nav-User-Id', req.user.id);
            proxyReq.setHeader('X-Nav-Tenant-Id', req.user.tenantId);
            proxyReq.setHeader('X-Nav-User-Role', req.user.role);
            proxyReq.setHeader('X-Nav-Username', req.user.username);
        },
        onError: (err, req, res) => {
            console.error(`[Plugin Frontend Proxy] Error for ${pluginId}:`, err.message);
            res.status(502).json({
                error: 'Bad Gateway',
                message: `Failed to connect to plugin ${pluginId}`
            });
        }
    })(req, res, next);
});

// 处理插件前端的WebSocket连接: /apps/:pluginId/ws
app.use('/apps/:pluginId/ws', optionalAuth, (req, res, next) => {
    const pluginId = req.params.pluginId;
    const plugin = pluginManager.getActivePlugin(pluginId);

    if (!plugin) {
        return res.status(404).json({ error: `Plugin ${pluginId} not running` });
    }

    // 如果没有认证用户，使用默认用户上下文
    if (!req.user) {
        req.user = {
            id: 'user_1001',
            tenantId: 'default',
            role: 'user',
            username: 'default-user'
        };
    }

    console.log(`[Plugin Frontend WS Proxy] Proxying WebSocket for ${pluginId}`);

    createProxyMiddleware({
        target: `http://localhost:${plugin.port}`,
        changeOrigin: true,
        ws: true,
        pathRewrite: {
            [`^/apps/${pluginId}/ws`]: '/ws'
        }
    })(req, res, next);
});



// --- 缓存管理 API ---
// 获取缓存统计信息
app.get('/api/cache/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await cacheService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cache stats' });
    }
});

// 清空所有缓存
app.post('/api/cache/flush', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await cacheService.flush();
        serverLogger.info('Cache flushed by admin', { admin: req.user.username });
        res.json({ success: true, message: 'Cache flushed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to flush cache' });
    }
});

// 删除特定模式的缓存
app.post('/api/cache/invalidate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { pattern } = req.body;
        if (!pattern) {
            return res.status(400).json({ error: 'Pattern is required' });
        }
        const count = await cacheService.delPattern(pattern);
        serverLogger.info('Cache invalidated', { pattern, count, admin: req.user.username });
        res.json({ success: true, count, message: `${count} keys invalidated` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to invalidate cache' });
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

// ==========================================================================
// 插件API路由 - MUST BE BEFORE CATCH-ALL
// PluginManager会异步挂载Router到/api/plugins/:pluginId
// 但我们需要确保这个路径在catch-all之前被处理
// ==========================================================================
app.use('/api/plugins', (req, res, next) => {
    // 这个middleware只是确保/api/plugins路径不会被catch-all拦截
    // 实际的Router处理由PluginManager异步挂载
    // 如果没有匹配的Router，Express会自动404
    next();
});

// Catch-all route for SPA - but EXCLUDE plugin and API routes
app.get('*', (req, res, next) => {
    // Don't intercept /apps/ or /api/ routes - they should be handled by specific middleware
    if (req.path.startsWith('/apps/') || req.path.startsWith('/api/')) {
        return next(); // 调用next()让请求继续传递
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
(async () => {
    // 验证配置
    try {
        validateConfig();
        displayConfig();
    } catch (error) {
        console.error('\n❌ Configuration validation failed:', error.message);
        process.exit(1);
    }

    // 初始化缓存服务
    serverLogger.info('Initializing cache service...');
    await cacheService.connect();

    // 初始化认证数据库
    await initAuthDB();
    authLogger.info('Database initialized');

    // 初始化配置数据库
    initConfigDB();
    serverLogger.info('Config database initialized');

    await pluginManager.scanPlugins();

    // Auto-start plugins based on plugin-states.json
    try {
        const plugins = pluginManager.getPlugins();
        const statesFile = path.join(DATA_DIR, 'plugin-states.json');
        let pluginStates = {};

        if (fs.existsSync(statesFile)) {
            pluginStates = JSON.parse(fs.readFileSync(statesFile, 'utf8'));
        }

        console.log(`[AutoStart] DEBUG: Found ${plugins.length} plugins.`);
        console.log(`[AutoStart] DEBUG: States:`, JSON.stringify(pluginStates));
        serverLogger.info(`[AutoStart] Found ${plugins.length} plugins. States loaded: ${JSON.stringify(pluginStates)}`);

        for (const p of plugins) {
            // plugin-states.json format: { "pluginId": true/false }
            const isEnabled = pluginStates[p.id];

            // If explicitly true, OR (undefined and default enabled)
            if (isEnabled === true || (isEnabled === undefined && p.enabled !== false)) {
                serverLogger.info(`Auto-starting plugin: ${p.id}`);
                pluginManager.startPlugin(p.id).catch(err => {
                    serverLogger.error(`Failed to auto-start plugin ${p.id}: ${err.message}`, { context: 'System' });
                });
            }
        }
    } catch (err) {
        serverLogger.error(`Auto-start error: ${err.message}`, { context: 'System' });
    }

    // 先启动HTTP服务器
    const server = app.listen(PORT, () => {
        serverLogger.info(`NavLink v2 Gateway running on port ${PORT}`);
        serverLogger.info(`Environment: ${config.nodeEnv}`);
        serverLogger.info(`Multi-Tenant: ${config.features.multiTenant ? 'Enabled' : 'Disabled'}`);

        // 显示缓存状态
        cacheService.getStats().then(stats => {
            serverLogger.info(`Cache: ${stats.type} (${stats.available ? 'Available' : 'Unavailable'})`);
        });

        // 启动健康检查
        serverLogger.info('Starting automatic health checks...');
        pluginManager.healthChecker.start();
    });

    // 优雅关闭
    process.on('SIGTERM', async () => {
        serverLogger.info('SIGTERM received, shutting down gracefully...');
        await cacheService.disconnect();
        server.close(() => {
            serverLogger.info('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', async () => {
        serverLogger.info('SIGINT received, shutting down gracefully...');
        await cacheService.disconnect();
        server.close(() => {
            serverLogger.info('Server closed');
            process.exit(0);
        });
    });

    // Handle WebSocket Upgrades Manually for Dynamic Plugins
    server.on('upgrade', async (req, socket, head) => {
        console.log('[WebSocket] ===== UPGRADE REQUEST =====');
        console.log('[WebSocket] URL:', req.url);
        console.log('[WebSocket] Headers:', JSON.stringify(req.headers, null, 2));

        // 匹配多种路径:
        // 1. /api/apps/:pluginId/* - 兼容旧版插件API的WebSocket
        // 2. /apps/:pluginId/ws - 兼容旧版插件前端的WebSocket
        // 3. /api/plugins/:pluginId/ws - 推荐的新版插件WebSocket路径
        let match = req.url.match(/^\/api\/apps\/([^\/]+)(.*)/);
        let pathPrefix = '/api/apps/';

        if (!match) {
            match = req.url.match(/^\/apps\/([^\/]+)\/(ws.*)/);
            pathPrefix = '/apps/';
        }

        if (!match) {
            match = req.url.match(/^\/api\/plugins\/([^\/]+)\/ws(.*)/);
            pathPrefix = '/api/plugins/';
        }

        if (match) {
            const pluginId = match[1];
            const plugin = pluginManager.getActivePlugin(pluginId);

            if (!plugin) {
                console.error(`[WebSocket Upgrade] Plugin ${pluginId} not found or not running`);
                socket.destroy();
                return;
            }

            // 验证WebSocket连接的token (从URL query参数中获取)
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');

            if (!token) {
                console.error(`[WebSocket Upgrade] No token provided for ${pluginId}`);
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            // 验证token
            import('./server/middleware/auth.js').then(({ verifyToken }) => {
                const user = verifyToken(token);
                if (!user) {
                    console.error(`[WebSocket Upgrade] Invalid token for ${pluginId}`);
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                // Check if in-process plugin handles upgrades
                console.log(`[WebSocket Upgrade] Plugin info for ${pluginId}: mode=${plugin.mode}, port=${plugin.port}, hasInstance=${!!plugin.instance}`);
                if (plugin.instance) {
                    console.log(`[WebSocket Upgrade] Instance handler type: ${typeof plugin.instance.handleUpgrade}`);
                }

                if ((plugin.mode === 'in-process' || !plugin.port) && plugin.instance && typeof plugin.instance.handleUpgrade === 'function') {
                    console.log(`[WebSocket Upgrade] Delegating to in-process plugin ${pluginId}`);
                    // Note: Auth has been verified above
                    plugin.instance.handleUpgrade(req, socket, head);
                    return;
                }

                // 如果是进程内插件且没有处理程序，目前不支持通过此方式代理 WebSocket
                if (plugin.mode === 'in-process' || !plugin.port) {
                    console.log(`[WebSocket Upgrade] In-process plugin ${pluginId} WS not supported via proxy (Missing instance or handleUpgrade)`);
                    socket.destroy();
                    return;
                }

                console.log(`[WebSocket Upgrade] ${req.url} -> Plugin ${pluginId} (port ${plugin.port}) [User: ${user.username}]`);
                const proxy = createProxyMiddleware({
                    target: `http://127.0.0.1:${plugin.port}`,
                    changeOrigin: true,
                    ws: true,
                    pathRewrite: {
                        [`^${pathPrefix}${pluginId}`]: '',
                    },
                    onProxyReq: (proxyReq, req, res) => {
                        // 注入用户上下文到header
                        proxyReq.setHeader('X-Nav-User-Id', user.id);
                        proxyReq.setHeader('X-Nav-Tenant-Id', user.tenantId);
                        proxyReq.setHeader('X-Nav-User-Role', user.role);
                        proxyReq.setHeader('X-Nav-Username', user.username);
                    },
                    onError: (err, req, res) => {
                        console.error(`[WebSocket Upgrade] Error proxying to ${pluginId}:`, err);
                    }
                });
                proxy.upgrade(req, socket, head);
            }).catch(err => {
                console.error(`[WebSocket Upgrade] Error loading auth module:`, err);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
            });
            return;
        }

        // If no match or plugin not found, destroy socket
        console.log(`[WebSocket Upgrade] No match for ${req.url}, destroying socket`);
        socket.destroy();
    });
})();
