const DatabaseWrapper = require('./db-wrapper.js');
const path = require('path');
const fs = require('fs');

// 数据库路径：navlink-next/data/sub.db
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'sub.db');

let db = null;

/**
 * 获取数据库实例
 */
function getDatabase() {
    return db;
}

/**
 * 初始化数据库连接
 */
function initDatabase() {
    if (db) return db;

    // 确保data目录存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 创建数据库连接
    db = new DatabaseWrapper(DB_PATH);

    // 初始化表结构
    initSchema(db);

    console.log('[Database] SQLite initialized at:', DB_PATH);

    return db;
}

/**
 * 初始化表结构
 */
function initSchema(db) {
    // 订阅表
    db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    customType TEXT DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    isActive INTEGER DEFAULT 1,
    autoRenew INTEGER DEFAULT 0,
    startDate TEXT DEFAULT '',
    expiryDate TEXT NOT NULL,
    periodValue INTEGER DEFAULT 1,
    periodUnit TEXT DEFAULT 'month',
    reminderValue INTEGER DEFAULT 7,
    reminderUnit TEXT DEFAULT 'day',
    useLunar INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    currencySymbol TEXT DEFAULT '¥',
    billingCycle TEXT DEFAULT 'monthly',
    reminderDays TEXT DEFAULT '7,3,1',
    createdAt TEXT,
    updatedAt TEXT
);

--自定义提醒表
        CREATE TABLE IF NOT EXISTS custom_reminders(
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    targetDate TEXT NOT NULL,
    reminderDays TEXT DEFAULT '7,3,1',
    isActive INTEGER DEFAULT 1,
    category TEXT DEFAULT '',
    createdAt TEXT,
    updatedAt TEXT
);

--通知设置表
        CREATE TABLE IF NOT EXISTS notification_settings(
    id INTEGER PRIMARY KEY CHECK(id = 1),
    settings TEXT NOT NULL,
    updatedAt TEXT
);

--创建索引
        CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expiryDate);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(isActive);
        CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON custom_reminders(tenant_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_date ON custom_reminders(targetDate);
        CREATE INDEX IF NOT EXISTS idx_reminders_active ON custom_reminders(isActive);
`, (err) => {
        if (err) {
            console.error('[Database] Failed to initialize schema:', err);
        } else {
            console.log('[Database] Schema initialized, starting migrations...');
            // 执行迁移
            runMigrations(db);
        }
    });
}

/**
 * 运行数据库迁移
 */
function runMigrations(db) {
    // 迁移1：为 subscriptions 表添加缺失的列
    const subscriptionMigrations = [
        { sql: `ALTER TABLE subscriptions ADD COLUMN customType TEXT DEFAULT ''`, name: 'customType' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN autoRenew INTEGER DEFAULT 0`, name: 'autoRenew' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN startDate TEXT DEFAULT ''`, name: 'startDate' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN periodValue INTEGER DEFAULT 1`, name: 'periodValue' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN periodUnit TEXT DEFAULT 'month'`, name: 'periodUnit' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN reminderValue INTEGER DEFAULT 7`, name: 'reminderValue' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN reminderUnit TEXT DEFAULT 'day'`, name: 'reminderUnit' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN useLunar INTEGER DEFAULT 0`, name: 'useLunar' },
        { sql: `ALTER TABLE subscriptions ADD COLUMN currencySymbol TEXT DEFAULT '¥'`, name: 'currencySymbol' }
    ];

    let subscriptionCompleted = 0;
    subscriptionMigrations.forEach(migration => {
        db.exec(migration.sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error(`[Database] Failed to add ${migration.name}:`, err.message);
            }
            subscriptionCompleted++;
            if (subscriptionCompleted === subscriptionMigrations.length) {
                console.log('[Database] Subscriptions table migration completed');
                // 继续 custom_reminders 迁移
                migrateCustomReminders(db);
            }
        });
    });
}

/**
 * 迁移 custom_reminders 表
 */
function migrateCustomReminders(db) {
    // 添加reminderTime字段（如果不存在）
    db.exec(`ALTER TABLE custom_reminders ADD COLUMN reminderTime TEXT DEFAULT '09:00'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('[Database] Failed to add reminderTime column:', err);
        } else {
            console.log('[Database] reminderTime column migration completed');

            // 添加notified字段（如果不存在）
            db.exec(`ALTER TABLE custom_reminders ADD COLUMN notified INTEGER DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('[Database] Failed to add notified column:', err);
                } else {
                    console.log('[Database] All schema migrations completed successfully');
                }
            });
        }
    });
}

module.exports = {
    initDatabase,
    getDatabase
};
