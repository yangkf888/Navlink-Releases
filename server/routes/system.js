import express from 'express';
import { updateService } from '../services/UpdateService.js';
import { upgradeService } from '../services/UpgradeService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { licenseService } from '../services/LicenseService.js';

const router = express.Router();

/**
 * @swagger
 * /api/system/version:
 *   get:
 *     summary: 获取当前系统版本信息
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 系统版本信息
 */
router.get('/version', async (req, res) => {
    try {
        const versionInfo = await updateService.getVersionInfo();
        res.json(versionInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/check-update:
 *   get:
 *     summary: 检查是否有可用更新
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 更新检查结果
 */
router.get('/check-update', async (req, res) => {
    try {
        const result = await updateService.checkForUpdate();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/update-notification:
 *   get:
 *     summary: 获取更新通知状态
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 更新通知状态
 */
router.get('/update-notification', (req, res) => {
    res.json(updateService.getUpdateNotification());
});

/**
 * @swagger
 * /api/system/update-notification/dismiss:
 *   post:
 *     summary: 关闭更新通知
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 操作结果
 */
router.post('/update-notification/dismiss', (req, res) => {
    res.json(updateService.dismissUpdateNotification());
});

/**
 * @swagger
 * /api/system/releases:
 *   get:
 *     summary: 获取版本发布列表
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 获取数量限制
 *     responses:
 *       200:
 *         description: 版本列表
 */
router.get('/releases', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const releases = await updateService.getReleases(limit);
        res.json(releases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/changelog:
 *   get:
 *     summary: 获取更新日志
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 更新日志
 */
router.get('/changelog', async (req, res) => {
    try {
        const changelog = await updateService.getChangelog();
        res.json(changelog);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/upgrade/check:
 *   get:
 *     summary: 升级预检查
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 预检查结果
 */
router.get('/upgrade/check', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await upgradeService.preUpgradeCheck();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/upgrade/status:
 *   get:
 *     summary: 获取升级状态
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 升级状态
 */
router.get('/upgrade/status', (req, res) => {
    res.json(upgradeService.getStatus());
});

/**
 * @swagger
 * /api/system/upgrade:
 *   post:
 *     summary: 执行系统升级
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetVersion:
 *                 type: string
 *                 description: 目标版本号 (可选，默认为最新)
 *     responses:
 *       200:
 *         description: 升级结果
 */
router.post('/upgrade', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetVersion } = req.body || {};
        const result = await upgradeService.performUpgrade(targetVersion);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/system/backups:
 *   get:
 *     summary: 获取备份列表
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 备份列表
 */
router.get('/backups', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const backups = await upgradeService.getBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/backups/cleanup:
 *   post:
 *     summary: 清理旧备份
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keepCount:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       200:
 *         description: 清理结果
 */
router.post('/backups/cleanup', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const keepCount = parseInt(req.body?.keepCount) || 5;
        const result = await upgradeService.cleanupOldBackups(keepCount);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/backups/delete:
 *   post:
 *     summary: 删除指定备份
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 删除结果
 */
router.post('/backups/delete', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        const result = await upgradeService.deleteBackup(name);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * @swagger
 * /api/system/license/info:
 *   get:
 *     summary: 获取授权信息 (包括设备指纹)
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 授权信息
 */
router.get('/license/info', async (req, res) => {
    try {
        const info = licenseService.getStatus();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/license/activate:
 *   post:
 *     summary: 激活 License (新版 - 在线激活)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               email:
 *                 type: string
 *               navmanageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: 激活结果
 */
router.post('/license/activate', async (req, res) => {
    try {
        const { code, email, navmanageUrl } = req.body;

        if (!code || !email) {
            throw new Error('请输入激活码和邮箱');
        }

        const serverUrl = navmanageUrl || process.env.NAVMANAGE_URL || 'https://licenses.webxx.top';
        const result = await licenseService.activate(code, email, serverUrl);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/license/request-migrate:
 *   post:
 *     summary: 申请迁移码
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 */
router.post('/license/request-migrate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, navmanageUrl } = req.body;

        if (!email) {
            throw new Error('请输入邮箱');
        }

        const serverUrl = navmanageUrl || process.env.NAVMANAGE_URL || 'https://licenses.webxx.top';
        const result = await licenseService.requestNewCode(email, serverUrl);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/system/license/status:
 *   get:
 *     summary: 获取授权状态 (公开)
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 授权状态
 */
router.get('/license/status', (req, res) => {
    res.json(licenseService.getStatus());
});

/**
 * @swagger
 * /api/health-check-schedule:
 *   post:
 *     summary: 保存链接健康检测定时任务配置
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: 是否启用定时检测
 *               time:
 *                 type: string
 *                 description: 检测时间 (格式: HH:mm)
 *     responses:
 *       200:
 *         description: 保存成功
 */
router.post('/health-check-schedule', authenticateToken, async (req, res) => {
    try {
        const { enabled, time } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: '参数 enabled 必须是布尔值'
            });
        }

        if (!time || !/^\d{2}:\d{2}$/.test(time)) {
            return res.status(400).json({
                success: false,
                error: '参数 time 格式错误，应为 HH:mm'
            });
        }

        // 导入 LinkHealthScheduleService
        const { linkHealthScheduleService } = await import('../services/LinkHealthScheduleService.js');

        // 更新定时任务配置
        await linkHealthScheduleService.updateSchedule(enabled, time);

        console.log('[健康检测定时任务] 配置已更新:', { enabled, time });

        res.json({
            success: true,
            message: '定时任务配置已保存' + (enabled ? `，将在每天 ${time} 自动执行健康检查` : ''),
            config: {
                enabled,
                time
            },
            status: linkHealthScheduleService.getStatus()
        });
    } catch (error) {
        console.error('[健康检测定时任务] 保存配置失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/system/metrics:
 *   get:
 *     summary: 获取系统资源使用指标
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 系统资源指标
 */
router.get('/metrics', authenticateToken, async (req, res) => {
    try {
        const os = await import('os');

        // 进程内存使用
        const memUsage = process.memoryUsage();

        // 系统内存
        const totalMem = os.default.totalmem();
        const freeMem = os.default.freemem();
        const usedMem = totalMem - freeMem;

        // CPU 信息
        const cpus = os.default.cpus();
        const cpuCount = cpus.length;

        // 计算 CPU 使用率 (简化版本)
        let cpuUsage = 0;
        cpus.forEach(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            cpuUsage += ((total - idle) / total) * 100;
        });
        cpuUsage = cpuUsage / cpuCount;

        // 尝试读取 Docker cgroup 限制 (如果在容器中运行)
        let containerMemLimit = null;
        let containerMemUsage = null;
        try {
            const fs = await import('fs/promises');
            // cgroup v2
            const memMax = await fs.readFile('/sys/fs/cgroup/memory.max', 'utf8').catch(() => null);
            const memCurrent = await fs.readFile('/sys/fs/cgroup/memory.current', 'utf8').catch(() => null);

            if (memMax && memMax.trim() !== 'max') {
                containerMemLimit = parseInt(memMax.trim());
            }
            if (memCurrent) {
                containerMemUsage = parseInt(memCurrent.trim());
            }

            // 如果 v2 没有数据，尝试 cgroup v1
            if (!containerMemLimit) {
                const memLimitV1 = await fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').catch(() => null);
                if (memLimitV1) {
                    const limit = parseInt(memLimitV1.trim());
                    // 如果限制值小于总内存，说明有容器限制
                    if (limit < totalMem * 0.99) {
                        containerMemLimit = limit;
                    }
                }
            }
            if (!containerMemUsage) {
                const memUsageV1 = await fs.readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8').catch(() => null);
                if (memUsageV1) {
                    containerMemUsage = parseInt(memUsageV1.trim());
                }
            }
        } catch (e) {
            // 不在容器中或无权限读取 cgroup
        }

        // 运行时间
        const uptime = process.uptime();
        const systemUptime = os.default.uptime();

        // 格式化辅助函数
        const formatBytes = (bytes) => {
            if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
            if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
            if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return bytes + ' B';
        };

        const formatUptime = (seconds) => {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            if (days > 0) return `${days}天 ${hours}小时`;
            if (hours > 0) return `${hours}小时 ${minutes}分钟`;
            return `${minutes}分钟`;
        };

        res.json({
            success: true,
            data: {
                // 进程内存
                process: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    rss: memUsage.rss,
                    heapUsedFormatted: formatBytes(memUsage.heapUsed),
                    rssFormatted: formatBytes(memUsage.rss)
                },
                // 系统内存
                system: {
                    totalMem,
                    usedMem,
                    freeMem,
                    memPercent: ((usedMem / totalMem) * 100).toFixed(1),
                    totalMemFormatted: formatBytes(totalMem),
                    usedMemFormatted: formatBytes(usedMem)
                },
                // 容器内存 (如果在 Docker 中)
                container: containerMemLimit ? {
                    limit: containerMemLimit,
                    usage: containerMemUsage,
                    percent: containerMemUsage ? ((containerMemUsage / containerMemLimit) * 100).toFixed(1) : null,
                    limitFormatted: formatBytes(containerMemLimit),
                    usageFormatted: containerMemUsage ? formatBytes(containerMemUsage) : null
                } : null,
                // CPU
                cpu: {
                    count: cpuCount,
                    model: cpus[0]?.model || 'Unknown',
                    usage: cpuUsage.toFixed(1)
                },
                // 运行时间
                uptime: {
                    process: uptime,
                    system: systemUptime,
                    processFormatted: formatUptime(uptime),
                    systemFormatted: formatUptime(systemUptime)
                },
                // 环境信息
                environment: {
                    nodeVersion: process.version,
                    platform: os.default.platform(),
                    arch: os.default.arch(),
                    hostname: os.default.hostname(),
                    isDocker: containerMemLimit !== null
                }
            }
        });
    } catch (error) {
        console.error('[System] Metrics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
