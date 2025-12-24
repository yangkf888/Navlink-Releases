const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * 初始化数据库
 */
function initDatabase() {
    const dataDir = path.join(process.cwd(), 'data');

    // 确保 data 目录存在
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'kbrag.db');
    console.log('[kbrag] Database path:', dbPath);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // 创建表
    db.exec(`
        -- 知识条目表
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            url TEXT,
            tags TEXT DEFAULT '[]',
            category TEXT DEFAULT '',
            note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            embedded INTEGER DEFAULT 0
        );

        -- 标签表
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#3B82F6',
            created_at TEXT NOT NULL
        );

        -- 分类表
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#3B82F6',
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        -- 配置表
        CREATE TABLE IF NOT EXISTS kb_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_items_created_at ON knowledge_items(created_at);
        CREATE INDEX IF NOT EXISTS idx_items_embedded ON knowledge_items(embedded);
    `);

    // 数据库迁移：添加 category 字段（如果不存在）
    try {
        db.exec(`ALTER TABLE knowledge_items ADD COLUMN category TEXT DEFAULT ''`);
        console.log('[kbrag] Added category column to knowledge_items');
    } catch (e) {
        // 字段已存在，忽略
    }

    // 创建分类索引（在迁移后）
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_items_category ON knowledge_items(category)`);
    } catch (e) {
        // 索引创建失败，忽略
    }

    console.log('[kbrag] Database initialized');
    return db;
}

/**
 * 获取数据库实例
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

module.exports = {
    initDatabase,
    getDb
};
