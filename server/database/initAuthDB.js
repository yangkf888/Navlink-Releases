import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import config from '../config/env.js';

const DB_PATH = path.join(__dirname, '../../data/auth.db');

/**
 * 初始化认证数据库（同步版本）
 */
export function initAuthDB() {
    // 确保 data 目录存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 确保 uploads 子目录存在
    const uploadsDir = path.join(dataDir, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('[AuthDB] Created uploads directory:', uploadsDir);
    }

    const db = new DatabaseWrapper(DB_PATH);

    // 创建租户表
    db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 创建用户表
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, username),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
    `);

    // 检查是否已有默认租户
    const tenant = db.get('SELECT id FROM tenants WHERE id = ?', ['default']);
    if (!tenant) {
        console.log('[AuthDB] Creating default tenant...');
        db.run(
            `INSERT INTO tenants (id, name) VALUES ('default', 'Default Tenant')`,
            []
        );
    }

    // 检查是否已有默认管理员
    const defaultUsername = config.admin.defaultUsername;
    const defaultPassword = config.admin.defaultPassword;

    const user = db.get('SELECT id FROM users WHERE username = ? OR id = ?', [defaultUsername, 'user_1001']);
    if (!user) {
        console.log(`[AuthDB] Creating default admin user... (username: ${defaultUsername})`);
        // bcrypt.hash 是异步的，需要转为同步
        const passwordHash = bcrypt.hashSync(defaultPassword, 10);
        db.run(
            `INSERT OR IGNORE INTO users (id, tenant_id, username, password_hash, email, role) 
             VALUES ('user_1001', 'default', ?, ?, 'admin@navlink.local', 'admin')`,
            [defaultUsername, passwordHash]
        );
        console.log(`[AuthDB] Default admin created (username: ${defaultUsername}, password: ${defaultPassword})`);
    } else {
        console.log(`[AuthDB] Admin user already exists (id: ${user.id}, username: ${user.username}), skipping creation.`);
    }

    console.log('[AuthDB] Initialization complete');
}
