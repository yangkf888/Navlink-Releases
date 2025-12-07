const { getDatabase } = require('../index');

class NotificationDAO {
    constructor() {
        this.db = getDatabase();
    }

    /**
     * 获取通知设置
     */
    /**
     * 获取通知设置
     */
    get() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT settings FROM notification_settings WHERE id = 1', [], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                try {
                    const settings = JSON.parse(row.settings);
                    resolve(settings);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    /**
     * 保存通知设置
     */
    save(settings) {
        return new Promise((resolve, reject) => {
            const settingsJson = JSON.stringify(settings);
            const sql = `INSERT OR REPLACE INTO notification_settings (id, settings, updatedAt) VALUES (1, ?, ?)`;

            this.db.run(sql, [settingsJson, new Date().toISOString()], function (err) {
                if (err) reject(err);
                else resolve(true);
            });
        });
    }
}

module.exports = NotificationDAO;
