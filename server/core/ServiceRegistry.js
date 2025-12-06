/**
 * 服务注册中心
 * 插件自注册、健康检查、服务发现
 */

import EventEmitter from 'events';
import fetch from 'node-fetch';

export class ServiceRegistry extends EventEmitter {
    constructor() {
        super();
        this.services = new Map(); // pluginId -> ServiceInfo
        this.healthCheckInterval = 30000; // 30秒
        this.healthCheckTimer = null;
    }

    /**
     * 插件注册
     * @param {Object} serviceInfo 
     * {
     *   id: 'vps',
     *   name: 'VPS管理',
     *   version: '1.0.0',
     *   url: 'http://127.0.0.1:10004',
     *   routes: ['/api/servers', '/api/groups'],
     *   healthCheck: '/health',
     *   metadata: { ... }
     * }
     */
    register(serviceInfo) {
        const { id, url } = serviceInfo;
        
        if (!id || !url) {
            throw new Error('Service id and url are required');
        }

        this.services.set(id, {
            ...serviceInfo,
            status: 'registered',
            registeredAt: Date.now(),
            lastHealthCheck: null,
            failureCount: 0
        });

        console.log(`[Registry] ✓ Service registered: ${id} @ ${url}`);
        this.emit('service:registered', serviceInfo);
        
        return { success: true, serviceId: id };
    }

    /**
     * 取消注册
     */
    unregister(serviceId) {
        if (!this.services.has(serviceId)) {
            return { success: false, error: 'Service not found' };
        }

        this.services.delete(serviceId);
        console.log(`[Registry] ✗ Service unregistered: ${serviceId}`);
        this.emit('service:unregistered', serviceId);
        
        return { success: true };
    }

    /**
     * 服务发现 - 根据ID查找服务
     */
    discover(serviceId) {
        const service = this.services.get(serviceId);
        
        if (!service) {
            return null;
        }

        if (service.status !== 'healthy' && service.status !== 'registered') {
            console.warn(`[Registry] Service ${serviceId} is not healthy: ${service.status}`);
            return null;
        }

        return service;
    }

    /**
     * 服务发现 - 根据路由查找服务
     */
    discoverByRoute(route) {
        for (const [id, service] of this.services) {
            if (service.routes && service.routes.some(r => route.startsWith(r))) {
                if (service.status === 'healthy' || service.status === 'registered') {
                    return service;
                }
            }
        }
        return null;
    }

    /**
     * 获取所有服务
     */
    list(filter = {}) {
        const services = Array.from(this.services.values());
        
        if (filter.status) {
            return services.filter(s => s.status === filter.status);
        }
        
        return services;
    }

    /**
     * 启动健康检查
     */
    startHealthCheck() {
        if (this.healthCheckTimer) {
            console.warn('[Registry] Health check already running');
            return;
        }

        console.log('[Registry] Starting health check...');
        
        // 立即执行一次
        this.performHealthCheck();
        
        // 定时执行
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);
    }

    /**
     * 停止健康检查
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
            console.log('[Registry] Health check stopped');
        }
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        const services = Array.from(this.services.values());
        
        for (const service of services) {
            try {
                const healthUrl = `${service.url}${service.healthCheck || '/health'}`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(healthUrl, {
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (response.ok) {
                    service.status = 'healthy';
                    service.lastHealthCheck = Date.now();
                    service.failureCount = 0;
                } else {
                    throw new Error(`Health check failed: ${response.status}`);
                }

            } catch (error) {
                service.failureCount++;
                service.lastHealthCheck = Date.now();

                if (service.failureCount >= 3) {
                    service.status = 'unhealthy';
                    console.error(`[Registry] Service ${service.id} is unhealthy:`, error.message);
                    this.emit('service:unhealthy', service);
                } else {
                    service.status = 'degraded';
                }
            }
        }
    }

    /**
     * 获取服务统计
     */
    getStats() {
        const services = Array.from(this.services.values());
        
        return {
            total: services.length,
            healthy: services.filter(s => s.status === 'healthy').length,
            degraded: services.filter(s => s.status === 'degraded').length,
            unhealthy: services.filter(s => s.status === 'unhealthy').length,
            registered: services.filter(s => s.status === 'registered').length
        };
    }
}
