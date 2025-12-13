const express = require('express');
const { v4: uuidv4 } = require('uuid');
const CustomReminderDAO = require('../database/dao/CustomReminderDAO');

const router = express.Router();

// 延迟获取 DAO 实例
const getReminderDAO = () => new CustomReminderDAO();

/**
 * 提取用户上下文（从 Gateway 传递的 Header）
 * 对于进程内插件，headers可能不存在，使用默认值
 */
function getUserContext(req) {
    const tenantId = req.headers['x-nav-tenant-id'] || 'default';
    const userId = req.headers['x-nav-user-id'] || 'user_1001';

    return { tenantId, userId };
}

// API: 获取所有自定义提醒
router.get('/', async (req, res) => {
    try {
        const reminders = await getReminderDAO().getAll();

        // 字段映射：后端存储为 targetDate/reminderDays，转换为前端期望的 reminderDate/reminderTime
        const mappedReminders = reminders.map(r => ({
            ...r,
            reminderDate: r.targetDate,
            reminderTime: r.reminderTime || '09:00',  // 使用数据库中的时间，如果没有则默认09:00
            notified: false  // 默认未通知
        }));

        res.json(mappedReminders);
    } catch (error) {
        console.error('Get reminders error:', error);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

// API: 创建自定义提醒
router.post('/', async (req, res) => {
    try {
        const { tenantId, userId } = getUserContext(req);

        // 字段映射：前端使用 reminderDate/reminderTime，后端存储为 targetDate/reminderTime
        const newReminder = {
            id: uuidv4(),
            title: req.body.title,
            description: req.body.description || '',
            targetDate: req.body.reminderDate,  // 映射字段
            reminderTime: req.body.reminderTime || '09:00',  // 保存用户输入的时间
            reminderDays: '7,3,1',  // 默认提醒天数
            category: req.body.category || '',
            isActive: req.body.isActive !== undefined ? req.body.isActive : true,
            createdAt: new Date().toISOString()
        };

        const created = await getReminderDAO().create(newReminder, tenantId, userId);

        // 返回时转换回前端格式
        const response = {
            ...created,
            reminderDate: created.targetDate,
            reminderTime: created.reminderTime || '09:00',  // 返回数据库中的时间
            notified: false
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Create reminder error:', error);
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// API: 更新自定义提醒
router.put('/:id', async (req, res) => {
    try {
        const updated = await getReminderDAO().update(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        res.json(updated);
    } catch (error) {
        console.error('Update reminder error:', error);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

// API: 删除自定义提醒
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await getReminderDAO().delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        res.json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        console.error('Delete reminder error:', error);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

module.exports = router;
