/**
 * 握手协议管理器
 * 用于处理插件与Gateway之间的启动握手
 * 
 * 工作流程:
 * 1. ProcessManager启动插件进程
 * 2. 插件启动后调用 POST /api/gateway/handshake 向Gateway报告
 * 3. HandshakeManager记录插件状态并响应
 * 4. Gateway等待握手完成才将插件标记为"ready"
 */

export class HandshakeManager {
    constructor() {
        // 存储等待握手的插件信息
        this.pendingHandshakes = new Map(); // pluginId -> { timestamp, port, resolve, reject, timeout }
        this.completedHandshakes = new Map(); // pluginId -> { timestamp, version, capabilities }
        
        // 握手超时时间(15秒)
        this.handshakeTimeout = 15000;
    }

    /**
     * 注册一个等待握手的插件
     * @param {string} pluginId - 插件ID
     * @param {number} port - 插件端口
     * @returns {Promise<object>} - 握手完成后resolve插件信息
     */
    registerPendingHandshake(pluginId, port) {
        console.log(`[Handshake] Waiting for handshake from plugin: ${pluginId} on port ${port}`);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn(`[Handshake] Timeout waiting for plugin ${pluginId}`);
                this.pendingHandshakes.delete(pluginId);
                reject(new Error(`Handshake timeout for plugin ${pluginId}`));
            }, this.handshakeTimeout);

            this.pendingHandshakes.set(pluginId, {
                timestamp: Date.now(),
                port,
                resolve,
                reject,
                timeout
            });
        });
    }

    /**
     * 处理插件的握手请求
     * @param {string} pluginId - 插件ID
     * @param {object} handshakeData - 握手数据 { version, capabilities, metadata }
     * @returns {object} - 响应数据
     */
    handleHandshake(pluginId, handshakeData) {
        console.log(`[Handshake] Received handshake from plugin: ${pluginId}`, handshakeData);

        const pending = this.pendingHandshakes.get(pluginId);
        
        if (!pending) {
            // 插件未注册或已超时
            console.warn(`[Handshake] Unexpected handshake from ${pluginId}`);
            return {
                success: false,
                error: 'Plugin not expected or handshake timeout'
            };
        }

        // 清除超时
        clearTimeout(pending.timeout);

        // 记录握手完成
        const handshakeInfo = {
            timestamp: Date.now(),
            version: handshakeData.version || 'unknown',
            capabilities: handshakeData.capabilities || [],
            metadata: handshakeData.metadata || {},
            port: pending.port
        };

        this.completedHandshakes.set(pluginId, handshakeInfo);
        this.pendingHandshakes.delete(pluginId);

        // 通知等待的Promise
        pending.resolve(handshakeInfo);

        console.log(`[Handshake] ✓ Plugin ${pluginId} handshake completed`);

        // 返回Gateway信息给插件
        return {
            success: true,
            gatewayVersion: '2.0.0',
            timestamp: Date.now(),
            message: 'Handshake accepted'
        };
    }

    /**
     * 检查插件是否已完成握手
     */
    isHandshakeCompleted(pluginId) {
        return this.completedHandshakes.has(pluginId);
    }

    /**
     * 获取插件握手信息
     */
    getHandshakeInfo(pluginId) {
        return this.completedHandshakes.get(pluginId);
    }

    /**
     * 清除插件的握手记录(插件停止时调用)
     */
    clearHandshake(pluginId) {
        const pending = this.pendingHandshakes.get(pluginId);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Plugin stopped before handshake'));
            this.pendingHandshakes.delete(pluginId);
        }
        this.completedHandshakes.delete(pluginId);
        console.log(`[Handshake] Cleared handshake for plugin: ${pluginId}`);
    }

    /**
     * 获取所有等待握手的插件
     */
    getPendingHandshakes() {
        return Array.from(this.pendingHandshakes.entries()).map(([pluginId, info]) => ({
            pluginId,
            port: info.port,
            waitingTime: Date.now() - info.timestamp
        }));
    }

    /**
     * 获取握手统计信息
     */
    getStats() {
        return {
            pending: this.pendingHandshakes.size,
            completed: this.completedHandshakes.size,
            details: {
                pendingPlugins: Array.from(this.pendingHandshakes.keys()),
                completedPlugins: Array.from(this.completedHandshakes.keys())
            }
        };
    }
}
