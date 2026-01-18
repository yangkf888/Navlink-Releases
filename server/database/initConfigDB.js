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
            collapsed BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 子分类表
        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            collapsed BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        -- 链接项表
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subcategory_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
        );

        -- 热门推广分类表
        CREATE TABLE IF NOT EXISTS promo_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3b82f6',
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 热门推广项表
        CREATE TABLE IF NOT EXISTS promo_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            promo_category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
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
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT,
            target TEXT DEFAULT '_self',
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    `);

    console.log('[ConfigDB] Config database tables initialized successfully');
}
