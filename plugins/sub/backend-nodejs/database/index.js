const sqlite3 = require('sqlite3').Database;
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
    db = new sqlite3(DB_PATH, (err) => {
        if (err) {
            console.error('[Database] Failed to connect:', err);
            throw err;
        }
    });

    // 启用 WAL 模式（性能优化）
    db.run('PRAGMA journal_mode = WAL');

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

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

        -- 自定义提醒表
        CREATE TABLE IF NOT EXISTS custom_reminders (
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

        -- 通知设置表
        CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            settings TEXT NOT NULL,
            updatedAt TEXT
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expiryDate);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(isActive);
        CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON custom_reminders(tenant_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_date ON custom_reminders(targetDate);
        CREATE INDEX IF NOT EXISTS idx_reminders_active ON custom_reminders(isActive);
    `, (err) => {
        if (err) {
            console.error('[Database] Failed to initialize schema:', err);
        }
    });
}

module.exports = {
    initDatabase,
    getDatabase
};
