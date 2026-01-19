/**
 * ConfigService
 * 
 * 配置管理服务 (兼容层)
 */

import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');

export class ConfigService {
    constructor() {
        this.db = new DatabaseWrapper(DB_PATH);
    }

    /**
     * 获取完整配置（兼容原 JSON 格式）
     * 优先从 config_data JSON 字段读取（与保存逻辑一致）
     */
    async getFullConfig() {
        // 🔑 优先从 config_data JSON 字段读取（SiteConfigDAO 保存的位置）
        const row = await this.queryOne('SELECT config_data FROM site_config WHERE id = 1');
        if (row && row.config_data) {
            try {
                const jsonConfig = JSON.parse(row.config_data);

                // 防御性检查：确保关键数组字段存在
                if (!Array.isArray(jsonConfig.categories)) {
                    console.warn('[ConfigService] ⚠️ config.categories 不是数组，设置为空数组');
                    jsonConfig.categories = [];
                }
                if (!Array.isArray(jsonConfig.promo)) {
                    console.warn('[ConfigService] ⚠️ config.promo 不是数组，设置为空数组');
                    jsonConfig.promo = [];
                }
                if (!Array.isArray(jsonConfig.topNav)) {
                    console.warn('[ConfigService] ⚠️ config.topNav 不是数组，设置为空数组');
                    jsonConfig.topNav = [];
                }
                if (!Array.isArray(jsonConfig.searchEngines)) {
                    jsonConfig.searchEngines = [];
                }

                // 防御性检查：确保关键对象字段存在
                if (!jsonConfig.footer || typeof jsonConfig.footer !== 'object') {
                    console.warn('[ConfigService] ⚠️ config.footer 不存在，设置默认值');
                    jsonConfig.footer = { copyright: '', links: [], extraText: '' };
                }
                if (!jsonConfig.hero || typeof jsonConfig.hero !== 'object') {
                    jsonConfig.hero = { title: '', subtitle: '', backgroundColor: '#5d33f0', hotSearchLinks: [] };
                }
                if (!jsonConfig.theme || typeof jsonConfig.theme !== 'object') {
                    jsonConfig.theme = { primaryColor: '#f1404b', backgroundColor: '#f1f2f3', textColor: '#444444' };
                }
                if (!jsonConfig.rightSidebar || typeof jsonConfig.rightSidebar !== 'object') {
                    jsonConfig.rightSidebar = { profile: {}, hotTopics: [], githubTrending: {} };
                }

                console.log('[ConfigService] ✅ 从 config_data JSON 字段读取配置');
                return jsonConfig;
            } catch (error) {
                console.warn('[ConfigService] ⚠️ config_data JSON 解析失败，降级到多表读取:', error);
            }
        }

        // 降级方案：从多表结构读取（向后兼容旧数据）
        console.log('[ConfigService] ℹ️ 从多表结构读取配置（降级方案）');
        const config = {
            logoUrl: '',
            headerQuote: '',
            backgroundImage: null,
            searchShortcut: 'Cmd+K',
            theme: await this.getTheme(),
            hero: await this.getHero(),
            searchEngines: await this.getSearchEngines(),
            topNav: await this.getTopNav(),
            promo: await this.getPromo(),
            categories: await this.getCategories(),
            rightSidebar: await this.getRightSidebar(),
            footer: await this.getFooter()
        };

        // 获取基础配置
        const basicConfig = await this.queryOne('SELECT * FROM site_config WHERE id = 1');
        if (basicConfig) {
            config.logoUrl = basicConfig.logo_url || '';
            config.headerQuote = basicConfig.header_quote || '';
            config.backgroundImage = basicConfig.background_image;
            config.searchShortcut = basicConfig.search_shortcut || 'Cmd+K';
        }

        return config;
    }

    /**
     * 获取主题配置
     */
    async getTheme() {
        const theme = await this.queryOne('SELECT * FROM theme_config WHERE id = 1');
        if (!theme) return null;

        return {
            primaryColor: theme.primary_color,
            backgroundColor: theme.background_color,
            textColor: theme.text_color,
            navbarBgColor: theme.navbar_bg_color,
            baseFontSize: theme.base_font_size,
            categoryTitleSize: theme.category_title_size,
            subCategoryTitleSize: theme.sub_category_title_size,
            promoCategoryTitleSize: theme.promo_category_title_size,
            promoSubCategoryTitleSize: theme.promo_sub_category_title_size
        };
    }

    /**
     * 获取 Hero 配置
     */
    async getHero() {
        const hero = await this.queryOne('SELECT * FROM hero_config WHERE id = 1');
        const hotLinks = await this.queryAll('SELECT * FROM hero_hot_links ORDER BY sort_order');

        return {
            title: hero?.title || 'Welcome',
            subtitle: hero?.subtitle || '',
            backgroundColor: hero?.background_color,
            overlayNavbar: hero?.overlay_navbar === 1,
            hotSearchLinks: hotLinks.map(link => ({
                title: link.title,
                url: link.url
            }))
        };
    }

    /**
     * 获取搜索引擎列表
     */
    async getSearchEngines() {
        const engines = await this.queryAll('SELECT * FROM search_engines ORDER BY sort_order');
        return engines.map(engine => ({
            id: engine.id,
            name: engine.name,
            urlPattern: engine.url_pattern,
            placeholder: engine.placeholder
        }));
    }

    /**
     * 获取顶部导航
     */
    async getTopNav() {
        const allItems = await this.queryAll('SELECT * FROM top_nav_items ORDER BY sort_order');

        // 构建树形结构
        const buildTree = (parentId) => {
            return allItems
                .filter(item => item.parent_id === parentId)
                .map(item => ({
                    id: item.id,
                    title: item.title,
                    url: item.url,
                    icon: item.icon,
                    hidden: item.hidden === 1,
                    showOnMobile: item.show_on_mobile === 1,
                    children: buildTree(item.id)
                }));
        };

        return buildTree(null);
    }

    /**
     * 获取分类列表
     */
    async getCategories() {
        const categories = await this.queryAll('SELECT * FROM categories ORDER BY sort_order');

        const result = [];
        for (const cat of categories) {
            const subCategories = await this.queryAll(
                'SELECT * FROM sub_categories WHERE category_id = ? ORDER BY sort_order',
                [cat.id]
            );

            const item = {
                id: cat.id,
                name: cat.name,
                icon: cat.icon,
                hidden: cat.hidden === 1
            };

            if (subCategories.length > 0) {
                item.subCategories = [];
                for (const subCat of subCategories) {
                    const links = await this.queryAll(
                        'SELECT * FROM links WHERE category_id = ? AND sub_category_id = ? ORDER BY sort_order',
                        [cat.id, subCat.id]
                    );
                    item.subCategories.push({
                        name: subCat.name,
                        color: subCat.color,
                        items: links.map(this.formatLink)
                    });
                }
            } else {
                const links = await this.queryAll(
                    'SELECT * FROM links WHERE category_id = ? AND sub_category_id IS NULL ORDER BY sort_order',
                    [cat.id]
                );
                item.items = links.map(this.formatLink);
            }

            result.push(item);
        }

        return result;
    }

    /**
     * 获取推荐配置
     */
    async getPromo() {
        const tabs = await this.queryAll('SELECT * FROM promo_tabs ORDER BY sort_order');

        const result = [];
        for (const tab of tabs) {
            const items = await this.queryAll(
                'SELECT * FROM promo_items WHERE tab_id = ? ORDER BY sort_order',
                [tab.id]
            );
            result.push({
                id: tab.id,
                name: tab.name,
                url: tab.url,
                items: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    url: item.url,
                    color: item.color,
                    icon: item.icon,
                    isAd: item.is_ad === 1
                }))
            });
        }

        return result;
    }

    /**
     * 获取右侧栏配置
     */
    async getRightSidebar() {
        const config = await this.queryOne('SELECT * FROM right_sidebar_config WHERE id = 1');
        const socials = await this.queryAll('SELECT * FROM social_links ORDER BY sort_order');
        const hotTopics = await this.queryAll('SELECT * FROM hot_topic_sources ORDER BY sort_order');

        return {
            profile: {
                logoText: config?.profile_logo_text || 'io',
                avatarUrl: config?.profile_avatar_url,
                title: config?.profile_title || '',
                description: config?.profile_description || '',
                customBackgroundColor: config?.profile_custom_bg_color,
                socials: socials.map(s => ({ icon: s.icon, url: s.url }))
            },
            hotTopics: hotTopics.map(ht => ({
                id: ht.id,
                name: ht.name,
                apiUrl: ht.api_url,
                webUrl: ht.web_url,
                limit: ht.limit_count
            })),
            githubTrending: {
                title: config?.github_trending_title || 'GitHub Trending',
                apiUrl: config?.github_trending_api_url || '',
                webUrl: config?.github_trending_web_url || ''
            }
        };
    }

    /**
     * 获取页脚配置
     */
    async getFooter() {
        const config = await this.queryOne('SELECT * FROM footer_config WHERE id = 1');
        const links = await this.queryAll('SELECT * FROM footer_links ORDER BY sort_order');

        return {
            copyright: config?.copyright || '',
            extraText: config?.extra_text || '',
            links: links.map(link => ({
                text: link.text,
                url: link.url
            }))
        };
    }

    /**
     * 更新完整配置
     */
    async updateConfig(config) {
        // 使用串行事务处理
        try {
            await this.run('BEGIN TRANSACTION');

            if (config.logoUrl !== undefined) {
                await this.updateBasicConfig(config);
            }
            if (config.theme) {
                await this.updateTheme(config.theme);
            }

            await this.run('COMMIT');
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * 更新基础配置
     */
    async updateBasicConfig(config) {
        await this.run(
            `UPDATE site_config 
             SET logo_url = ?, header_quote = ?, background_image = ?, 
                 search_shortcut = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = 1`,
            [config.logoUrl, config.headerQuote, config.backgroundImage, config.searchShortcut]
        );
    }

    /**
     * 更新主题
     */
    async updateTheme(theme) {
        await this.run(
            `UPDATE theme_config 
             SET primary_color = ?, background_color = ?, text_color = ?,
                 navbar_bg_color = ?, base_font_size = ?,
                 category_title_size = ?, sub_category_title_size = ?,
                 promo_category_title_size = ?, promo_sub_category_title_size = ?
             WHERE id = 1`,
            [
                theme.primaryColor, theme.backgroundColor, theme.textColor,
                theme.navbarBgColor, theme.baseFontSize,
                theme.categoryTitleSize || null, theme.subCategoryTitleSize || null,
                theme.promoCategoryTitleSize || null, theme.promoSubCategoryTitleSize || null
            ]
        );
    }

    /**
     * 格式化链接对象
     */
    formatLink(link) {
        return {
            id: link.id,
            title: link.title,
            url: link.url,
            description: link.description,
            icon: link.icon,
            color: link.color
        };
    }

    /**
     * 辅助方法：执行查询并返回单行
     */
    queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * 辅助方法：执行查询并返回所有行
     */
    queryAll(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * 辅助方法：执行 SQL（INSERT/UPDATE/DELETE）
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
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

export default new ConfigService();
