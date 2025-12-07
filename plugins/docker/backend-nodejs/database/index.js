import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径：navlink-next/data/docker.db
// __dirname = navlink-next/plugins/docker/backend-nodejs/database
// 需要向上4级到navlink-next
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'docker.db');

let db = null;

/**
 * 初始化数据库连接
 */
export function initDatabase() {
    if (db) return db;

    // 确保data目录存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 创建数据库连接
    const SqliteDB = sqlite3.Database;
    db = new SqliteDB(DB_PATH, (err) => {
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
    // Docker服务器表
    db.exec(`
        CREATE TABLE IF NOT EXISTS docker_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            
            -- 连接配置
            connection_type TEXT NOT NULL DEFAULT 'local' CHECK(connection_type IN ('local', 'tcp', 'tls', 'ssh')),
            host TEXT,
            port INTEGER DEFAULT 2375,
            
            -- TLS证书（预留，Base64编码存储）
            ca_cert TEXT,
            client_cert TEXT,
            client_key TEXT,
            
            -- SSH配置
            ssh_user TEXT,
            ssh_password TEXT,
            ssh_private_key TEXT,
            ssh_port INTEGER DEFAULT 22,
            
            -- 状态信息
            status TEXT DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown', 'error')),
            last_check_time DATETIME,
            last_error TEXT,
            latency INTEGER DEFAULT 0,
            
            -- 元数据
            is_default INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_docker_servers_status ON docker_servers(status);
        CREATE INDEX IF NOT EXISTS idx_docker_servers_default ON docker_servers(is_default);

        -- Docker审计日志表
        CREATE TABLE IF NOT EXISTS docker_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            resource_name TEXT,
            status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed')),
            error_message TEXT,
            user_info TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(server_id) REFERENCES docker_servers(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_docker_audit_server ON docker_audit_logs(server_id);
        CREATE INDEX IF NOT EXISTS idx_docker_audit_action ON docker_audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_docker_audit_created ON docker_audit_logs(created_at);

        -- 触发器
        CREATE TRIGGER IF NOT EXISTS update_docker_servers_timestamp 
        AFTER UPDATE ON docker_servers
        BEGIN
            UPDATE docker_servers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `, (err) => {
        if (err) {
            console.error('[Database] Failed to initialize schema:', err);
        }
    });
}

/**
 * 获取数据库实例
 */
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('[Database] Error closing connection:', err);
                    reject(err);
                } else {
                    db = null;
                    console.log('[Database] Connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

// 优雅退出
process.on('exit', () => {
    if (db) {
        db.close();
    }
});

process.on('SIGINT', async () => {
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabase();
    process.exit(0);
});