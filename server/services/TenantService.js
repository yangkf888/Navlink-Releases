/**
 * 租户管理服务
 * 用于管理多租户系统中的租户
 */

import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/auth.db');

export class TenantService {
    constructor() {
        this.db = new DatabaseWrapper(DB_PATH);
    }

    /**
     * 创建新租户
     */
    async createTenant(name, metadata = {}) {
        return new Promise((resolve, reject) => {
            const id = `tenant_${uuidv4()}`; // Changed from randomUUID() to uuidv4()
            const now = new Date().toISOString();

            this.db.run(
                `INSERT INTO tenants (id, name, status, created_at, updated_at) 
                 VALUES (?, ?, 'active', ?, ?)`,
                [id, name, now, now],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return reject({ code: 400, message: '租户名称已存在' });
                        }
                        return reject({ code: 500, message: err.message });
                    }
                    resolve({ id, name, status: 'active', created_at: now });
                }
            );
        });
    }

    /**
     * 获取所有租户
     */
    async getAllTenants() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, name, status, created_at, updated_at FROM tenants ORDER BY created_at DESC`,
                (err, rows) => {
                    if (err) return reject({ code: 500, message: err.message });
                    resolve(rows);
                }
            );
        });
    }

    /**
     * 获取租户信息
     */
    async getTenant(tenantId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT id, name, status, created_at, updated_at FROM tenants WHERE id = ?`,
                [tenantId],
                (err, row) => {
                    if (err) return reject({ code: 500, message: err.message });
                    if (!row) return reject({ code: 404, message: '租户不存在' });
                    resolve(row);
                }
            );
        });
    }

    /**
     * 更新租户状态
     */
    async updateTenantStatus(tenantId, status) {
        return new Promise((resolve, reject) => {
            if (!['active', 'suspended', 'deleted'].includes(status)) {
                return reject({ code: 400, message: '无效的状态' });
            }

            this.db.run(
                `UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?`,
                [status, new Date().toISOString(), tenantId],
                function (err) {
                    if (err) return reject({ code: 500, message: err.message });
                    if (this.changes === 0) return reject({ code: 404, message: '租户不存在' });
                    resolve();
                }
            );
        });
    }

    /**
     * 获取租户的用户数量
     */
    async getTenantUserCount(tenantId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM users WHERE tenant_id = ?`,
                [tenantId],
                (err, row) => {
                    if (err) return reject({ code: 500, message: err.message });
                    resolve(row.count);
                }
            );
        });
    }

    /**
     * 获取租户统计信息
     */
    async getTenantStats(tenantId) {
        const userCount = await this.getTenantUserCount(tenantId);
        const tenant = await this.getTenant(tenantId);

        return {
            ...tenant,
            userCount
        };
    }

    /**
     * 删除租户(软删除)
     */
    async deleteTenant(tenantId) {
        // 不允许删除default租户
        if (tenantId === 'default') {
            throw { code: 400, message: '不能删除默认租户' };
        }

        // 检查租户下是否还有用户
        const userCount = await this.getTenantUserCount(tenantId);
        if (userCount > 0) {
            throw { code: 400, message: `租户下还有 ${userCount} 个用户,无法删除` };
        }

        return this.updateTenantStatus(tenantId, 'deleted');
    }
}
