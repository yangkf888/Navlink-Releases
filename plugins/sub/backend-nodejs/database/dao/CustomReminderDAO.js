const { getDatabase } = require('../index');

class CustomReminderDAO {
    constructor() {
        this.db = getDatabase();
    }

    /**
     * 获取所有自定义提醒
     */
    /**
     * 获取所有自定义提醒
     */
    getAll() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM custom_reminders ORDER BY targetDate ASC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * 根据ID获取提醒
     */
    getById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM custom_reminders WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * 创建提醒（支持多租户）
     */
    create(reminder, tenantId, userId) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO custom_reminders (
                id, tenant_id, user_id, title, description, targetDate, reminderTime, reminderDays, isActive, category, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                reminder.id,
                tenantId || 'default',
                userId || 'user_1001',
                reminder.title,
                reminder.description || '',
                reminder.targetDate,
                reminder.reminderTime || '09:00',  // 新增
                reminder.reminderDays || '7,3,1',
                reminder.isActive !== undefined ? (reminder.isActive ? 1 : 0) : 1,
                reminder.category || '',
                reminder.createdAt || new Date().toISOString(),
                reminder.updatedAt || new Date().toISOString()
            ];

            const db = this.db;
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                db.get('SELECT * FROM custom_reminders WHERE id = ?', [reminder.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        });
    }

    /**
     * 更新提醒
     */
    update(id, data) {
        return new Promise((resolve, reject) => {
            const updates = [];
            const params = [];

            const fields = ['title', 'description', 'targetDate', 'reminderTime', 'reminderDays', 'isActive', 'category'];

            fields.forEach(field => {
                if (data[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    if (field === 'isActive') {
                        params.push(data[field] ? 1 : 0);
                    } else {
                        params.push(data[field]);
                    }
                }
            });

            if (updates.length === 0) {
                return resolve(null);
            }

            updates.push('updatedAt = ?');
            params.push(new Date().toISOString());
            params.push(id);

            const sql = `UPDATE custom_reminders SET ${updates.join(', ')} WHERE id = ?`;

            const db = this.db;
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                if (this.changes === 0) return resolve(null);
                db.get('SELECT * FROM custom_reminders WHERE id = ?', [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        });
    }

    /**
     * 删除提醒
     */
    delete(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM custom_reminders WHERE id = ?', [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    }

    /**
     * 查询即将到期的提醒
     */
    getUpcoming(days) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM custom_reminders 
                 WHERE isActive = 1 
                 AND date(targetDate) <= date('now', '+' || ? || ' days')
                 ORDER BY targetDate ASC`,
                [days],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    /**
     * 获取所有未通知的活跃提醒
     */
    getActiveReminders() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM custom_reminders 
                 WHERE isActive = 1 
                 AND (notified IS NULL OR notified = 0)
                 ORDER BY targetDate ASC, reminderTime ASC`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * 标记提醒为已通知
     */
    markAsNotified(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE custom_reminders SET notified = 1, updatedAt = ? WHERE id = ?',
                [new Date().toISOString(), id],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }
}

module.exports = CustomReminderDAO;
