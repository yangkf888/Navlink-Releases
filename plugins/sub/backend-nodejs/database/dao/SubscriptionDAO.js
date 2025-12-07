const { getDatabase } = require('../index');

class SubscriptionDAO {
    constructor() {
        this.db = getDatabase();
    }

    /**
     * 提取租户和用户上下文
     */
    _getTenantContext(req) {
        const tenantId = req?.headers?.['x-nav-tenant-id'] || 'default';
        const userId = req?.headers?.['x-nav-user-id'];
        return { tenantId, userId };
    }

    /**
     * 获取所有订阅 (带租户过滤)
     */
    getAll(tenantId, userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM subscriptions WHERE tenant_id = ? AND user_id = ? ORDER BY expiryDate ASC',
                [tenantId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    /**
     * 根据ID获取订阅 (带租户验证)
     */
    getById(id, tenantId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM subscriptions WHERE id = ? AND tenant_id = ? AND user_id = ?',
                [id, tenantId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    /**
     * 创建订阅 (强制注入tenant_id和user_id)
     */
    create(subscription, tenantId, userId) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO subscriptions (
                id, tenant_id, user_id, name, customType, category, notes, 
                isActive, autoRenew, startDate, expiryDate,
                periodValue, periodUnit, reminderValue, reminderUnit, useLunar,
                price, currency, currencySymbol, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                subscription.id,
                tenantId,  // 强制注入
                userId,    // 强制注入
                subscription.name,
                subscription.customType || '',
                subscription.category || '',
                subscription.notes || '',
                subscription.isActive !== undefined ? (subscription.isActive ? 1 : 0) : 1,
                subscription.autoRenew !== undefined ? (subscription.autoRenew ? 1 : 0) : 0,
                subscription.startDate || '',
                subscription.expiryDate,
                subscription.periodValue || 1,
                subscription.periodUnit || 'month',
                subscription.reminderValue || 7,
                subscription.reminderUnit || 'day',
                subscription.useLunar !== undefined ? (subscription.useLunar ? 1 : 0) : 0,
                subscription.price || 0,
                subscription.currency || 'CNY',
                subscription.currencySymbol || '¥',
                subscription.createdAt || new Date().toISOString(),
                subscription.updatedAt || new Date().toISOString()
            ];

            const db = this.db;
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                // Return the created subscription
                db.get('SELECT * FROM subscriptions WHERE id = ?', [subscription.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        });
    }

    /**
     * 更新订阅 (验证租户所有权)
     */
    update(id, data, tenantId, userId) {
        return new Promise((resolve, reject) => {
            const updates = [];
            const params = [];

            const fields = [
                'name', 'customType', 'category', 'notes',
                'isActive', 'autoRenew', 'startDate', 'expiryDate',
                'periodValue', 'periodUnit', 'reminderValue', 'reminderUnit', 'useLunar',
                'price', 'currency', 'currencySymbol'
            ];

            fields.forEach(field => {
                if (data[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    if (field === 'isActive' || field === 'autoRenew' || field === 'useLunar') {
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
            params.push(tenantId);  // 验证租户
            params.push(userId);    // 验证用户

            const sql = `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ? AND user_id = ?`;

            const db = this.db;
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                if (this.changes === 0) return resolve(null);
                // Return the updated subscription
                db.get('SELECT * FROM subscriptions WHERE id = ?', [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        });
    }

    /**
     * 删除订阅 (验证租户所有权)
     */
    delete(id, tenantId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM subscriptions WHERE id = ? AND tenant_id = ? AND user_id = ?',
                [id, tenantId, userId],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * 按分类查询 (带租户过滤)
     */
    getByCategory(category, tenantId, userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM subscriptions WHERE category = ? AND tenant_id = ? AND user_id = ? ORDER BY expiryDate ASC',
                [category, tenantId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    /**
     * 查询即将到期的订阅 (带租户过滤)
     */
    getExpiringSoon(days, tenantId, userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM subscriptions 
                 WHERE isActive = 1 
                 AND tenant_id = ?
                 AND user_id = ?
                 AND date(expiryDate) <= date('now', '+' || ? || ' days')
                 ORDER BY expiryDate ASC`,
                [tenantId, userId, days],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
}

module.exports = SubscriptionDAO;
