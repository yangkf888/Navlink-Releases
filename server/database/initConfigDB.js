/**
 * NavLink 配置数据库初始化
 * 创建主站配置相关的所有表（同步版本）
 */

import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');

export function initConfigDB() {
    const db = new DatabaseWrapper(DB_PATH);

    console.log('[ConfigDB] Initializing config database tables...');

    // 创建所有配置相关的表
    db.exec(`
        -- 基础配置表
        CREATE TABLE IF NOT EXISTS site_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            logo_url TEXT NOT NULL DEFAULT '',
            header_quote TEXT DEFAULT '',
            background_image TEXT,
            search_shortcut TEXT DEFAULT 'Cmd+K',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            config_data TEXT,  -- 存储完整的JSON配置
            CHECK (id = 1)  -- 确保只有一条记录
        );

        -- 主题配置表
        CREATE TABLE IF NOT EXISTS theme_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            primary_color TEXT DEFAULT '#3b82f6',
            background_color TEXT DEFAULT '#ffffff',
            text_color TEXT DEFAULT '#000000',
            navbar_bg_color TEXT DEFAULT '#ffffff',
            base_font_size INTEGER DEFAULT 16,
            category_title_size INTEGER,
            sub_category_title_size INTEGER,
            promo_category_title_size INTEGER,
            item_link_size INTEGER,
            CHECK (id = 1)
        );

        -- 分类表
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT,
            hidden BOOLEAN DEFAULT 0,
            collapsed BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 子分类表
        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            collapsed BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        -- 链接项表
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subcategory_id INTEGER,  -- 允许为空，支持归属于主分类
            category_id INTEGER,     -- 支持直接归属于主分类 [NEW]
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            icon TEXT,               -- 支持图标 [NEW]
            click_count INTEGER DEFAULT 0, -- 支持点击统计 [NEW]
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        -- 热门推广分类表
        CREATE TABLE IF NOT EXISTS promo_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3b82f6',
            icon TEXT,
            url TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 热门推广项表
        CREATE TABLE IF NOT EXISTS promo_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            promo_category_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            color TEXT,
            icon TEXT,
            is_ad BOOLEAN DEFAULT 0,
            click_count INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (promo_category_id) REFERENCES promo_categories(id) ON DELETE CASCADE
        );

        -- 搜索配置表
        CREATE TABLE IF NOT EXISTS search_engines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT,
            is_default BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 右侧小组件配置表
        CREATE TABLE IF NOT EXISTS right_widgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'clock' | 'weather' | 'calendar' | 'notes' | 'rss' | 'custom'
            title TEXT,
            config TEXT, -- JSON配置
            enabled BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 导航项配置表
        CREATE TABLE IF NOT EXISTS nav_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT,
            parent_id INTEGER,
            target TEXT DEFAULT '_self',
            hidden BOOLEAN DEFAULT 0,
            show_on_mobile BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES nav_items(id) ON DELETE CASCADE
        );

        -- 角色权限表（RBAC）
        CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT PRIMARY KEY,
            permissions TEXT NOT NULL, -- JSON string
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 网站流量统计表 [NEW]
        CREATE TABLE IF NOT EXISTS site_stats (
            stat_date TEXT PRIMARY KEY,  -- 格式: YYYY-MM-DD
            pv_count INTEGER DEFAULT 0,  -- 浏览量
            uv_count INTEGER DEFAULT 0,  -- 独立访客数
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Hero 配置表
        CREATE TABLE IF NOT EXISTS hero_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            title TEXT DEFAULT 'Welcome',
            subtitle TEXT,
            background_color TEXT,
            overlay_navbar BOOLEAN DEFAULT 0,
            CHECK (id = 1)
        );

        -- Hero 热门链接表
        CREATE TABLE IF NOT EXISTS hero_hot_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 页脚配置表
        CREATE TABLE IF NOT EXISTS footer_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            copyright TEXT,
            extra_text TEXT,
            CHECK (id = 1)
        );

        -- 页脚链接表
        CREATE TABLE IF NOT EXISTS footer_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 社交链接表
        CREATE TABLE IF NOT EXISTS social_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icon TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 右侧栏配置表
        CREATE TABLE IF NOT EXISTS right_sidebar_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            profile_logo_text TEXT DEFAULT 'io',
            profile_avatar_url TEXT,
            profile_title TEXT,
            profile_description TEXT,
            profile_custom_bg_color TEXT,
            github_trending_title TEXT DEFAULT 'GitHub Trending',
            github_trending_api_url TEXT,
            github_trending_web_url TEXT,
            CHECK (id = 1)
        );

        -- 热门话题源表
        CREATE TABLE IF NOT EXISTS hot_topic_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            api_url TEXT,
            web_url TEXT,
            limit_count INTEGER DEFAULT 10,
            sort_order INTEGER DEFAULT 0
        );
    `);

    console.log('[ConfigDB] Config database tables initialized successfully');
}
