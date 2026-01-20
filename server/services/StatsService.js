import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/navlink.db');

class StatsService {
    constructor() {
        this.db = new DatabaseWrapper(DB_PATH);
        this.todayUvSet = new Set();
        this.lastUvResetDate = null;

        // 自动初始化统计表和字段
        this.init();
    }

    /**
     * 初始化表结构和必要字段
     */
    init() {
        try {
            // 1. 创建 site_stats 表
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS site_stats (
                    stat_date TEXT PRIMARY KEY,
                    pv_count INTEGER DEFAULT 0,
                    uv_count INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 2. 为 items 表增加 click_count
            try {
                this.db.exec('ALTER TABLE items ADD COLUMN click_count INTEGER DEFAULT 0');
            } catch (e) {
                // 字段可能已存在
            }

            try {
                this.db.exec('ALTER TABLE promo_items ADD COLUMN click_count INTEGER DEFAULT 0');
            } catch (e) {
                // 字段可能已存在
            }

            // 4. [NEW] 为老用户执行自动迁移: links -> items
            try {
                const hasLinksTable = this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='links'");
                if (hasLinksTable) {
                    console.log('[StatsService] Legacy links table detected, attempting migration...');

                    // 尝试将 links 表中的点击量同步到 items 表 (按 URL 匹配)
                    this.db.run(`
                        UPDATE items SET click_count = (
                            SELECT click_count FROM links WHERE links.url = items.url
                        ) WHERE EXISTS (
                            SELECT 1 FROM links WHERE links.url = items.url AND links.click_count > 0
                        )
                    `);

                    // 迁移完成后，可选：重命名或保留 links 表以防万一
                    // 这里选择保留，但不做进一步处理，让系统平稳过渡到 items
                    console.log('[StatsService] Successfully migrated click_count from links to items');
                }
            } catch (e) {
                console.warn('[StatsService] Migration skipped or failed:', e.message);
            }

            console.log('[StatsService] Database initialized successfully');
        } catch (err) {
            console.error('[StatsService] Failed to initialize database:', err);
        }
    }

    /**
     * 记录一次页面访问 (PV/UV)
     * @param {string} ip 访客 IP
     */
    async trackVisit(ip) {
        const today = new Date().toISOString().split('T')[0];

        // 异步执行，不阻塞主流程
        (async () => {
            try {
                // 跨天重置 UV 内存缓存
                if (this.lastUvResetDate !== today) {
                    this.todayUvSet.clear();
                    this.lastUvResetDate = today;
                }

                const isNewUv = !this.todayUvSet.has(ip);
                if (isNewUv) {
                    this.todayUvSet.add(ip);
                }

                // 更新数据库
                const row = this.db.get('SELECT * FROM site_stats WHERE stat_date = ?', [today]);
                if (!row) {
                    this.db.run(
                        'INSERT INTO site_stats (stat_date, pv_count, uv_count) VALUES (?, 1, 1)',
                        [today]
                    );
                } else {
                    this.db.run(
                        `UPDATE site_stats 
                         SET pv_count = pv_count + 1, 
                             uv_count = uv_count + ?, 
                             updated_at = CURRENT_TIMESTAMP 
                         WHERE stat_date = ?`,
                        [isNewUv ? 1 : 0, today]
                    );
                }
            } catch (err) {
                console.warn('[StatsService] Error tracking visit:', err.message);
            }
        })();
    }

    /**
     * 记录链接点击
     * @param {string} itemId 链接 ID
     * @param {boolean} isPromo 是否为推荐项
     */
    async trackClick(itemId, isPromo = false) {
        (async () => {
            try {
                const table = isPromo ? 'promo_items' : 'items';
                this.db.run(`UPDATE ${table} SET click_count = click_count + 1 WHERE id = ?`, [itemId]);
                // console.log(`[StatsService] Click tracked for ${table}/${itemId}`);
            } catch (err) {
                console.warn('[StatsService] Error tracking click:', err.message);
            }
        })();
    }

    /**
     * 获取仪表盘统计数据
     */
    getDashboardStats() {
        try {
            const today = new Date().toISOString().split('T')[0];

            const total = this.db.get('SELECT SUM(pv_count) as total_pv, SUM(uv_count) as total_uv FROM site_stats') || { total_pv: 0, total_uv: 0 };
            const current = this.db.get('SELECT pv_count as today_pv, uv_count as today_uv FROM site_stats WHERE stat_date = ?', [today]) || { today_pv: 0, today_uv: 0 };

            // 获取点击最多的 Top 5 链接
            const topLinks = this.db.all(`
                SELECT id, title, click_count, 'link' as type FROM items WHERE click_count > 0
                UNION ALL
                SELECT id, title, click_count, 'promo' as type FROM promo_items WHERE click_count > 0
                ORDER BY click_count DESC LIMIT 5
            `);

            return {
                totalViews: total.total_pv || 0,
                totalUsers: total.total_uv || 0,
                todayViews: current.today_pv || 0,
                todayUsers: current.today_uv || 0,
                topLinks: topLinks || []
            };
        } catch (err) {
            console.error('[StatsService] Error getting dashboard stats:', err);
            return { totalViews: 0, totalUsers: 0, todayViews: 0, todayUsers: 0, topLinks: [] };
        }
    }

    /**
     * 获取趋势数据 (最近 14 天)
     */
    getTrendingData(days = 14) {
        try {
            return this.db.all(`
                SELECT stat_date, pv_count 
                FROM site_stats 
                ORDER BY stat_date DESC 
                LIMIT ?
            `, [days]);
        } catch (err) {
            return [];
        }
    }
}

export default new StatsService();
