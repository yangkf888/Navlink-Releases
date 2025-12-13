const cron = require('node-cron');
const CustomReminderDAO = require('../database/dao/CustomReminderDAO');
const NotificationDAO = require('../database/dao/NotificationDAO');
const { sendAllNotifications } = require('./notification');

let reminderCheckJob = null;

// 延迟获取 DAO 实例
const getReminderDAO = () => new CustomReminderDAO();
const getNotificationDAO = () => new NotificationDAO();

/**
 * 发送提醒通知
 */
async function sendReminderNotifications(reminders, settings) {
    if (!settings.enableNotifications) {
        console.log('[提醒检查] 通知功能未启用');
        return { success: true, message: '通知功能未启用' };
    }

    const timezone = settings.timezone || 'Asia/Shanghai';

    // 构建通知内容
    let content = '⏰ **自定义提醒**\n\n';

    reminders.forEach((reminder, index) => {
        content += `${index + 1}. 📌 **${reminder.title}**\n`;
        if (reminder.description) {
            content += `   ${reminder.description}\n`;
        }
        content += `   时间: ${reminder.targetDate} ${reminder.reminderTime}\n`;
        if (reminder.category) {
            content += `   分类: ${reminder.category}\n`;
        }
        content += '\n';
    });

    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: timezone });
    content += `发送时间: ${currentTime}\n时区: ${timezone}`;

    // 发送通知
    const results = await sendAllNotifications(
        settings,
        '自定义提醒通知',
        content,
        { reminders: JSON.stringify(reminders) }
    );

    console.log('[提醒检查] 通知发送结果:', results);
    return { success: true, results };
}

/**
 * 检查提醒是否已到时间
 * @param {Object} reminder - 提醒对象
 * @param {string} timezone - 时区
 * @returns {boolean}
 */
function isReminderDue(reminder, timezone) {
    try {
        // 组合日期和时间
        const reminderDateTimeStr = `${reminder.targetDate}T${reminder.reminderTime}:00`;
        const reminderDateTime = new Date(reminderDateTimeStr);

        // 获取当前时间（指定时区）
        const now = new Date();
        const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        // 检查是否已到时间（精确到分钟）
        const reminderTime = Math.floor(reminderDateTime.getTime() / 60000); // 转换为分钟
        const currentTime = Math.floor(nowInTimezone.getTime() / 60000);

        return currentTime >= reminderTime;
    } catch (error) {
        console.error('[提醒检查] 时间比较错误:', error, reminder);
        return false;
    }
}

/**
 * 执行提醒检查
 */
async function runReminderCheck() {
    try {
        // 获取通知设置
        const settings = await getNotificationDAO().get() || { enableNotifications: false };

        if (!settings.enableNotifications) {
            console.log('[提醒检查] 通知功能未启用');
            return;
        }

        const timezone = settings.timezone || 'Asia/Shanghai';

        // 获取所有未通知的活跃提醒
        const reminders = await getReminderDAO().getActiveReminders();

        if (!reminders || reminders.length === 0) {
            return; // 没有提醒需要检查，不输出日志避免刷屏
        }

        const dueReminders = [];

        // 检查每个提醒是否已到时间
        for (const reminder of reminders) {
            if (isReminderDue(reminder, timezone)) {
                console.log(`[提醒检查] 提醒 "${reminder.title}" 已到时间，准备发送通知`);
                dueReminders.push(reminder);
            }
        }

        // 如果没有到时间的提醒，直接返回
        if (dueReminders.length === 0) {
            return;
        }

        console.log(`[提醒检查] 准备发送 ${dueReminders.length} 个提醒的通知`);

        // 发送通知
        const result = await sendReminderNotifications(dueReminders, settings);

        // 如果发送成功，标记为已通知
        if (result.success) {
            for (const reminder of dueReminders) {
                await getReminderDAO().markAsNotified(reminder.id);
                console.log(`[提醒检查] 提醒已标记为已通知: ${reminder.id}`);
            }
            console.log('[提醒检查] 所有提醒通知已发送并标记');
        }

    } catch (error) {
        console.error('[提醒检查] 检查失败:', error);
    }
}

/**
 * 设置提醒检查定时任务
 */
async function setupReminderCheckSchedule() {
    try {
        // 停止现有任务
        if (reminderCheckJob) {
            reminderCheckJob.stop();
            reminderCheckJob = null;
        }

        // 每分钟检查一次
        const cronExpression = '* * * * *';

        if (cron.validate(cronExpression)) {
            reminderCheckJob = cron.schedule(cronExpression, () => runReminderCheck());
            console.log('[提醒检查] 定时任务已设置: 每分钟检查一次');

            // 启动时立即执行一次检查
            console.log('[提醒检查] 服务启动，立即执行一次检查...');
            setImmediate(() => runReminderCheck());
        } else {
            console.error('[提醒检查] 无效的cron表达式:', cronExpression);
        }
    } catch (error) {
        console.error('[提醒检查] 设置定时任务失败:', error);
    }
}

module.exports = {
    runReminderCheck,
    setupReminderCheckSchedule
};
