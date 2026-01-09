const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
// Authentication handled by main app
const SubscriptionDAO = require('../database/dao/SubscriptionDAO');
const NotificationDAO = require('../database/dao/NotificationDAO');
const { runSubscriptionCheck, setupSubscriptionCheckSchedule } = require('../services/subscriptionCheck');
const {
    sendBarkNotification,
    sendTelegramNotification,
    sendEmailNotification,
    sendWebhookNotification,
    sendAllNotifications
} = require('../services/notification');

const router = express.Router();

// 路由中间件
router.use((req, res, next) => {
    next();
});

// 延迟获取 DAO 实例（确保数据库已初始化）
const getSubscriptionDAO = () => new SubscriptionDAO();
const getNotificationDAO = () => new NotificationDAO();

/**
 * 提取用户上下文（从 Gateway 传递的 Header）
 * 对于进程内插件，headers可能不存在，使用默认值
 */
function getUserContext(req) {
    const userId = req.headers['x-nav-user-id'] || 'user_1001';
    return { userId };
}

// 配置 Multer 存储 (JSON)
const jsonStorage = multer.memoryStorage();
const jsonUpload = multer({
    storage: jsonStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 限制
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

// API: 获取所有订阅 (带租户过滤)
router.get('/', async (req, res) => {
    try {
        const { userId } = getUserContext(req);
        const subscriptions = await getSubscriptionDAO().getAll(userId);
        res.json(subscriptions);
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to get subscriptions' });
    }
});

// API: 创建订阅 (强制注入tenant_id和user_id)
router.post('/', async (req, res) => {
    try {
        const { userId } = getUserContext(req);

        const newSubscription = {
            ...req.body,
            id: uuidv4(),
            isActive: req.body.isActive ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const created = await getSubscriptionDAO().create(newSubscription, userId);
        res.status(201).json(created);
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to create subscription' });
    }
});

// API: 更新订阅 (验证租户所有权)
router.put('/:id', async (req, res) => {
    try {
        console.log(`[订阅更新] 开始更新订阅 ID: ${req.params.id}`);
        const { userId } = getUserContext(req);
        const updated = await getSubscriptionDAO().update(req.params.id, req.body, userId);

        if (!updated) {
            return res.status(404).json({ error: 'Subscription not found or access denied' });
        }

        console.log(`[订阅更新] 订阅已更新:`, {
            name: updated.name,
            autoRenew: updated.autoRenew,
            periodValue: updated.periodValue,
            periodUnit: updated.periodUnit,
            expiryDate: updated.expiryDate
        });

        // 🔔 如果启用了自动续订且订阅已过期，立即执行续订
        if (updated.autoRenew && updated.periodValue && updated.periodUnit) {
            console.log(`[订阅更新] 检测到启用自动续订，检查是否需要立即续订...`);
            const { calculateDaysRemaining, autoRenewSubscription } = require('../services/subscriptionData');
            const { getNotificationSettings } = require('../services/subscriptionData');

            const settings = await getNotificationSettings();
            const timezone = settings.timezone || 'Asia/Shanghai';
            const daysRemaining = calculateDaysRemaining(updated.expiryDate, timezone);

            console.log(`[订阅更新] 剩余天数: ${daysRemaining}`);

            if (daysRemaining <= 0) {
                console.log(`[订阅更新] 订阅 "${updated.name}" 已过期且启用自动续订，立即续订...`);
                const renewed = await autoRenewSubscription(updated, timezone, userId);
                if (renewed) {
                    console.log(`[订阅更新] 订阅 "${updated.name}" 已自动续订至: ${renewed.expiryDate}`);
                    return res.json(renewed);
                } else {
                    console.log(`[订阅更新] 自动续订失败`);
                }
            } else {
                console.log(`[订阅更新] 订阅未过期，跳过自动续订`);
            }
        } else {
            console.log(`[订阅更新] 不满足自动续订条件:`, {
                autoRenew: updated.autoRenew,
                periodValue: updated.periodValue,
                periodUnit: updated.periodUnit
            });
        }

        res.json(updated);
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to update subscription' });
    }
});

// API: 删除订阅 (验证租户所有权)
router.delete('/:id', async (req, res) => {
    try {
        const { userId } = getUserContext(req);
        const deleted = await getSubscriptionDAO().delete(req.params.id, userId);

        if (!deleted) {
            return res.status(404).json({ error: 'Subscription not found or access denied' });
        }

        res.json({ success: true, message: 'Subscription deleted' });
    } catch (error) {
        console.error('Delete subscription error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to delete subscription' });
    }
});

// API: 获取通知设置 (公开)
router.get('/settings/notifications', async (req, res) => {
    try {
        const settings = await getNotificationDAO().get();
        res.json(settings || {});
    } catch (error) {
        console.error('Get notification settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// API: 保存通知设置 (需要认证)
router.post('/settings/notifications', async (req, res) => {
    try {
        await getNotificationDAO().save(req.body);

        // 更新定时任务
        await setupSubscriptionCheckSchedule();

        res.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        console.error('Save notification settings error:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// API: 手动触发订阅检查 (需要认证)
router.post('/check', async (req, res) => {
    try {
        const { force } = req.body;
        console.log('[API] 手动触发订阅检查, force:', force);

        // 异步执行检查，不阻塞响应
        runSubscriptionCheck(force === true).catch(err => {
            console.error('[API] 订阅检查执行失败:', err);
        });

        res.json({ success: true, message: '订阅检查已触发' });
    } catch (error) {
        console.error('Manual subscription check error:', error);
        res.status(500).json({ error: 'Failed to trigger check' });
    }
});

// API: 手动触发订阅检查 (别名路由，需要认证)
router.post('/check-expiry', async (req, res) => {
    try {
        const { force } = req.body;
        console.log('[API] 手动触发订阅检查 (check-expiry), force:', force);

        // 异步执行检查，不阻塞响应
        runSubscriptionCheck(force === true).catch(err => {
            console.error('[API] 订阅检查执行失败:', err);
        });

        res.json({ success: true, message: '订阅检查已触发，将在后台执行并发送通知' });
    } catch (error) {
        console.error('Manual subscription check error:', error);
        res.status(500).json({ error: 'Failed to trigger check' });
    }
});

// API: 测试通知发送 (不需要认证)
router.post('/test-notification', async (req, res) => {
    try {
        const { platform, settings: clientSettings } = req.body;

        // 优先使用前端传来的settings（支持测试未保存的配置）
        // 如果前端没传，则从数据库获取
        let settings = clientSettings;
        if (!settings || Object.keys(settings).length === 0) {
            settings = await getNotificationDAO().get() || {};
        }

        console.log('[Sub Test Notification] Platform:', platform);
        console.log('[Sub Test Notification] Using settings from:', clientSettings ? 'client' : 'database');
        console.log('[Sub Test Notification] Bark config:', settings.bark);

        const timezone = settings.timezone || 'Asia/Shanghai';
        const currentTime = new Date().toLocaleString('zh-CN', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const title = '订阅通知测试';
        const content = `这是一条测试通知，用于验证通知配置是否正确。\n\n发送时间: ${currentTime} \n时区: ${timezone} `;

        let results = [];

        // 根据指定的平台发送测试通知
        if (platform === 'bark') {
            const result = await sendBarkNotification(settings, title, content);
            console.log('[Sub Test Notification] Bark result:', result);
            if (!result.skipped) results.push(result);
        } else if (platform === 'telegram') {
            const result = await sendTelegramNotification(settings, title, content);
            if (!result.skipped) results.push(result);
        } else if (platform === 'email') {
            const result = await sendEmailNotification(settings, title, content);
            if (!result.skipped) results.push(result);
        } else if (platform === 'webhook') {
            const result = await sendWebhookNotification(settings, title, content);
            if (!result.skipped) results.push(result);
        } else {
            // 如果没有指定平台，发送所有启用的通知
            results = await sendAllNotifications(settings, title, content);
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: 'Failed to send test notification: ' + error.message });
    }
});

// API: 导出订阅数据 (仅导出当前用户的数据)
router.get('/export', async (req, res) => {
    try {
        const { userId } = getUserContext(req);
        const subscriptions = await getSubscriptionDAO().getAll(userId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename = subscriptions - backup - ${new Date().toISOString().split('T')[0]}.json`);
        res.json(subscriptions);
    } catch (error) {
        console.error('Export subscriptions error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to export subscriptions' });
    }
});

// API: 导入订阅数据 (自动注入当前用户的tenant_id和user_id)
router.post('/import', jsonUpload.single('file'), async (req, res) => {
    try {
        const { userId } = getUserContext(req);
        let data;

        // 支持文件上传
        if (req.file) {
            try {
                const jsonContent = req.file.buffer.toString('utf8');
                data = JSON.parse(jsonContent);
                // 如果是 { data: [...] } 格式，提取 data 字段
                if (data.data && Array.isArray(data.data)) {
                    data = data.data;
                }
            } catch (e) {
                return res.status(400).json({ error: 'Invalid JSON format' });
            }
        }
        // 兼容旧的 JSON Body 方式 (如果有)
        else if (req.body.data) {
            data = req.body.data;
        } else {
            return res.status(400).json({ error: 'No file uploaded or data provided' });
        }

        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Invalid data format: expected an array' });
        }

        // 验证数据格式
        for (const sub of data) {
            if (!sub.name || !sub.expiryDate) {
                return res.status(400).json({ error: 'Invalid subscription data: missing name or expiryDate' });
            }
        }

        // 导入数据 (自动注入tenant_id和user_id)
        let count = 0;
        for (const sub of data) {
            try {
                // 如果没有ID，生成新ID
                if (!sub.id) {
                    sub.id = uuidv4();
                }
                // 检查是否存在，如果存在则更新，否则创建
                const existing = await getSubscriptionDAO().getById(sub.id, userId);
                if (existing) {
                    await getSubscriptionDAO().update(sub.id, sub, userId);
                } else {
                    await getSubscriptionDAO().create(sub, userId);
                }
                count++;
            } catch (error) {
                console.error(`Failed to import subscription: ${sub.name} `, error);
            }
        }

        res.json({ success: true, message: `成功导入 ${count} 条订阅数据` });
    } catch (error) {
        console.error('Import subscriptions error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: 'Failed to import subscriptions: ' + error.message });
    }
});

// API: 清空所有订阅数据 (仅清空当前用户的数据)
router.delete('/clear', async (req, res) => {
    try {
        const { userId } = getUserContext(req);
        const subscriptions = await getSubscriptionDAO().getAll(userId);
        for (const sub of subscriptions) {
            await getSubscriptionDAO().delete(sub.id, userId);
        }
        res.json({ success: true, message: '所有订阅数据已清空' });
    } catch (error) {
        console.error('Clear subscriptions error:', error);
        res.status(error.message.includes('Missing user context') ? 400 : 500)
            .json({ error: error.message || 'Failed to clear subscriptions' });
    }
});

module.exports = router;
