import siteConfigDAO from '../database/dao/SiteConfigDAO.js';

/**
 * 数据同步服务
 * 负责在 JSON 配置（site_config.config_data）与 SQL 关系表（items, categories 等）之间保持数据同步
 */
export class SyncService {
    constructor() {
        this.db = siteConfigDAO.db;
    }

    /**
     * 将全量 JSON 配置同步到 SQL 表
     * @param {Object} config 完整的站点配置 JSON
     */
    async syncConfigToSQL(config) {
        if (!config || !config.categories) return;

        console.log('[SyncService] Starting full synchronization from JSON to SQL...');

        try {
            // 使用事务确保一致性
            this.db.transaction(() => {
                // 1. 同步全部分类
                this._syncCategories(config.categories);

                // 2. 同步推广项 (Promo)
                if (config.promo) {
                    this._syncPromo(config.promo);
                }
            })();

            console.log('[SyncService] Full synchronization completed successfully.');
        } catch (error) {
            console.error('[SyncService] Synchronization failed:', error);
            throw error;
        }
    }

    /**
     * 解析 ID，强制转为整数。
     * 如果是纯数字字符串，转为整数。
     * 如果是非数字字符串（如 'recommend'），通过简单哈希算法转为唯一整数。
     * @private
     */
    _parseId(id) {
        if (typeof id === 'number') return Math.floor(id);
        if (typeof id === 'string') {
            if (/^\d+$/.test(id)) {
                return parseInt(id, 10);
            }
            // 简单的 Java 风格字符串哈希，将其转为 31 位正整数（SQLite INTEGER 兼容）
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = ((hash << 5) - hash) + id.charCodeAt(i);
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
        }
        return null;
    }

    _syncCategories(categories) {
        console.log(`[SyncService] _syncCategories called with ${categories.length} categories`);
        for (const cat of categories) {
            const catId = this._parseId(cat.id);
            if (catId === null) {
                console.warn(`[SyncService] Skipping category with invalid ID: ${cat.id}`);
                continue;
            }

            // 插入或更新分类
            console.log(`[SyncService] Syncing category: ${catId}, name: ${cat.name}, items: ${cat.items?.length || 0}, sub: ${cat.subCategories?.length || 0}`);
            this.db.run(
                'INSERT INTO categories (id, name, icon, hidden, sort_order) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, icon=excluded.icon, hidden=excluded.hidden, sort_order=excluded.sort_order',
                [catId, cat.name, cat.icon || '', cat.hidden ? 1 : 0, cat.sort_order || 0]
            );

            // 处理分类下的直接链接
            if (Array.isArray(cat.items)) {
                for (const item of cat.items) {
                    this._upsertItem(item, catId, null);
                }
            }

            // 处理子分类
            if (Array.isArray(cat.subCategories)) {
                for (const sub of cat.subCategories) {
                    // 如果没有 ID，则使用名称作为 ID 基准
                    let subId = this._parseId(sub.id);
                    if (subId === null && sub.name) {
                        subId = this._parseId(`sub-${catId}-${sub.name}`);
                    }

                    if (subId === null) {
                        console.warn(`[SyncService] Skipping subcategory with invalid ID: ${sub.id}, name: ${sub.name}`);
                        continue;
                    }

                    console.log(`[SyncService] Syncing subcategory: ${subId}, name: ${sub.name}, items: ${sub.items?.length || 0}`);
                    this.db.run(
                        'INSERT INTO subcategories (id, category_id, name, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name, sort_order=excluded.sort_order',
                        [subId, catId, sub.name, sub.sort_order || 0]
                    );

                    if (Array.isArray(sub.items)) {
                        for (const item of sub.items) {
                            this._upsertItem(item, catId, subId);
                        }
                    }
                }
            }
        }
    }

    /**
     * 插入或更新单个链接，保留点击量
     * @private
     */
    _upsertItem(item, categoryId, subcategoryId) {
        const itemId = this._parseId(item.id);
        if (itemId === null) {
            console.warn(`[SyncService] Skipping item with invalid ID: ${item.id}`);
            return;
        }

        this.db.run(
            `INSERT INTO items (id, category_id, subcategory_id, name, url, description, icon, click_count) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT(id) DO UPDATE SET 
                category_id=excluded.category_id,
                subcategory_id=excluded.subcategory_id,
                name=excluded.name,
                url=excluded.url,
                description=excluded.description,
                icon=excluded.icon`,
            [itemId, categoryId, subcategoryId, item.title, item.url, item.description || '', item.icon || '']
        );
    }

    /**
     * 同步推广项
     * @private
     */
    _syncPromo(promo) {
        for (const tab of promo) {
            const tabId = this._parseId(tab.id);
            if (tabId === null) continue;

            this.db.run(
                'INSERT INTO promo_categories (id, name, icon) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, icon=excluded.icon',
                [tabId, tab.name, tab.icon || '']
            );

            if (Array.isArray(tab.items)) {
                for (const item of tab.items) {
                    const itemId = this._parseId(item.id);
                    if (itemId === null) continue;

                    this.db.run(
                        `INSERT INTO promo_items (id, promo_category_id, name, url, description, click_count)
                         VALUES (?, ?, ?, ?, ?, 0)
                         ON CONFLICT(id) DO UPDATE SET
                            promo_category_id=excluded.promo_category_id,
                            name=excluded.name,
                            url=excluded.url,
                            description=excluded.description`,
                        [itemId, tabId, item.title, item.url || '', item.description || '']
                    );
                }
            }
        }
    }
}

export default new SyncService();
