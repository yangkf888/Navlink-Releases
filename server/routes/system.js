import express from 'express';
import { updateService } from '../services/UpdateService.js';
import { upgradeService } from '../services/UpgradeService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

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

export default router;
