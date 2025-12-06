/**
 * NavLink 配置数据库初始化
 * 创建主站配置相关的所有表
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');

export function initConfigDB() {
    const SqliteDB = sqlite3.Database;
    const db = new SqliteDB(DB_PATH, (err) => {
        if (err) {
            console.error('[ConfigDB] Failed to open database:', err);
            throw err;
        }

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
            promo_sub_category_title_size INTEGER,
            CHECK (id = 1)
        );

        -- Hero 配置表
        CREATE TABLE IF NOT EXISTS hero_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            title TEXT NOT NULL DEFAULT 'Welcome',
            subtitle TEXT DEFAULT '',
            background_color TEXT,
            overlay_navbar BOOLEAN DEFAULT 0,
            CHECK (id = 1)
        );

        -- Hero 热门搜索链接
        CREATE TABLE IF NOT EXISTS hero_hot_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 搜索引擎配置
        CREATE TABLE IF NOT EXISTS search_engines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url_pattern TEXT NOT NULL,
            placeholder TEXT,
            sort_order INTEGER DEFAULT 0
        );

        -- 分类表
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            hidden BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 子分类表
        CREATE TABLE IF NOT EXISTS sub_categories (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        -- 链接表
        CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL,
            sub_category_id TEXT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT DEFAULT '',
            icon TEXT,
            color TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id) ON DELETE SET NULL
        );

        -- 推荐标签页
        CREATE TABLE IF NOT EXISTS promo_tabs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT,
            sort_order INTEGER DEFAULT 0
        );

        -- 推荐项
        CREATE TABLE IF NOT EXISTS promo_items (
            id TEXT PRIMARY KEY,
            tab_id TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            is_ad BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (tab_id) REFERENCES promo_tabs(id) ON DELETE CASCADE
        );

        -- 顶部导航
        CREATE TABLE IF NOT EXISTS top_nav_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT,
            parent_id TEXT,
            hidden BOOLEAN DEFAULT 0,
            show_on_mobile BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (parent_id) REFERENCES top_nav_items(id) ON DELETE CASCADE
        );

        -- 右侧栏配置
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

        -- 社交链接
        CREATE TABLE IF NOT EXISTS social_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icon TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 热门话题源
        CREATE TABLE IF NOT EXISTS hot_topic_sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            api_url TEXT NOT NULL,
            web_url TEXT NOT NULL,
            limit_count INTEGER DEFAULT 10,
            sort_order INTEGER DEFAULT 0
        );

        -- 页脚配置
        CREATE TABLE IF NOT EXISTS footer_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            copyright TEXT DEFAULT '',
            extra_text TEXT DEFAULT '',
            CHECK (id = 1)
        );

        -- 页脚链接
        CREATE TABLE IF NOT EXISTS footer_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- 创建索引以提升查询性能
        CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
        CREATE INDEX IF NOT EXISTS idx_links_sub_category ON links(sub_category_id);
        CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories(category_id);
        CREATE INDEX IF NOT EXISTS idx_promo_items_tab ON promo_items(tab_id);
        CREATE INDEX IF NOT EXISTS idx_top_nav_parent ON top_nav_items(parent_id);
    `, (err) => {
            if (err) {
                console.error('[ConfigDB] Failed to initialize tables:', err);
                throw err;
            }

            console.log('[ConfigDB] Config database tables initialized successfully');
            db.close();
        });
    });
}

// 如果直接运行此文件，则初始化数据库
if (import.meta.url === `file://${process.argv[1]}`) {
    initConfigDB();
}
