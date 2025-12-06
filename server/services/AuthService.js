import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/auth.db');
const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

/**
 * 认证服务类
 */
export class AuthService {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
    }

    /**
     * 用户登录
     */
    async login(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT u.*, t.name as tenant_name 
                 FROM users u 
                 JOIN tenants t ON u.tenant_id = t.id
                 WHERE u.username = ? AND u.status = 'active'`,
                [username],
                async (err, user) => {
                    if (err) {
                        console.error('[AuthService] Database error:', err);
                        return reject({ code: 500, message: 'Database error' });
                    }

                    if (!user) {
                        console.log('[AuthService] Login failed: User not found:', username);
                        return reject({ code: 401, message: 'Invalid username or password' });
                    }

                    // 验证密码
                    try {
                        const isValid = await bcrypt.compare(password, user.password_hash);
                        if (!isValid) {
                            console.log('[AuthService] Login failed: Invalid password for user:', username);
                            return reject({ code: 401, message: 'Invalid username or password' });
                        }
                    } catch (err) {
                        console.error('[AuthService] Password comparison error:', err);
                        return reject({ code: 500, message: 'Authentication error' });
                    }

                    // 生成 JWT Token
                    const token = jwt.sign(
                        {
                            id: user.id,
                            username: user.username,
                            tenantId: user.tenant_id,
                            role: user.role
                        },
                        JWT_SECRET,
                        { expiresIn: JWT_EXPIRES_IN }
                    );

                    // 更新最后登录时间
                    this.db.run(
                        `UPDATE users SET last_login = datetime('now') WHERE id = ?`,
                        [user.id]
                    );

                    console.log('[AuthService] Login successful:', {
                        username: user.username,
                        role: user.role,
                        tenantId: user.tenant_id
                    });

                    // 返回结果
                    resolve({
                        token,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            role: user.role,
                            tenantId: user.tenant_id,
                            tenantName: user.tenant_name
                        }
                    });
                }
            );
        });
    }

    /**
     * 验证 Token
     */
    async verifyToken(token) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    console.log('[AuthService] Token verification failed:', err.message);
                    return reject({ code: 403, message: 'Invalid or expired token' });
                }

                // 检查用户是否仍然有效
                this.db.get(
                    `SELECT id, username, tenant_id, role 
                     FROM users 
                     WHERE id = ? AND status = 'active'`,
                    [decoded.id],
                    (err, user) => {
                        if (err || !user) {
                            console.log('[AuthService] User not found or inactive:', decoded.id);
                            return reject({ code: 403, message: 'User not found or inactive' });
                        }

                        resolve({
                            id: user.id,
                            username: user.username,
                            tenantId: user.tenant_id,
                            role: user.role
                        });
                    }
                );
            });
        });
    }

    /**
     * 修改密码
     */
    async changePassword(userId, oldPassword, newPassword) {
        return new Promise(async (resolve, reject) => {
            // 获取用户
            this.db.get(
                `SELECT * FROM users WHERE id = ?`,
                [userId],
                async (err, user) => {
                    if (err || !user) {
                        return reject({ code: 404, message: 'User not found' });
                    }

                    // 验证旧密码
                    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
                    if (!isValid) {
                        return reject({ code: 401, message: 'Current password is incorrect' });
                    }

                    // 哈希新密码
                    const newHash = await bcrypt.hash(newPassword, 10);

                    // 更新密码
                    this.db.run(
                        `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
                        [newHash, userId],
                        (err) => {
                            if (err) {
                                return reject({ code: 500, message: 'Failed to update password' });
                            }
                            console.log('[AuthService] Password changed for user:', userId);
                            resolve({ success: true });
                        }
                    );
                }
            );
        });
    }

    /**
     * 创建新用户 (仅管理员)
     */
    async createUser(adminUser, userData) {
        if (adminUser.role !== 'admin') {
            throw { code: 403, message: 'Only admins can create users' };
        }

        return new Promise(async (resolve, reject) => {
            const { username, password, email, role, tenantId } = userData;

            // 生成 ID
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 哈希密码
            const passwordHash = await bcrypt.hash(password, 10);

            this.db.run(
                `INSERT INTO users (id, tenant_id, username, password_hash, email, role)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, tenantId || adminUser.tenantId, username, passwordHash, email, role || 'user'],
                (err) => {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return reject({ code: 409, message: 'Username already exists' });
                        }
                        return reject({ code: 500, message: 'Failed to create user' });
                    }

                    console.log('[AuthService] User created:', { userId, username, role: role || 'user' });

                    resolve({
                        id: userId,
                        username,
                        email,
                        role: role || 'user',
                        tenantId: tenantId || adminUser.tenantId
                    });
                }
            );
        });
    }

    /**
     * 获取所有用户 (仅管理员)
     */
    async getUsers(adminUser) {
        if (adminUser.role !== 'admin') {
            throw { code: 403, message: 'Only admins can view users' };
        }

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT u.id, u.username, u.email, u.role, u.status, u.last_login, u.created_at, t.name as tenant_name
                 FROM users u
                 JOIN tenants t ON u.tenant_id = t.id
                 ORDER BY u.created_at DESC`,
                [],
                (err, users) => {
                    if (err) {
                        return reject({ code: 500, message: 'Failed to fetch users' });
                    }
                    resolve(users);
                }
            );
        });
    }

    /**
     * 更新用户状态 (仅管理员)
     */
    async updateUserStatus(adminUser, userId, status) {
        if (adminUser.role !== 'admin') {
            throw { code: 403, message: 'Only admins can update user status' };
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`,
                [status, userId],
                (err) => {
                    if (err) {
                        return reject({ code: 500, message: 'Failed to update user status' });
                    }
                    console.log('[AuthService] User status updated:', { userId, status });
                    resolve({ success: true });
                }
            );
        });
    }

    /**
     * 删除用户 (仅管理员)
     */
    async deleteUser(adminUser, userId) {
        if (adminUser.role !== 'admin') {
            throw { code: 403, message: 'Only admins can delete users' };
        }

        // 防止删除自己
        if (adminUser.id === userId) {
            throw { code: 400, message: 'Cannot delete yourself' };
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM users WHERE id = ?`,
                [userId],
                (err) => {
                    if (err) {
                        return reject({ code: 500, message: 'Failed to delete user' });
                    }
                    console.log('[AuthService] User deleted:', userId);
                    resolve({ success: true });
                }
            );
        });
    }
}
