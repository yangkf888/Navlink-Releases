import { DatabaseWrapper } from '../../utils/db-wrapper.js';
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
        this.db = new DatabaseWrapper(DB_PATH);
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
     * 将数据库中的分类和链接同步回 JSON 配置中
     * 解决 SQL 数据变更后首页不显示的问题
     */
    async refreshCategoriesFromDB() {
        try {
            const config = await this.getConfig();
            if (!config) return false;

            // 1. 获取所有分类
            const categories = this.db.all('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');

            const fullCategories = [];

            for (const cat of categories) {
                const categoryNode = {
                    id: String(cat.id),
                    name: cat.name,
                    icon: cat.icon,
                    hidden: cat.hidden ? true : false,
                    sort_order: cat.sort_order,
                    items: [],
                    subCategories: []
                };

                // 2. 获取该分类下的直属链接 (sub_category_id 为空)
                const items = this.db.all(
                    'SELECT * FROM links WHERE category_id = ? AND (sub_category_id IS NULL OR sub_category_id = "") ORDER BY sort_order ASC, id ASC',
                    [cat.id]
                );
                categoryNode.items = items.map(item => ({
                    id: String(item.id),
                    title: item.title,
                    url: item.url,
                    description: item.description,
                    icon: item.icon,
                    color: item.color,
                    click_count: item.click_count || 0
                }));

                // 3. 获取该分类下的子分类
                const subCats = this.db.all(
                    'SELECT * FROM sub_categories WHERE category_id = ? ORDER BY sort_order ASC, id ASC',
                    [cat.id]
                );

                for (const sub of subCats) {
                    const subNode = {
                        id: String(sub.id),
                        name: sub.name,
                        icon: sub.icon,
                        sort_order: sub.sort_order,
                        items: []
                    };

                    // 4. 获取子分类下的链接
                    const subItems = this.db.all(
                        'SELECT * FROM links WHERE sub_category_id = ? ORDER BY sort_order ASC, id ASC',
                        [sub.id]
                    );
                    subNode.items = subItems.map(item => ({
                        id: String(item.id),
                        title: item.title,
                        url: item.url,
                        description: item.description,
                        icon: item.icon,
                        color: item.color,
                        click_count: item.click_count || 0
                    }));

                    categoryNode.subCategories.push(subNode);
                }

                fullCategories.push(categoryNode);
            }

            // 更新 JSON 配置中的 categories 字段
            config.categories = fullCategories;
            return await this.save(config);
        } catch (error) {
            console.error('[SiteConfigDAO] 同步分类失败:', error);
            return false;
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
