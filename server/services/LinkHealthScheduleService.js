/**
 * LinkHealthScheduleService
 * 链接健康检测定时任务服务
 */

import cron from 'node-cron';
import { checkUrlHealth } from './healthCheck.js';
import siteConfigDAO from '../database/dao/SiteConfigDAO.js';

class LinkHealthScheduleService {
    constructor() {
        this.cronJob = null;
        this.isEnabled = false;
        this.scheduleTime = '03:00';
        this.isRunning = false;
    }

    /**
     * 初始化定时任务
     */
    async init() {
        try {
            const config = await siteConfigDAO.getConfig();
            if (config && config.healthCheckSchedule) {
                this.isEnabled = config.healthCheckSchedule.enabled || false;
                this.scheduleTime = config.healthCheckSchedule.time || '03:00';

                if (this.isEnabled) {
                    this.startSchedule();
                    console.log(`[健康检测定时任务] 已启动，检测时间: ${this.scheduleTime}`);
                } else {
                    console.log('[健康检测定时任务] 未启用');
                }
            }
        } catch (error) {
            console.error('[健康检测定时任务] 初始化失败:', error);
        }
    }

    /**
     * 启动定时任务
     */
    startSchedule() {
        this.stopSchedule();

        if (!this.scheduleTime) {
            console.error('[健康检测定时任务] 无效的时间配置');
            return;
        }

        const [hour, minute] = this.scheduleTime.split(':').map(Number);

        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.error('[健康检测定时任务] 时间格式错误:', this.scheduleTime);
            return;
        }

        const cronExpression = `${minute} ${hour} * * *`;

        this.cronJob = cron.schedule(cronExpression, async () => {
            await this.runHealthCheck();
        }, {
            timezone: 'Asia/Shanghai'
        });

        this.isEnabled = true;
        console.log(`[健康检测定时任务] 定时任务已设置: ${cronExpression} (每天 ${this.scheduleTime})`);
    }

    /**
     * 停止定时任务
     */
    stopSchedule() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('[健康检测定时任务] 定时任务已停止');
        }
        this.isEnabled = false;
    }

    /**
     * 执行健康检查
     */
    async runHealthCheck() {
        if (this.isRunning) {
            console.log('[健康检测定时任务] 上一次检查尚未完成，跳过');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log('[健康检测定时任务] 开始执行健康检查...');

            const config = await siteConfigDAO.getConfig();
            if (!config) {
                console.error('[健康检测定时任务] 无法获取配置');
                return;
            }

            let totalLinks = 0;
            let healthyLinks = 0;
            let unhealthyLinks = 0;

            // 检查分类中的链接
            if (config.categories) {
                for (const category of config.categories) {
                    if (category.items) {
                        for (const item of category.items) {
                            if (item.url) {
                                totalLinks++;
                                const health = await checkUrlHealth(item.url);
                                item.health = health;
                                if (health.isHealthy) healthyLinks++;
                                else unhealthyLinks++;
                            }
                        }
                    }
                    if (category.subCategories) {
                        for (const subCat of category.subCategories) {
                            if (subCat.items) {
                                for (const item of subCat.items) {
                                    if (item.url) {
                                        totalLinks++;
                                        const health = await checkUrlHealth(item.url);
                                        item.health = health;
                                        if (health.isHealthy) healthyLinks++;
                                        else unhealthyLinks++;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 检查推广链接
            if (config.promo) {
                for (const tab of config.promo) {
                    if (tab.items) {
                        for (const item of tab.items) {
                            if (item.url) {
                                totalLinks++;
                                const health = await checkUrlHealth(item.url);
                                item.health = health;
                                if (health.isHealthy) healthyLinks++;
                                else unhealthyLinks++;
                            }
                        }
                    }
                }
            }

            // 保存更新后的配置
            await siteConfigDAO.save(config);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[健康检测定时任务] ✅ 检查完成，耗时: ${duration}秒`);
            console.log(`[健康检测定时任务] 统计: 总计 ${totalLinks} 个链接，健康 ${healthyLinks} 个，失效 ${unhealthyLinks} 个`);

        } catch (error) {
            console.error('[健康检测定时任务] 检查失败:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 更新定时任务配置
     */
    async updateSchedule(enabled, time) {
        this.isEnabled = enabled;
        this.scheduleTime = time;

        try {
            const config = await siteConfigDAO.getConfig() || {};
            config.healthCheckSchedule = { enabled, time };
            await siteConfigDAO.save(config);
            console.log('[健康检测定时任务] 配置已保存');
        } catch (error) {
            console.error('[健康检测定时任务] 保存配置失败:', error);
            throw error;
        }

        if (enabled) {
            this.startSchedule();
        } else {
            this.stopSchedule();
        }
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            scheduleTime: this.scheduleTime,
            isRunning: this.isRunning,
            cronExpression: this.isEnabled ? `每天 ${this.scheduleTime}` : null
        };
    }
}

export const linkHealthScheduleService = new LinkHealthScheduleService();
export default linkHealthScheduleService;
