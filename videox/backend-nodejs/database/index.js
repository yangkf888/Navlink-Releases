const DatabaseWrapper = require('./db-wrapper.js');
const path = require('path');
const fs = require('fs');

// 数据库路径：videox/backend-nodejs/data/video.db
const DB_PATH = path.join(__dirname, '..', 'data', 'video.db');

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

    // 初始化表结构（同步执行）
    initSchema(db);

    // 🔧 修复：确保迁移总是在初始化后执行（不依赖回调）
    // 这解决了升级场景下旧数据库缺少新列的问题
    try {
        // 🚀 强力注入：确保 media_servers 表存在
        db.exec(`
            CREATE TABLE IF NOT EXISTS media_servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT NOT NULL,
                api_key TEXT,
                user_id TEXT,
                username TEXT,
                password TEXT,
                enabled INTEGER DEFAULT 1,
                hidden INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        migrateSchema(db);
        insertDefaultSettings(db);
        insertDefaultSources(db);
        insertDefaultTvSources(db);
        console.log('[Database] Video schema and migrations completed');
    } catch (err) {
        console.error('[Database] Migration/defaults error:', err.message);
    }

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
            proxy_enabled INTEGER DEFAULT 0,
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
            source_type TEXT DEFAULT 'cms',
            vod_id TEXT NOT NULL,
            title TEXT,
            cover TEXT,
            year TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, source_id, vod_id, source_type)
        );

        -- 播放记录
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT '0',
            source_id INTEGER,
            source_type TEXT DEFAULT 'cms',
            vod_id TEXT NOT NULL,
            title TEXT,
            cover TEXT,
            episode INTEGER DEFAULT 1,
            episode_name TEXT,
            progress REAL DEFAULT 0,
            duration REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, source_id, vod_id, source_type)
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
            cover_url TEXT,
            avatar_url TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES live_sources(id) ON DELETE CASCADE
        );

        -- 网盘源表
        CREATE TABLE IF NOT EXISTS netdisk_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'alist',
            url TEXT NOT NULL,
            username TEXT,
            password TEXT,
            root_path TEXT DEFAULT '/',
            enabled INTEGER DEFAULT 1,
            proxy_enabled INTEGER DEFAULT 0,
            hidden INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 网盘媒体索引表 (Emby风格媒体库)
        CREATE TABLE IF NOT EXISTS netdisk_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            title TEXT NOT NULL,
            original_title TEXT,
            year INTEGER,
            overview TEXT,
            poster_url TEXT,
            fanart_url TEXT,
            rating REAL,
            genres TEXT,
            media_type TEXT DEFAULT 'movie',
            tmdb_id INTEGER,
            video_files TEXT,
            nfo_parsed INTEGER DEFAULT 0,
            director TEXT,
            actor TEXT,
            area TEXT,
            tagline TEXT,
            studio TEXT,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            v_codec TEXT,
            a_codec TEXT,
            duration REAL DEFAULT 0,
            extra_metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            series TEXT,
            tags TEXT,
            UNIQUE(source_id, path),
            FOREIGN KEY (source_id) REFERENCES netdisk_sources(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_netdisk_media_source ON netdisk_media(source_id);
        CREATE INDEX IF NOT EXISTS idx_netdisk_media_type ON netdisk_media(media_type);

        -- 图片下载失败名单表 (持久化)
        CREATE TABLE IF NOT EXISTS failed_images (
            url TEXT PRIMARY KEY,
            fail_count INTEGER DEFAULT 0,
            last_fail_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 影视库服务器 (Media Servers)
        CREATE TABLE IF NOT EXISTS media_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT DEFAULT 'emby', -- emby, jellyfin
            api_key TEXT,
            user_id TEXT,
            enabled INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            remark TEXT,
            last_sync_at DATETIME,
            hidden INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `, (err) => {
        if (err) {
            console.error('[Database] Failed to initialize schema:', err);
        } else {
            console.log('[Database] Video schema tables created');
            // 注意：migrateSchema, insertDefaultSettings 等已在 initDatabase 中执行
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
        // 已清空预设源 - 用户自行添加
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
        { column: 'parser_url', sql: 'ALTER TABLE video_sources ADD COLUMN parser_url TEXT' },
        // Video 2.0: 用户可配置的扫描并发数
        { column: 'scan_concurrency', sql: 'ALTER TABLE video_sources ADD COLUMN scan_concurrency INTEGER DEFAULT 5' }
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

    // live_status_cache 表迁移
    try {
        const tableInfo = db.all('PRAGMA table_info(live_status_cache)');

        // 检查 cover_url
        const hasCover = tableInfo.some(col => col.name === 'cover_url');
        if (!hasCover) {
            db.run('ALTER TABLE live_status_cache ADD COLUMN cover_url TEXT');
            console.log('[Database] Migration: Added column cover_url to live_status_cache');
        }

        // 检查 avatar_url
        const hasAvatar = tableInfo.some(col => col.name === 'avatar_url');
        if (!hasAvatar) {
            db.run('ALTER TABLE live_status_cache ADD COLUMN avatar_url TEXT');
            console.log('[Database] Migration: Added column avatar_url to live_status_cache');
        }
    } catch (err) {
        console.log(`[Database] Migration error for live_status_cache: ${err.message}`);
    }

    // favorites 表迁移 (添加 source_type 并移除外键)
    try {
        const tableInfo = db.all('PRAGMA table_info(favorites)');
        const hasSourceType = tableInfo.some(col => col.name === 'source_type');

        if (!hasSourceType) {
            console.log('[Database] Migrating favorites table...');
            db.exec(`
                ALTER TABLE favorites RENAME TO favorites_old;
                CREATE TABLE favorites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT DEFAULT '0',
                    source_id INTEGER,
                    source_type TEXT DEFAULT 'cms',
                    vod_id TEXT NOT NULL,
                    title TEXT,
                    cover TEXT,
                    year TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, source_id, vod_id, source_type)
                );
                INSERT INTO favorites (id, user_id, source_id, vod_id, title, cover, year, created_at)
                SELECT id, user_id, source_id, vod_id, title, cover, year, created_at FROM favorites_old;
                DROP TABLE favorites_old;
            `);
            console.log('[Database] Favorites table migration completed');
        }
    } catch (err) {
        console.error('[Database] Favorites migration error:', err.message);
    }

    // play_history 表迁移 (添加 source_type 并移除外键)
    try {
        const tableInfo = db.all('PRAGMA table_info(play_history)');
        const hasSourceType = tableInfo.some(col => col.name === 'source_type');

        if (!hasSourceType) {
            console.log('[Database] Migrating play_history table...');
            db.exec(`
                ALTER TABLE play_history RENAME TO play_history_old;
                CREATE TABLE play_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT DEFAULT '0',
                    source_id INTEGER,
                    source_type TEXT DEFAULT 'cms',
                    vod_id TEXT NOT NULL,
                    title TEXT,
                    cover TEXT,
                    episode INTEGER DEFAULT 1,
                    episode_name TEXT,
                    progress REAL DEFAULT 0,
                    duration REAL DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, source_id, vod_id, source_type)
                );
                INSERT INTO play_history (id, user_id, source_id, vod_id, title, cover, episode, episode_name, progress, duration, updated_at)
                SELECT id, user_id, source_id, vod_id, title, cover, episode, episode_name, progress, duration, updated_at FROM play_history_old;
                DROP TABLE play_history_old;
            `);
            console.log('[Database] Play history table migration completed');
        }
    } catch (err) {
        console.error('[Database] Play history migration error:', err.message);
    }

    // netdisk_sources 表迁移
    try {
        const tableInfo = db.all('PRAGMA table_info(netdisk_sources)');
        const columnsToAdd = [
            { name: 'scan_paths', type: 'TEXT' },
            { name: 'type', type: 'TEXT DEFAULT \'alist\'' },
            { name: 'proxy_enabled', type: 'INTEGER DEFAULT 0' },
            { name: 'hidden', type: 'INTEGER DEFAULT 0' },
            { name: 'remark', type: 'TEXT' }
        ];

        for (const col of columnsToAdd) {
            if (!tableInfo.some(c => c.name === col.name)) {
                db.run(`ALTER TABLE netdisk_sources ADD COLUMN ${col.name} ${col.type}`);
                console.log(`[Database] Migration: Added column ${col.name} to netdisk_sources`);
            }
        }
    } catch (err) {
        console.log(`[Database] Migration error for netdisk_sources: ${err.message}`);
    }

    // netdisk_media 表迁移 (增加元数据支持)
    try {
        const mediaTableInfo = db.all('PRAGMA table_info(netdisk_media)');
        const mediaColumnsToAdd = [
            { name: 'director', type: 'TEXT' },
            { name: 'actor', type: 'TEXT' },
            { name: 'area', type: 'TEXT' },
            { name: 'tagline', type: 'TEXT' },
            { name: 'studio', type: 'TEXT' },
            { name: 'v_codec', type: 'TEXT' },
            { name: 'a_codec', type: 'TEXT' },
            { name: 'duration', type: 'REAL DEFAULT 0' },
            { name: 'extra_metadata', type: 'TEXT' },
            // Video 2.0 新增字段
            { name: 'probe_status', type: 'INTEGER DEFAULT 0' },  // 0:未探测, 1:成功, -1:失败
            { name: 'is_locked', type: 'INTEGER DEFAULT 0' },     // 元数据锁定
            { name: 'container', type: 'TEXT' },                   // 封装格式 (mp4/mkv/avi)
            { name: 'created_at', type: 'DATETIME' },
            { name: 'series', type: 'TEXT' },
            { name: 'tags', type: 'TEXT' }
        ];

        for (const col of mediaColumnsToAdd) {
            if (!mediaTableInfo.some(c => c.name === col.name)) {
                db.run(`ALTER TABLE netdisk_media ADD COLUMN ${col.name} ${col.type}`);
                console.log(`[Database] Migration: Added column ${col.name} to netdisk_media`);
            }
        }
    } catch (err) {
        console.log(`[Database] Migration error for netdisk_media: ${err.message}`);
    }

    // media_servers 表初始化 (迁移场景)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS media_servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                type TEXT DEFAULT 'emby',
                api_key TEXT,
                user_id TEXT,
                enabled INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                remark TEXT,
                last_sync_at DATETIME,
                hidden INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 检查并添加各列
        const serverTableInfo = db.all('PRAGMA table_info(media_servers)');
        const serverColsToAdd = [
            { name: 'hidden', type: 'INTEGER DEFAULT 0' },
            { name: 'sort_order', type: 'INTEGER DEFAULT 0' },
            { name: 'remark', type: 'TEXT' },
            { name: 'last_sync_at', type: 'DATETIME' },
            { name: 'type', type: 'TEXT DEFAULT \'emby\'' },
            { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
        ];

        for (const col of serverColsToAdd) {
            if (!serverTableInfo.some(c => c.name === col.name)) {
                db.run(`ALTER TABLE media_servers ADD COLUMN ${col.name} ${col.type}`);
                console.log(`[Database] Migration: Added column ${col.name} to media_servers`);
            }
        }
    } catch (err) {
        console.log(`[Database] Migration error for media_servers: ${err.message}`);
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
        ['site_password_enabled', 'false'],
        ['site_password', ''],

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
        // 已清空预设源 - 用户自行添加
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
