const sqlite3 = require('sqlite3').Database;
const path = require('path');
const fs = require('fs');

// 数据库路径：navlink-next/data/vps.db
// Assuming plugin is running from plugins/vps/backend-nodejs
// ../../../.. goes to navlink root
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'vps.db');

let db = null;

function getDatabase() {
    return db;
}

function promisifyDb(db) {
    return {
        run: (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        }),
        get: (sql, params) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        all: (sql, params) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        exec: (sql) => new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        })
    };
}

function initDatabase() {
    if (db) return db;

    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new sqlite3(DB_PATH, (err) => {
        if (err) {
            console.error('[VPS Database] Failed to connect:', err);
            throw err;
        }
    });

    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    initSchema(db);

    console.log('[VPS Database] SQLite initialized at:', DB_PATH);
    return db;
}

function initSchema(db) {
    const schema = `
    CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        group_id TEXT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT,
        private_key TEXT,
        auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key')),
        status TEXT DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown', 'error')),
        last_check_time DATETIME,
        latency INTEGER DEFAULT 0,
        os_info TEXT,
        cpu_info TEXT,
        mem_info TEXT,
        disk_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        command TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snippet_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `;

    db.exec(schema, (err) => {
        if (err) console.error('[VPS Database] Failed to init schema:', err);
    });
}

module.exports = {
    initDatabase,
    getDatabase,
    promisifyDb
};
