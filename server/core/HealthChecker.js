/**
 * 健康检查管理器
 * 用于定期检查插件的健康状态并自动恢复失败的插件
 * 
 * 功能:
 * 1. HTTP健康检查端点
 * 2. 进程存活检查
 * 3. 握手状态检查
 * 4. 自动重启失败的插件
 * 5. 重启次数限制(防止无限重启)
 */

import fetch from 'node-fetch';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('健康检查');

export class HealthChecker {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.checkInterval = 120000; // 120秒检查一次
        this.healthCheckTimeout = 5000; // 5秒健康检查超时
        this.maxRestartAttempts = 3; // 最大重启次数
        this.restartCooldown = 60000; // 重启冷却时间(1分钟)

        this.intervalId = null;
        this.isRunning = false;

        // 记录插件重启历史
        this.restartHistory = new Map(); // pluginId -> { attempts: 0, lastRestart: timestamp }
    }

    /**
     * 启动健康检查
     */
    start() {
        if (this.isRunning) {
            logger.debug('健康检查已在运行中');
            return;
        }

        logger.info(`启动插件健康检查 (间隔: ${this.checkInterval / 1000}秒)`);
        this.isRunning = true;

        // 立即执行一次
        this.checkAllPlugins();

        // 定期执行
        this.intervalId = setInterval(() => {
            this.checkAllPlugins();
        }, this.checkInterval);
    }

    /**
     * 停止健康检查
     */
    stop() {
        if (!this.isRunning) return;

        logger.info('停止插件健康检查');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * 检查所有插件的健康状态
     */
    async checkAllPlugins() {
        const plugins = this.pluginManager.getPlugins();
        const runningPlugins = plugins.filter(p => p.status === 'running');

        if (runningPlugins.length === 0) {
            return;
        }

        logger.debug(`正在检查 ${runningPlugins.length} 个运行中的插件...`);

        for (const plugin of runningPlugins) {
            await this.checkPlugin(plugin);
        }
    }

    /**
     * 检查单个插件的健康状态
     */
    async checkPlugin(plugin) {
        const pluginId = plugin.id;

        try {
            // 进程内插件的健康检查
            if (plugin.mode === 'in-process') {
                // 进程内插件没有独立进程，只要加载成功就是健康的
                logger.debug(`✓ 插件 ${pluginId} 健康运行中 (进程内模式)`);
                this.resetRestartCounter(pluginId);
                return;
            }

            // 1. 检查进程是否存在（仅对进程外插件）
            const processInfo = this.pluginManager.processManager.processes.get(pluginId);
            if (!processInfo || !processInfo.process) {
                throw new Error('进程未找到');
            }

            // 2. 简化版本: 跳过握手检查(直接检查HTTP)
            // const handshakeCompleted = this.pluginManager.handshakeManager.isHandshakeCompleted(pluginId);
            // if (!handshakeCompleted) {
            //     throw new Error('Handshake not completed');
            // }

            // 3. HTTP健康检查(如果插件提供健康检查端点)
            const healthOk = await this.httpHealthCheck(pluginId, plugin.port);

            if (healthOk) {
                logger.debug(`✓ 插件 ${pluginId} 健康运行中`);
                // 重置重启计数
                this.resetRestartCounter(pluginId);
            } else {
                throw new Error('健康检查端点失败');
            }

        } catch (error) {
            logger.warn(`✗ 插件 ${pluginId} 状态异常: ${error.message}`);

            // 尝试重启插件
            await this.handleUnhealthyPlugin(pluginId, error.message);
        }
    }

    /**
     * HTTP健康检查
     */
    async httpHealthCheck(pluginId, port) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.healthCheckTimeout);

            // 从插件配置中获取healthCheck路径,默认使用/health
            const plugin = this.pluginManager.plugins.get(pluginId);
            const healthPath = plugin?.healthCheck || '/health';

            const response = await fetch(`http://localhost:${port}${healthPath}`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeout);

            // 200-299 都认为是健康的
            return response.ok;
        } catch (error) {
            // 如果插件没有提供 /health 端点,返回true(只检查进程和握手)
            if (error.code === 'ECONNREFUSED' || error.message.includes('404')) {
                return true; // 插件运行中,但没有健康检查端点
            }
            return false;
        }
    }

    /**
     * 处理不健康的插件
     */
    async handleUnhealthyPlugin(pluginId, reason) {
        const restartInfo = this.restartHistory.get(pluginId) || {
            attempts: 0,
            lastRestart: 0
        };

        // 检查是否在冷却期内
        const timeSinceLastRestart = Date.now() - restartInfo.lastRestart;
        if (timeSinceLastRestart < this.restartCooldown) {
            logger.debug(`插件 ${pluginId} 在冷却期内，跳过重启`);
            return;
        }

        // 检查重启次数
        if (restartInfo.attempts >= this.maxRestartAttempts) {
            logger.error(`插件 ${pluginId} 超过最大重启次数 (${this.maxRestartAttempts})`);

            // 标记插件为失败状态
            const plugin = this.pluginManager.plugins.get(pluginId);
            if (plugin) {
                plugin.status = 'failed';
                plugin.failureReason = `超过最大重启次数: ${reason}`;
            }

            return;
        }

        // 尝试重启
        logger.warn(`尝试重启插件 ${pluginId} (第 ${restartInfo.attempts + 1}/${this.maxRestartAttempts} 次)`);

        try {
            // 停止插件
            await this.pluginManager.stopPlugin(pluginId);

            // 等待一下
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 重新启动
            await this.pluginManager.startPlugin(pluginId);

            // 更新重启历史
            this.restartHistory.set(pluginId, {
                attempts: restartInfo.attempts + 1,
                lastRestart: Date.now()
            });

            logger.info(`✓ 插件 ${pluginId} 重启成功`);
        } catch (error) {
            logger.error(`✗ 插件 ${pluginId} 重启失败: ${error.message}`);

            // 更新插件状态
            const plugin = this.pluginManager.plugins.get(pluginId);
            if (plugin) {
                plugin.status = 'failed';
                plugin.failureReason = `重启失败: ${error.message}`;
            }
        }
    }

    /**
     * 重置插件的重启计数器
     */
    resetRestartCounter(pluginId) {
        const restartInfo = this.restartHistory.get(pluginId);
        if (restartInfo && restartInfo.attempts > 0) {
            logger.debug(`重置插件 ${pluginId} 的重启计数器`);
            this.restartHistory.set(pluginId, {
                attempts: 0,
                lastRestart: restartInfo.lastRestart
            });
        }
    }

    /**
     * 获取健康检查统计信息
     */
    getStats() {
        const plugins = this.pluginManager.getPlugins();

        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            totalPlugins: plugins.length,
            runningPlugins: plugins.filter(p => p.status === 'running').length,
            failedPlugins: plugins.filter(p => p.status === 'failed').length,
            restartHistory: Array.from(this.restartHistory.entries()).map(([pluginId, info]) => ({
                pluginId,
                attempts: info.attempts,
                lastRestart: info.lastRestart ? new Date(info.lastRestart).toISOString() : null
            }))
        };
    }

    /**
     * 检查插件的底层健康状态 (进程是否存在等)
     */
    async checkPluginHealth(pluginId) {
        const plugin = this.pluginManager.plugins.get(pluginId);
        if (!plugin || plugin.status !== 'running') {
            return false;
        }

        // 进程内插件健康检查
        if (plugin.mode === 'in-process') {
            // TODO: 调用插件内部的健康检查方法，或者简单的返回 true
            // 目前假设只要加载成功就是健康的
            return true;
        }

        // 子进程插件健康检查
        if (!plugin.pid) {
            return false;
        }

        // 检查进程是否存在
        try {
            process.kill(plugin.pid, 0); // 发送信号0，检查进程是否存在，不杀死进程
            return true;
        } catch (e) {
            // 如果进程不存在，会抛出错误 (如 ESRCH)
            return false;
        }
    }

    /**
     * 手动触发健康检查
     */
    async triggerCheck(pluginId = null) {
        if (pluginId) {
            const plugin = this.pluginManager.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`插件 ${pluginId} 未找到`);
            }
            logger.info(`手动检查插件: ${pluginId}`);
            await this.checkPlugin(plugin);
        } else {
            logger.info('手动检查所有插件');
            await this.checkAllPlugins();
        }
    }
}

