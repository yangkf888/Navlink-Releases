/**
 * NavLink Gateway Client
 * 用于插件与Gateway之间的通信
 * 
 * 使用方法:
 * import { NavLinkClient } from './navlink-client.js';
 * 
 * const client = new NavLinkClient({
 *   pluginId: 'my-plugin',
 *   version: '1.0.0',
 *   gatewayUrl: 'http://localhost:3001'
 * });
 * 
 * await client.handshake();
 */

import fetch from 'node-fetch';

export class NavLinkClient {
    constructor(options) {
        this.pluginId = options.pluginId || process.env.PLUGIN_ID;
        this.version = options.version || '1.0.0';
        this.gatewayUrl = options.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:3001';
        this.capabilities = options.capabilities || [];
        this.metadata = options.metadata || {};
        this.handshakeCompleted = false;
    }

    /**
     * 向Gateway发送握手请求
     */
    async handshake() {
        if (this.handshakeCompleted) {
            console.log('[NavLink] Handshake already completed');
            return;
        }

        if (!this.pluginId) {
            throw new Error('[NavLink] pluginId is required for handshake');
        }

        try {
            console.log(`[NavLink] Sending handshake to Gateway: ${this.gatewayUrl}`);
            
            const response = await fetch(`${this.gatewayUrl}/api/gateway/handshake`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pluginId: this.pluginId,
                    version: this.version,
                    capabilities: this.capabilities,
                    metadata: {
                        ...this.metadata,
                        startTime: new Date().toISOString(),
                        nodeVersion: process.version
                    }
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(`Handshake failed: ${data.error || response.statusText}`);
            }

            this.handshakeCompleted = true;
            console.log(`[NavLink] ✓ Handshake successful with Gateway v${data.gatewayVersion}`);
            
            return data;
        } catch (error) {
            console.error('[NavLink] Handshake error:', error.message);
            throw error;
        }
    }

    /**
     * 自动在服务器启动后发送握手
     * @param {object} server - Express app or HTTP server
     * @param {number} port - 服务器端口
     */
    async handshakeOnReady(server, port) {
        return new Promise((resolve, reject) => {
            server.once('listening', async () => {
                console.log(`[NavLink] Server listening on port ${port}, sending handshake...`);
                try {
                    await this.handshake();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * 获取用户上下文(从请求头)
     * @param {object} req - Express request object
     */
    getUserContext(req) {
        return {
            userId: req.headers['x-nav-user-id'],
            tenantId: req.headers['x-nav-tenant-id'],
            userRole: req.headers['x-nav-user-role'],
            username: req.headers['x-nav-username']
        };
    }

    /**
     * 创建标准的健康检查端点
     * @param {object} app - Express app
     */
    createHealthEndpoint(app) {
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                pluginId: this.pluginId,
                version: this.version,
                handshake: this.handshakeCompleted,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });
        console.log('[NavLink] Health check endpoint created at /health');
    }
}

/**
 * 简化的握手函数
 */
export async function sendHandshake(pluginId, options = {}) {
    const client = new NavLinkClient({ pluginId, ...options });
    return await client.handshake();
}
