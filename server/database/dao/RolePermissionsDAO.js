import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用环境变量或默认路径（与其他DAO保持一致）
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'navlink.db');

/**
 * RolePermissionsDAO - 管理角色权限的数据访问对象
 */
export class RolePermissionsDAO {
    constructor() {
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
    }

    /**
     * 获取指定角色的权限列表
     * @param {string} role - 角色名称
     * @returns {string[]} 权限列表
     */
    getRolePermissions(role) {
        try {
            const stmt = this.db.prepare('SELECT permissions FROM role_permissions WHERE role = ?');
            const result = stmt.get(role);

            if (!result) {
                return [];
            }

            return JSON.parse(result.permissions);
        } catch (error) {
            console.error(`Failed to get permissions for role ${role}:`, error);
            return [];
        }
    }

    /**
     * 获取所有角色及其权限
     * @returns {{[role: string]: string[]}} 角色权限映射
     */
    getAllRolePermissions() {
        try {
            const stmt = this.db.prepare('SELECT role, permissions FROM role_permissions');
            const results = stmt.all();

            const rolePermissions = {};
            for (const row of results) {
                rolePermissions[row.role] = JSON.parse(row.permissions);
            }

            return rolePermissions;
        } catch (error) {
            console.error('Failed to get all role permissions:', error);
            return {};
        }
    }

    /**
     * 更新指定角色的权限
     * @param {string} role - 角色名称
     * @param {string[]} permissions - 权限列表
     * @returns {boolean} 是否成功
     */
    updateRolePermissions(role, permissions) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO role_permissions (role, permissions, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `);

            const permissionsJson = JSON.stringify(permissions);
            stmt.run(role, permissionsJson);

            console.log(`[RolePermissionsDAO] Updated permissions for role: ${role}`);
            return true;
        } catch (error) {
            console.error(`Failed to update permissions for role ${role}:`, error);
            return false;
        }
    }

    /**
     * 获取所有角色名称
     * @returns {string[]} 角色列表
     */
    getAllRoles() {
        try {
            const stmt = this.db.prepare('SELECT role FROM role_permissions');
            const results = stmt.all();
            return results.map(row => row.role);
        } catch (error) {
            console.error('Failed to get all roles:', error);
            return [];
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        this.db.close();
    }
}

export default RolePermissionsDAO;
