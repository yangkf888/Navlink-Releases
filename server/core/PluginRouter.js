/**
 * 统一插件路由
 * 基于服务注册中心的智能路由
 */

import { createProxyMiddleware } from 'http-proxy-middleware';

export function createPluginRouter(registry) {
    return async (req, res, next) => {
        // 统一路由格式: /plugin/{pluginId}/*
        const match = req.path.match(/^\/plugin\/([^\/]+)(.*)/);

        if (!match) {
            return next();
        }

        const [, pluginId, subPath] = match;

        // 从注册中心发现服务
        const service = registry.discover(pluginId);

        if (!service) {
            console.warn(`[PluginRouter] Service not found: ${pluginId}`);
            return res.status(404).json({
                error: 'Plugin not found or not running',
                pluginId
            });
        }

        console.debug(`[PluginRouter] Routing ${req.method} ${req.path} → ${service.url}${subPath}`);

        // 代理到插件
        const proxy = createProxyMiddleware({
            target: service.url,
            changeOrigin: true,
            pathRewrite: {
                [`^/plugin/${pluginId}`]: '' // 移除前缀
            },
            onProxyReq: (proxyReq, req, res) => {
                // 注入用户上下文
                if (req.user) {
                    proxyReq.setHeader('X-Nav-User-Id', req.user.id);
                    proxyReq.setHeader('X-Nav-Tenant-Id', req.user.tenantId);
                    proxyReq.setHeader('X-Nav-User-Role', req.user.role);
                    proxyReq.setHeader('X-Nav-Username', req.user.username);
                }
            },
            onError: (err, req, res) => {
                console.error(`[PluginRouter] Proxy error for ${pluginId}:`, err.message);
                res.status(502).json({
                    error: 'Bad Gateway',
                    message: `Failed to connect to plugin ${pluginId}`,
                    details: err.message
                });
            }
        });

        proxy(req, res, next);
    };
}

/**
 * WebSocket升级处理
 */
export function handlePluginWebSocket(server, registry) {
    server.on('upgrade', (req, socket, head) => {
        const match = req.url.match(/^\/plugin\/([^\/]+)(.*)/);

        if (!match) {
            return; // 非插件WS,忽略
        }

        const [, pluginId, subPath] = match;
        const service = registry.discover(pluginId);

        if (!service) {
            console.warn(`[PluginRouter] WS: Service not found: ${pluginId}`);
            socket.destroy();
            return;
        }

        console.info(`[PluginRouter] WS Upgrade: ${req.url} → ${service.url}${subPath}`);

        const proxy = createProxyMiddleware({
            target: service.url,
            changeOrigin: true,
            ws: true,
            pathRewrite: {
                [`^/plugin/${pluginId}`]: ''
            }
        });

        proxy.upgrade(req, socket, head);
    });
}
