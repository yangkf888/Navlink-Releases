const cron = require('node-cron');
const SubscriptionDAO = require('../database/dao/SubscriptionDAO');
const NotificationDAO = require('../database/dao/NotificationDAO');
const {
    calculateDaysRemaining,
    isInNotificationTimeRange,
    shouldSendNotification,
    markNotificationSent,
    readNotificationHistory,
    saveNotificationHistory,
    autoRenewSubscription
} = require('./subscriptionData');
const { sendAllNotifications } = require('./notification');

let subscriptionCheckJob = null;

// 延迟获取 DAO 实例
const getSubscriptionDAO = () => new SubscriptionDAO();
const getNotificationDAO = () => new NotificationDAO();

/**
 * 发送订阅到期通知
 */
async function sendExpiryNotifications(subscriptions, settings) {
    if (!settings.enableNotifications) {
        console.log('[订阅检查] 通知功能未启用');
        return { success: true, message: '通知功能未启用' };
    }

    const timezone = settings.timezone || 'Asia/Shanghai';

    // 构建通知内容
    let content = '📢 **订阅到期提醒**\n\n';

    subscriptions.forEach((sub, index) => {
        const daysRemaining = calculateDaysRemaining(sub.expiryDate, timezone);
        const statusEmoji = daysRemaining < 0 ? '🔴' : daysRemaining <= 3 ? '⚠️' : '🟡';
        const statusText = daysRemaining < 0 ? '已过期' : `还有${daysRemaining}天到期`;

        content += `${index + 1}. ${statusEmoji} **${sub.name}**\n`;
        content += `   类型: ${sub.customType || sub.category || '未分类'}\n`;
        content += `   到期: ${sub.expiryDate} (${statusText})\n`;
        if (sub.price) {
            content += `   价格: ${sub.currencySymbol || '¥'}${sub.price}/${sub.periodValue || 1}${sub.periodUnit === 'month' ? '月' : sub.periodUnit === 'year' ? '年' : '天'}\n`;
        }
        if (sub.notes) {
            content += `   备注: ${sub.notes}\n`;
        }
        content += '\n';
    });

    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: timezone });
    content += `发送时间: ${currentTime}\n时区: ${timezone}`;

    // 发送通知
    const results = await sendAllNotifications(
        settings,
        '订阅到期提醒',
        content,
        { subscriptions: JSON.stringify(subscriptions) }
    );

    console.log('[订阅检查] 通知发送结果:', results);
    return { success: true, results };
}

/**
 * 执行订阅检查
 */
async function runSubscriptionCheck(forceNotify = false) {
    console.log('[订阅检查] 开始检查订阅到期情况...');
    if (forceNotify) {
        console.log('[订阅检查] 强制模式：忽略通知间隔和次数限制');
    }

    try {
        // 获取通知设置
        const settings = await getNotificationDAO().get() || { enableNotifications: false };

        if (!settings.enableNotifications && !forceNotify) {
            console.log('[订阅检查] 通知功能未启用');
            return;
        }

        // 检查是否在通知时段内（强制模式下跳过）
        if (!forceNotify && !isInNotificationTimeRange(settings)) {
            const timezone = settings.timezone || 'Asia/Shanghai';
            const now = new Date();
            const currentTime = now.toLocaleTimeString('zh-CN', { timeZone: timezone, hour12: false });
            const timeRange = settings.notification?.timeRange;
            console.log(`[订阅检查] 当前时间 ${currentTime} 不在通知时段内 (${timeRange?.start} - ${timeRange?.end})`);
            return;
        }

        // 获取所有订阅 - 全局检查（不限定租户和用户）
        const subscriptionDAO = getSubscriptionDAO();
        const subscriptions = await new Promise((resolve, reject) => {
            subscriptionDAO.db.all(
                'SELECT * FROM subscriptions WHERE isActive = 1 ORDER BY expiryDate ASC',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        const notificationHistory = await readNotificationHistory();
        const timezone = settings.timezone || 'Asia/Shanghai';

        if (!subscriptions || subscriptions.length === 0) {
            console.log('[订阅检查] 没有订阅数据');
            return;
        }

        const needReminder = [];
        const renewedSubscriptions = [];

        // 检查每个订阅
        for (let sub of subscriptions) {
            if (!sub.isActive) {
                console.log(`[订阅检查] 订阅 "${sub.name}" 未启用，跳过`);
                continue;
            }

            // 尝试自动续订
            const renewed = await autoRenewSubscription(sub, timezone, sub.tenant_id, sub.user_id);
            if (renewed) {
                renewedSubscriptions.push(renewed);
                sub = renewed; // 使用续订后的数据继续检查
            }

            // 检查是否需要提醒
            const daysRemaining = calculateDaysRemaining(sub.expiryDate, timezone);
            let shouldRemind = false;

            // 根据 reminderUnit 判断
            if (sub.reminderUnit === 'day') {
                shouldRemind = daysRemaining >= 0 && daysRemaining <= sub.reminderValue;
            } else if (sub.reminderUnit === 'hour') {
                const reminderDays = Math.ceil(sub.reminderValue / 24);
                shouldRemind = daysRemaining >= 0 && daysRemaining <= reminderDays;
            } else {
                // 使用reminderDays字段（兼容旧数据）
                const reminderDays = (sub.reminderDays || '7,3,1').split(',').map(d => parseInt(d.trim()));
                shouldRemind = reminderDays.some(days => daysRemaining <= days && daysRemaining >= 0);
            }

            // 如果已过期且未启用自动续订，也需要提醒
            if (daysRemaining < 0 && !sub.autoRenew) {
                shouldRemind = true;
            }

            if (!shouldRemind) {
                continue;
            }

            // 检查是否应该发送通知（强制模式下跳过间隔和次数限制）
            if (!forceNotify && !shouldSendNotification(sub, notificationHistory, settings)) {
                continue;
            }

            console.log(`[订阅检查] 订阅 "${sub.name}" 需要提醒，剩余天数: ${daysRemaining}`);
            needReminder.push({ ...sub, daysRemaining });
        }

        // 输出续订信息
        if (renewedSubscriptions.length > 0) {
            console.log(`[订阅检查] 已自动续订 ${renewedSubscriptions.length} 个订阅`);
        }

        // 发送通知
        if (needReminder.length === 0) {
            console.log('[订阅检查] 没有需要提醒的订阅');
            return;
        }

        console.log(`[订阅检查] 准备发送 ${needReminder.length} 个订阅的通知`);

        // 发送通知
        const result = await sendExpiryNotifications(needReminder, settings);

        // 如果发送成功，记录通知历史（强制模式下也记录）
        if (result.success) {
            needReminder.forEach(sub => {
                markNotificationSent(sub, notificationHistory);
            });
            await saveNotificationHistory(notificationHistory);
            console.log('[订阅检查] 通知已发送并记录');
        }

    } catch (error) {
        console.error('[订阅检查] 检查失败:', error);
    }
}

/**
 * 设置订阅检查定时任务
 */
async function setupSubscriptionCheckSchedule() {
    try {
        // 停止现有任务
        if (subscriptionCheckJob) {
            subscriptionCheckJob.stop();
            subscriptionCheckJob = null;
        }

        const settings = await getNotificationDAO().get() || { enableNotifications: false };

        if (!settings.enableNotifications) {
            console.log('[订阅检查] 自动检查功能未启用');
            return;
        }

        // 每小时检查一次
        const cronExpression = '0 * * * *';

        if (cron.validate(cronExpression)) {
            subscriptionCheckJob = cron.schedule(cronExpression, () => runSubscriptionCheck(false));
            console.log('[订阅检查] 定时任务已设置: 每小时检查一次');

            // 启动时立即执行一次检查，处理之前可能错过的续订
            console.log('[订阅检查] 服务启动，立即执行一次完整检查...');
            setImmediate(() => runSubscriptionCheck(false));
        } else {
            console.error('[订阅检查] 无效的cron表达式:', cronExpression);
        }
    } catch (error) {
        console.error('[订阅检查] 设置定时任务失败:', error);
    }
}

module.exports = {
    runSubscriptionCheck,
    setupSubscriptionCheckSchedule
};
