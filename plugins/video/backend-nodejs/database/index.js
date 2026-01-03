const DatabaseWrapper = require('./db-wrapper.js');
const path = require('path');
const fs = require('fs');

// 数据库路径：navlink-next/data/video.db
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'video.db');

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

    console.log('[Database] Video SQLite initialized at:', DB_PATH);

    return db;
}

/**
 * 初始化表结构
 */
function initSchema(db) {
    db.exec(`
        -- 视频源配置
        CREATE TABLE IF NOT EXISTS video_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'cms_api',
            url TEXT NOT NULL,
            api_key TEXT,
            enabled INTEGER DEFAULT 1,
            hidden INTEGER DEFAULT 0,
            tags TEXT,
            remark TEXT,
            response_time INTEGER,
            last_test_at DATETIME,
            failure_count INTEGER DEFAULT 0,
            status_message TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            parser_url TEXT
        );

        -- 分类表
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER,
            type_id TEXT,
            name TEXT NOT NULL,
            parent_id INTEGER DEFAULT 0,
            show_on_home INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES video_sources(id) ON DELETE CASCADE
        );

        -- 收藏表
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT '0',
            source_id INTEGER,
            vod_id TEXT NOT NULL,
            title TEXT,
            cover TEXT,
            year TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES video_sources(id) ON DELETE CASCADE,
            UNIQUE(user_id, source_id, vod_id)
        );

        -- 播放记录
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT '0',
            source_id INTEGER,
            vod_id TEXT NOT NULL,
            title TEXT,
            cover TEXT,
            episode INTEGER DEFAULT 1,
            episode_name TEXT,
            progress REAL DEFAULT 0,
            duration REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES video_sources(id) ON DELETE CASCADE,
            UNIQUE(user_id, source_id, vod_id)
        );

        -- 设置表
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- 首页缓存表
        CREATE TABLE IF NOT EXISTS home_cache (
            key TEXT PRIMARY KEY,
            data TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_categories_source ON categories(source_id);
        CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
        CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
        CREATE INDEX IF NOT EXISTS idx_favorites_source ON favorites(source_id);
        CREATE INDEX IF NOT EXISTS idx_history_user ON play_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_history_user ON play_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_history_source ON play_history(source_id);
        CREATE INDEX IF NOT EXISTS idx_history_updated ON play_history(updated_at);

        -- 电视源表
        CREATE TABLE IF NOT EXISTS tv_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'm3u',
            enabled INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            parser TEXT -- 自定义解析逻辑标识，预留
        );

        -- 直播源表
        CREATE TABLE IF NOT EXISTS live_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            platform TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            streamer_name TEXT,
            category TEXT,
            cover_url TEXT,
            enabled INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            tags TEXT,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 直播状态缓存表
        CREATE TABLE IF NOT EXISTS live_status_cache (
            source_id INTEGER PRIMARY KEY,
            is_live INTEGER DEFAULT 0,
            title TEXT,
            viewer_count INTEGER,
            stream_url TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES live_sources(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) {
            console.error('[Database] Failed to initialize schema:', err);
        } else {
            console.log('[Database] Video schema initialized');

            // 迁移：为旧数据库添加新列
            migrateSchema(db);

            // 插入默认设置
            insertDefaultSettings(db);

            // 插入预置资源站
            insertDefaultSources(db);

            // 插入预置电视源
            insertDefaultTvSources(db);
        }
    });
}

/**
 * 插入预置电视源
 */
function insertDefaultTvSources(db) {
    const existing = db.get('SELECT COUNT(*) as count FROM tv_sources');
    if (existing && existing.count > 0) return;

    const sources = [
        { name: '默认直播源', url: 'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u', type: 'm3u', order: 1 },
        { name: 'IPv6 直播源', url: 'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/ipv6/result.m3u', type: 'm3u', order: 2 },
        { name: 'IPv4 直播源', url: 'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/ipv4/result.m3u', type: 'm3u', order: 3 },
        { name: '点播源 (JSON)', url: 'https://raw.githubusercontent.com/Guovin/iptv-api/gd/source.json', type: 'json', order: 4 }
    ];

    const stmt = db.prepare('INSERT INTO tv_sources (name, url, type, sort_order, enabled) VALUES (?, ?, ?, ?, 1)');

    for (const s of sources) {
        try {
            stmt.run([s.name, s.url, s.type, s.order]);
            console.log(`[Database] Preset TV source added: ${s.name}`);
        } catch (e) {
            console.error(`[Database] Failed to add TV source ${s.name}`, e);
        }
    }
}

/**
 * 数据库迁移：添加缺失的列
 */
function migrateSchema(db) {
    // video_sources 表迁移
    const sourcesMigrations = [
        { column: 'hidden', sql: 'ALTER TABLE video_sources ADD COLUMN hidden INTEGER DEFAULT 0' },
        { column: 'tags', sql: 'ALTER TABLE video_sources ADD COLUMN tags TEXT' },
        { column: 'remark', sql: 'ALTER TABLE video_sources ADD COLUMN remark TEXT' },
        { column: 'response_time', sql: 'ALTER TABLE video_sources ADD COLUMN response_time INTEGER' },
        { column: 'last_test_at', sql: 'ALTER TABLE video_sources ADD COLUMN last_test_at DATETIME' },
        { column: 'proxy_enabled', sql: 'ALTER TABLE video_sources ADD COLUMN proxy_enabled INTEGER DEFAULT 0' },
        { column: 'failure_count', sql: 'ALTER TABLE video_sources ADD COLUMN failure_count INTEGER DEFAULT 0' },
        { column: 'status_message', sql: 'ALTER TABLE video_sources ADD COLUMN status_message TEXT' },
        { column: 'parser_url', sql: 'ALTER TABLE video_sources ADD COLUMN parser_url TEXT' }
    ];

    for (const migration of sourcesMigrations) {
        try {
            const tableInfo = db.all('PRAGMA table_info(video_sources)');
            const columnExists = tableInfo.some(col => col.name === migration.column);

            if (!columnExists) {
                db.run(migration.sql);
                console.log(`[Database] Migration: Added column ${migration.column} to video_sources`);
            }
        } catch (err) {
            console.log(`[Database] Migration skipped for video_sources.${migration.column}: ${err.message}`);
        }
    }

    // categories 表迁移
    const categoriesMigrations = [
        { column: 'has_content', sql: 'ALTER TABLE categories ADD COLUMN has_content INTEGER DEFAULT 1' }
    ];

    for (const migration of categoriesMigrations) {
        try {
            const tableInfo = db.all('PRAGMA table_info(categories)');
            const columnExists = tableInfo.some(col => col.name === migration.column);

            if (!columnExists) {
                db.run(migration.sql);
                console.log(`[Database] Migration: Added column ${migration.column} to categories`);
            }
        } catch (err) {
            console.log(`[Database] Migration skipped for categories.${migration.column}: ${err.message}`);
        }
    }
}

/**
 * 插入默认设置
 */
function insertDefaultSettings(db) {
    const defaultSettings = [
        // 代理配置
        ['proxy_enabled', 'false'],
        ['proxy_type', 'http'],
        ['proxy_host', ''],
        ['proxy_port', ''],
        ['proxy_auth_enabled', 'false'],
        ['proxy_username', ''],
        ['proxy_password', ''],

        // 安全设置
        ['admin_password_enabled', 'false'],
        ['admin_password', ''],

        // TMDB 设置
        ['tmdb_api_key', ''],

        // 其他设置
        ['banner_count', '6'],
        ['banner_sources', '[]'],
        ['default_source_id', ''],
        ['theme', 'dark']
    ];

    const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of defaultSettings) {
        stmt.run([key, value]);
    }
    console.log('[Database] Default settings inserted');
}

/**
 * 插入预置资源站（参考 moontv）
 */
function insertDefaultSources(db) {
    // 检查是否已有资源站
    const existing = db.get('SELECT COUNT(*) as count FROM video_sources');
    if (existing && existing.count > 0) {
        console.log('[Database] Video sources already exist, skipping preset insertion');
        return;
    }

    const presetSources = [
        { name: '黑木耳', url: 'https://json.heimuer.xyz/api.php/provide/vod', type: 'cms_api', sort_order: 1 },
        { name: '暴风资源', url: 'https://bfzyapi.com/api.php/provide/vod', type: 'cms_api', sort_order: 2 },
        { name: '非凡影视', url: 'https://ffzy5.tv/api.php/provide/vod', type: 'cms_api', sort_order: 3 },
        { name: '电影天堂', url: 'http://caiji.dyttzyapi.com/api.php/provide/vod', type: 'cms_api', sort_order: 4 }
    ];

    const stmt = db.prepare(`
        INSERT INTO video_sources (name, url, type, sort_order, enabled)
        VALUES (?, ?, ?, ?, 1)
    `);

    for (const source of presetSources) {
        try {
            stmt.run([source.name, source.url, source.type, source.sort_order]);
            console.log(`[Database] Preset source added: ${source.name}`);
        } catch (err) {
            console.error(`[Database] Failed to add preset source ${source.name}:`, err.message);
        }
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    getDb: getDatabase  // 兼容别名
};
