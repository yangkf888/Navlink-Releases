#!/usr/bin/env node

/**
 * Sub插件数据迁移脚本
 * 从旧应用的navlink.db迁移订阅和提醒数据到新插件的sub.db
 */

const sqlite3 = require('sqlite3').Database;
const path = require('path');
const fs = require('fs');

// 数据库路径
const OLD_DB = path.join(__dirname, '../../../../data/navlink.db');
const NEW_DB = path.join(__dirname, '../../../data/sub.db');

console.log('[迁移] Sub数据迁移脚本');
console.log('[迁移] 源数据库:', OLD_DB);
console.log('[迁移] 目标数据库:', NEW_DB);

// 检查源数据库是否存在
if (!fs.existsSync(OLD_DB)) {
    console.error('[迁移] ❌ 源数据库不存在:', OLD_DB);
    process.exit(1);
}

// 确保目标数据目录存在
const dataDir = path.dirname(NEW_DB);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[迁移] ✓ 创建数据目录:', dataDir);
}

// 打开数据库连接
const oldDb = new sqlite3(OLD_DB, (err) => {
    if (err) {
        console.error('[迁移] ❌ 无法打开源数据库:', err);
        process.exit(1);
    }
    console.log('[迁移] ✓ 已连接源数据库');
});

const newDb = new sqlite3(NEW_DB, (err) => {
    if (err) {
        console.error('[迁移] ❌ 无法打开目标数据库:', err);
        process.exit(1);
    }
    console.log('[迁移] ✓ 已连接目标数据库');
});

// 确保新数据库有正确的表结构
function ensureSchema(callback) {
    console.log('[迁移] 检查目标数据库schema...');

    newDb.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            category TEXT DEFAULT '',
            price REAL DEFAULT 0,
            currency TEXT DEFAULT 'CNY',
            billingCycle TEXT DEFAULT 'monthly',
            expiryDate TEXT NOT NULL,
            reminderDays TEXT DEFAULT '7,3,1',
            isActive INTEGER DEFAULT 1,
            notes TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS custom_reminders (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            targetDate TEXT NOT NULL,
            reminderDays TEXT DEFAULT '7,3,1',
            isActive INTEGER DEFAULT 1,
            category TEXT DEFAULT '',
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            settings TEXT NOT NULL,
            updatedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expiryDate);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(isActive);
        CREATE INDEX IF NOT EXISTS idx_reminders_date ON custom_reminders(targetDate);
        CREATE INDEX IF NOT EXISTS idx_reminders_active ON custom_reminders(isActive);
    `, (err) => {
        if (err) {
            console.error('[迁移] ❌ 创建schema失败:', err);
            process.exit(1);
        }
        console.log('[迁移] ✓ Schema已准备好');
        callback();
    });
}

// 迁移订阅数据
function migrateSubscriptions(callback) {
    console.log('\n[迁移] === 开始迁移订阅数据 ===');

    oldDb.all('SELECT * FROM subscriptions', [], (err, rows) => {
        if (err) {
            console.error('[迁移] ❌ 读取订阅数据失败:', err);
            callback(err);
            return;
        }

        if (!rows || rows.length === 0) {
            console.log('[迁移] ⚠️ 没有订阅数据需要迁移');
            callback();
            return;
        }

        console.log(`[迁移] 找到 ${rows.length} 条订阅记录`);
        let completed = 0;
        let errors = 0;

        rows.forEach((old) => {
            // 映射字段：旧结构 -> 新结构
            const newRecord = {
                id: old.id,
                name: old.name,
                description: old.notes || '',
                category: old.category || old.custom_type || '',
                price: old.price || 0,
                currency: old.currency || 'CNY',
                // 映射billingCycle
                billingCycle: mapPeriodToCycle(old.period_unit, old.period_value),
                expiryDate: old.expiry_date,
                // 映射reminderDays
                reminderDays: mapReminderDays(old.reminder_unit, old.reminder_value),
                isActive: old.is_active ? 1 : 0,
                notes: old.notes || '',
                tags: old.category || '',
                createdAt: old.created_at || new Date().toISOString(),
                updatedAt: old.updated_at || new Date().toISOString()
            };

            const sql = `INSERT OR REPLACE INTO subscriptions (
                id, name, description, category, price, currency, billingCycle,
                expiryDate, reminderDays, isActive, notes, tags, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                newRecord.id, newRecord.name, newRecord.description, newRecord.category,
                newRecord.price, newRecord.currency, newRecord.billingCycle,
                newRecord.expiryDate, newRecord.reminderDays, newRecord.isActive,
                newRecord.notes, newRecord.tags, newRecord.createdAt, newRecord.updatedAt
            ];

            newDb.run(sql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[迁移] ❌ 插入订阅失败 (${old.name}):`, insertErr.message);
                    errors++;
                } else {
                    console.log(`[迁移] ✓ 迁移订阅: ${old.name}`);
                }

                completed++;
                if (completed === rows.length) {
                    console.log(`[迁移] === 订阅迁移完成: 成功 ${completed - errors}, 失败 ${errors} ===\n`);
                    callback(errors > 0 ? new Error(`${errors} errors`) : null);
                }
            });
        });
    });
}

// 迁移自定义提醒数据
function migrateReminders(callback) {
    console.log('[迁移] === 开始迁移自定义提醒数据 ===');

    oldDb.all('SELECT * FROM custom_reminders', [], (err, rows) => {
        if (err) {
            console.error('[迁移] ❌ 读取提醒数据失败:', err);
            callback(err);
            return;
        }

        if (!rows || rows.length === 0) {
            console.log('[迁移] ⚠️ 没有提醒数据需要迁移');
            callback();
            return;
        }

        console.log(`[迁移] 找到 ${rows.length} 条提醒记录`);
        let completed = 0;
        let errors = 0;

        rows.forEach((old) => {
            // 映射字段
            const newRecord = {
                id: old.id,
                title: old.title,
                description: old.description || '',
                targetDate: old.reminder_date,
                reminderDays: '7,3,1', // 默认提醒
                isActive: old.is_completed ? 0 : 1, // 已完成的标记为不活跃
                category: old.category || '',
                createdAt: old.created_at || new Date().toISOString(),
                updatedAt: old.updated_at || new Date().toISOString()
            };

            const sql = `INSERT OR REPLACE INTO custom_reminders (
                id, title, description, targetDate, reminderDays, isActive, category, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                newRecord.id, newRecord.title, newRecord.description, newRecord.targetDate,
                newRecord.reminderDays, newRecord.isActive, newRecord.category,
                newRecord.createdAt, newRecord.updatedAt
            ];

            newDb.run(sql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[迁移] ❌ 插入提醒失败 (${old.title}):`, insertErr.message);
                    errors++;
                } else {
                    console.log(`[迁移] ✓ 迁移提醒: ${old.title}`);
                }

                completed++;
                if (completed === rows.length) {
                    console.log(`[迁移] === 提醒迁移完成: 成功 ${completed - errors}, 失败 ${errors} ===\n`);
                    callback(errors > 0 ? new Error(`${errors} errors`) : null);
                }
            });
        });
    });
}

// 迁移通知设置
function migrateNotificationSettings(callback) {
    console.log('[迁移] === 开始迁移通知设置 ===');

    oldDb.get('SELECT * FROM notification_settings LIMIT 1', [], (err, row) => {
        if (err) {
            console.error('[迁移] ❌ 读取通知设置失败:', err);
            callback(err);
            return;
        }

        if (!row) {
            console.log('[迁移] ⚠️ 没有通知设置需要迁移');
            callback();
            return;
        }

        console.log('[迁移] 找到通知设置');

        const sql = `INSERT OR REPLACE INTO notification_settings (id, settings, updatedAt) VALUES (1, ?, ?)`;

        newDb.run(sql, [row.settings || '{}', row.updated_at || new Date().toISOString()], function (insertErr) {
            if (insertErr) {
                console.error('[迁移] ❌ 插入通知设置失败:', insertErr.message);
                callback(insertErr);
            } else {
                console.log('[迁移] ✓ 迁移通知设置完成\n');
                callback();
            }
        });
    });
}

// 工具函数：映射周期
function mapPeriodToCycle(unit, value) {
    if (!unit || !value) return 'monthly';

    if (unit === 'year' || (unit === 'month' && value >= 12)) {
        return 'yearly';
    } else if (unit === 'month') {
        if (value === 1) return 'monthly';
        if (value === 3) return 'quarterly';
        if (value === 6) return 'semi-annually';
        return 'monthly';
    } else if (unit === 'day') {
        if (value === 7) return 'weekly';
        if (value >= 28 && value <= 31) return 'monthly';
        return 'monthly';
    }

    return 'monthly';
}

// 工具函数：映射提醒天数
function mapReminderDays(unit, value) {
    if (!unit || !value) return '7,3,1';

    if (unit === 'day') {
        return `${value},3,1`;
    } else if (unit === 'hour') {
        const days = Math.ceil(value / 24);
        return `${days},1`;
    }

    return '7,3,1';
}

// 验证迁移结果
function verifyMigration(callback) {
    console.log('[迁移] === 验证迁移结果 ===');

    newDb.get('SELECT COUNT(*) as count FROM subscriptions', [], (err, result) => {
        if (err) {
            console.error('[迁移] ❌ 验证失败:', err);
            callback(err);
            return;
        }
        console.log(`[迁移] ✓ 新数据库中有 ${result.count} 条订阅`);

        newDb.get('SELECT COUNT(*) as count FROM custom_reminders', [], (err2, result2) => {
            if (err2) {
                console.error('[迁移] ❌ 验证失败:', err2);
                callback(err2);
                return;
            }
            console.log(`[迁移] ✓ 新数据库中有 ${result2.count} 条提醒`);
            callback();
        });
    });
}

// 主流程
function main() {
    ensureSchema(() => {
        migrateSubscriptions((err1) => {
            if (err1) console.warn('[迁移] ⚠️ 订阅迁移有错误，继续...');

            migrateReminders((err2) => {
                if (err2) console.warn('[迁移] ⚠️ 提醒迁移有错误，继续...');

                migrateNotificationSettings((err3) => {
                    if (err3) console.warn('[迁移] ⚠️ 通知设置迁移有错误，继续...');

                    verifyMigration(() => {
                        oldDb.close();
                        newDb.close();
                        console.log('\n[迁移] ========================================');
                        console.log('[迁移] 🎉 数据迁移完成！');
                        console.log('[迁移] ========================================\n');
                        process.exit(0);
                    });
                });
            });
        });
    });
}

// 运行
main();
