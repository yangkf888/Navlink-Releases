import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用环境变量或默认路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'navlink.db');

/**
 * 站点配置 DAO
 * 使用单表 JSON 存储方案（与 Navlink1202 一致）
 */
export class SiteConfigDAO {
    constructor() {
        const SqliteDB = sqlite3.Database;
        this.db = new SqliteDB(DB_PATH, (err) => {
            if (err) {
                console.error('[SiteConfigDAO] Failed to open database:', err);
            }
        });
    }

    /**
     * 辅助方法：promisify database operations
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * 获取站点配置
     * @returns {Object|null} 配置对象，如果不存在返回 null
     */
    async getConfig() {
        try {
            const row = await this.get('SELECT config_data FROM site_config WHERE id = 1');
            if (!row || !row.config_data) {
                return null;
            }
            return JSON.parse(row.config_data);
        } catch (error) {
            console.error('[SiteConfigDAO] 获取配置失败:', error);
            return null;
        }
    }

    /**
     * 保存站点配置（插入或更新）
     * @param {Object} config 配置对象
     * @returns {boolean} 是否成功
     */
    async save(config) {
        try {
            const configJson = JSON.stringify(config);

            // 先检查是否存在记录
            const existing = await this.get('SELECT id FROM site_config WHERE id = 1');

            if (existing) {
                // 更新现有记录
                await this.run(
                    'UPDATE site_config SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                    [configJson]
                );
            } else {
                // 插入新记录
                await this.run(
                    'INSERT INTO site_config (id, config_data) VALUES (1, ?)',
                    [configJson]
                );
            }

            console.log('[SiteConfigDAO] 配置保存成功');
            return true;
        } catch (error) {
            console.error('[SiteConfigDAO] 保存配置失败:', error);
            return false;
        }
    }

    /**
     * 更新配置（别名，方便调用）
     * @param {Object} config 配置对象
     * @returns {boolean} 是否成功
     */
    async update(config) {
        return await this.save(config);
    }

    /**
     * 导出配置为 JSON 字符串
     * @returns {string|null} JSON 字符串
     */
    async export() {
        try {
            const config = await this.getConfig();
            if (!config) {
                return null;
            }
            return JSON.stringify(config, null, 2);
        } catch (error) {
            console.error('[SiteConfigDAO] 导出配置失败:', error);
            return null;
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

export default new SiteConfigDAO();
