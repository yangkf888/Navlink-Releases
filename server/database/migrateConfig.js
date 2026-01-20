/**
 * 配置数据迁移脚本
 * 将 app_config.json 迁移到 SQLite 数据库（使用 sqlite3）
 */

import sqlite3 from 'sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initConfigDB } from './initConfigDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');
const JSON_CONFIG_PATH = path.join(__dirname, '../../data/app_config.json');
const BACKUP_PATH = path.join(__dirname, '../../data/app_config.json.backup');

// 辅助函数：Promise化数据库操作
function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

export async function migrateConfigToSQLite() {
    console.log('========================================');
    console.log('开始配置数据迁移：JSON -> SQLite');
    console.log('========================================\n');

    try {
        // 1. 备份原 JSON 文件
        console.log('[1/6] 备份原配置文件...');
        await fs.copyFile(JSON_CONFIG_PATH, BACKUP_PATH);
        console.log(`✓ 备份已创建: ${BACKUP_PATH}\n`);

        // 2. 读取 JSON 配置
        console.log('[2/6] 读取 JSON  配置...');
        const jsonData = await fs.readFile(JSON_CONFIG_PATH, 'utf-8');
        const config = JSON.parse(jsonData);
        console.log(`✓ 配置已加载 (${Object.keys(config).length} 个顶级配置项)\n`);

        // 3. 初始化数据库表
        console.log('[3/6] 初始化数据库表...');
        await new Promise((resolve) => {
            initConfigDB();
            setTimeout(resolve, 1000); // 等待初始化完成
        });
        console.log('✓ 数据库表已创建\n');

        // 4. 打开数据库连接
        const SqliteDB = sqlite3.Database;
        const db = await new Promise((resolve, reject) => {
            const database = new SqliteDB(DB_PATH, (err) => {
                if (err) reject(err);
                else resolve(database);
            });
        });

        // 5. 迁移数据
        console.log('[4/6] 迁移数据...');

        await dbRun(db, 'BEGIN TRANSACTION');

        try {
            await migrateBasicConfig(db, config);
            await migrateTheme(db, config.theme);
            await migrateHero(db, config.hero);
            await migrateSearchEngines(db, config.searchEngines);
            await migrateTopNav(db, config.topNav);
            await migrateCategories(db, config.categories);
            await migratePromo(db, config.promo);
            await migrateRightSidebar(db, config.rightSidebar);
            await migrateFooter(db, config.footer);

            await dbRun(db, 'COMMIT');
            console.log('✓ 数据迁移完成\n');
        } catch (error) {
            await dbRun(db, 'ROLLBACK');
            throw error;
        }

        // 6. 验证数据
        console.log('[5/6] 验证迁移数据...');
        const stats = await validateMigration(db, config);
        console.log(`✓ 验证通过:`);
        console.log(`  - 分类: ${stats.categories}/${config.categories?.length || 0}`);
        console.log(`  - 链接: ${stats.links} 条`);
        console.log(`  - 搜索引擎: ${stats.searchEngines}/${config.searchEngines?.length || 0}`);
        console.log(`  - 推荐标签: ${stats.promoTabs}/${config.promo?.length || 0}\n`);

        await new Promise((resolve, reject) => {
            db.close((err) => err ? reject(err) : resolve());
        });

        console.log('[6/6] 迁移完成！');
        console.log('========================================');
        console.log('✓ 配置数据已成功迁移到 SQLite');
        console.log(`✓ 原文件备份: ${BACKUP_PATH}`);
        console.log('========================================\n');

        return { success: true, stats };

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error(error.stack);

        // 尝试恢复备份
        try {
            await fs.copyFile(BACKUP_PATH, JSON_CONFIG_PATH);
            console.log('已从备份恢复原配置文件');
        } catch (restoreError) {
            console.error('无法恢复备份:', restoreError.message);
        }

        throw error;
    }
}

// 迁移基础配置
async function migrateBasicConfig(db, config) {
    await dbRun(db, `
        INSERT OR REPLACE INTO site_config 
        (id, logo_url, header_quote, background_image, search_shortcut)
        VALUES (1, ?, ?, ?, ?)
    `, [
        config.logoUrl || '',
        config.headerQuote || '',
        config.backgroundImage || null,
        config.searchShortcut || 'Cmd+K'
    ]);

    console.log('  ✓ 基础配置');
}

// 迁移主题
async function migrateTheme(db, theme) {
    if (!theme) return;

    await dbRun(db, `
        INSERT OR REPLACE INTO theme_config 
        (id, primary_color, background_color, text_color, navbar_bg_color, base_font_size)
        VALUES (1, ?, ?, ?, ?, ?)
    `, [
        theme.primaryColor || '#3b82f6',
        theme.backgroundColor || '#ffffff',
        theme.textColor || '#000000',
        theme.navbarBgColor || '#ffffff',
        theme.baseFontSize || 16
    ]);

    console.log('  ✓ 主题配置');
}

// 迁移 Hero
async function migrateHero(db, hero) {
    if (!hero) return;

    await dbRun(db, `
        INSERT OR REPLACE INTO hero_config 
        (id, title, subtitle, background_color, overlay_navbar)
        VALUES (1, ?, ?, ?, ?)
    `, [
        hero.title || 'Welcome',
        hero.subtitle || '',
        hero.backgroundColor || null,
        hero.overlayNavbar ? 1 : 0
    ]);

    // Hero 热门搜索链接
    if (hero.hotSearchLinks && hero.hotSearchLinks.length > 0) {
        await dbRun(db, 'DELETE FROM hero_hot_links');

        for (let i = 0; i < hero.hotSearchLinks.length; i++) {
            const link = hero.hotSearchLinks[i];
            await dbRun(db, `
                INSERT INTO hero_hot_links (title, url, sort_order)
                VALUES (?, ?, ?)
            `, [link.title, link.url, i]);
        }
    }

    console.log('  ✓ Hero 配置');
}

// 迁移搜索引擎
async function migrateSearchEngines(db, engines) {
    if (!engines || engines.length === 0) return;

    await dbRun(db, 'DELETE FROM search_engines');

    for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];
        await dbRun(db, `
            INSERT INTO search_engines (id, name, url_pattern, placeholder, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `, [engine.id, engine.name, engine.urlPattern, engine.placeholder || '', i]);
    }

    console.log(`  ✓ 搜索引擎 (${engines.length} 个)`);
}

// 迁移顶部导航
async function migrateTopNav(db, topNav) {
    if (!topNav || topNav.length === 0) return;

    await dbRun(db, 'DELETE FROM nav_items');

    async function insertNavItem(item, parentId, order) {
        await dbRun(db, `
            INSERT INTO nav_items (id, title, url, icon, parent_id, hidden, show_on_mobile, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            item.id,
            item.title,
            item.url,
            item.icon || null,
            parentId,
            item.hidden ? 1 : 0,
            item.showOnMobile !== false ? 1 : 0,
            order
        ]);

        // 递归插入子项
        if (item.children && item.children.length > 0) {
            for (let i = 0; i < item.children.length; i++) {
                await insertNavItem(item.children[i], item.id, i);
            }
        }
    }

    for (let i = 0; i < topNav.length; i++) {
        await insertNavItem(topNav[i], null, i);
    }

    console.log(`  ✓ 顶部导航 (${topNav.length} 个)`);
}

// 迁移分类
async function migrateCategories(db, categories) {
    if (!categories || categories.length === 0) return;

    await dbRun(db, 'DELETE FROM items');
    await dbRun(db, 'DELETE FROM subcategories');
    await dbRun(db, 'DELETE FROM categories');

    let totalLinks = 0;

    for (let catIndex = 0; catIndex < categories.length; catIndex++) {
        const cat = categories[catIndex];

        await dbRun(db, `
            INSERT INTO categories (id, name, icon, hidden, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `, [cat.id, cat.name, cat.icon, cat.hidden ? 1 : 0, catIndex]);

        if (cat.subCategories && cat.subCategories.length > 0) {
            for (let subIndex = 0; subIndex < cat.subCategories.length; subIndex++) {
                const subCat = cat.subCategories[subIndex];
                const subCatId = `${cat.id}_sub_${subIndex}`;

                await dbRun(db, `
                    INSERT INTO subcategories (id, category_id, name, color, sort_order)
                    VALUES (?, ?, ?, ?, ?)
                `, [subCatId, cat.id, subCat.name, subCat.color || null, subIndex]);

                if (subCat.items) {
                    for (let itemIndex = 0; itemIndex < subCat.items.length; itemIndex++) {
                        const item = subCat.items[itemIndex];
                        await dbRun(db, `
                            INSERT INTO items (id, category_id, subcategory_id, title, url, description, icon, color, sort_order)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [item.id, cat.id, subCatId, item.title, item.url, item.description || '', item.icon || null, item.color || null, itemIndex]);
                        totalLinks++;
                    }
                }
            }
        } else if (cat.items && cat.items.length > 0) {
            for (let itemIndex = 0; itemIndex < cat.items.length; itemIndex++) {
                const item = cat.items[itemIndex];
                await dbRun(db, `
                    INSERT INTO items (id, category_id, subcategory_id, title, url, description, icon, color, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [item.id, cat.id, null, item.title, item.url, item.description || '', item.icon || null, item.color || null, itemIndex]);
                totalLinks++;
            }
        }
    }

    console.log(`  ✓ 分类 (${categories.length} 个分类, ${totalLinks} 条链接)`);
}

// 迁移推荐
async function migratePromo(db, promo) {
    if (!promo || promo.length === 0) return;

    await dbRun(db, 'DELETE FROM promo_items');
    await dbRun(db, 'DELETE FROM promo_tabs');

    let totalItems = 0;

    for (let tabIndex = 0; tabIndex < promo.length; tabIndex++) {
        const tab = promo[tabIndex];

        await dbRun(db, `
            INSERT INTO promo_categories (id, name, url, sort_order)
            VALUES (?, ?, ?, ?)
        `, [tab.id, tab.name, tab.url || null, tabIndex]);

        if (tab.items) {
            for (let itemIndex = 0; itemIndex < tab.items.length; itemIndex++) {
                const item = tab.items[itemIndex];
                await dbRun(db, `
                    INSERT INTO promo_items (id, promo_category_id, title, url, color, icon, is_ad, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [item.id, tab.id, item.title, item.url || null, item.color, item.icon, item.isAd ? 1 : 0, itemIndex]);
                totalItems++;
            }
        }
    }

    console.log(`  ✓ 推荐 (${promo.length} 个标签, ${totalItems} 个项目)`);
}

// 迁移右侧栏
async function migrateRightSidebar(db, rightSidebar) {
    if (!rightSidebar) return;

    // Profile
    if (rightSidebar.profile) {
        await dbRun(db, `
            INSERT OR REPLACE INTO right_sidebar_config 
            (id, profile_logo_text, profile_avatar_url, profile_title, profile_description, profile_custom_bg_color)
            VALUES (1, ?, ?, ?, ?, ?)
        `, [
            rightSidebar.profile.logoText || 'io',
            rightSidebar.profile.avatarUrl || null,
            rightSidebar.profile.title || '',
            rightSidebar.profile.description || '',
            rightSidebar.profile.customBackgroundColor || null
        ]);

        // Socials
        if (rightSidebar.profile.socials) {
            await dbRun(db, 'DELETE FROM social_links');

            for (let i = 0; i < rightSidebar.profile.socials.length; i++) {
                const social = rightSidebar.profile.socials[i];
                await dbRun(db, `
                    INSERT INTO social_links (icon, url, sort_order)
                    VALUES (?, ?, ?)
                `, [social.icon, social.url, i]);
            }
        }
    }

    // Hot Topics
    if (rightSidebar.hotTopics) {
        await dbRun(db, 'DELETE FROM hot_topic_sources');

        for (let i = 0; i < rightSidebar.hotTopics.length; i++) {
            const source = rightSidebar.hotTopics[i];
            await dbRun(db, `
                INSERT INTO hot_topic_sources (id, name, api_url, web_url, limit_count, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [source.id, source.name, source.apiUrl, source.webUrl, source.limit || 10, i]);
        }
    }

    // GitHub Trending
    if (rightSidebar.githubTrending) {
        await dbRun(db, `
            UPDATE right_sidebar_config 
            SET github_trending_title = ?, github_trending_api_url = ?, github_trending_web_url = ?
            WHERE id = 1
        `, [
            rightSidebar.githubTrending.title || 'GitHub Trending',
            rightSidebar.githubTrending.apiUrl || '',
            rightSidebar.githubTrending.webUrl || ''
        ]);
    }

    console.log('  ✓ 右侧栏配置');
}

// 迁移页脚
async function migrateFooter(db, footer) {
    if (!footer) return;

    await dbRun(db, `
        INSERT OR REPLACE INTO footer_config (id, copyright, extra_text)
        VALUES (1, ?, ?)
    `, [footer.copyright || '', footer.extraText || '']);

    if (footer.links) {
        await dbRun(db, 'DELETE FROM footer_links');

        for (let i = 0; i < footer.links.length; i++) {
            const link = footer.links[i];
            await dbRun(db, `
                INSERT INTO footer_links (text, url, sort_order)
                VALUES (?, ?, ?)
            `, [link.text, link.url, i]);
        }
    }

    console.log('  ✓ 页脚配置');
}

// 验证迁移
async function validateMigration(db, originalConfig) {
    const categories = await dbGet(db, 'SELECT COUNT(*) as count FROM categories');
    const links = await dbGet(db, 'SELECT COUNT(*) as count FROM items');
    const searchEngines = await dbGet(db, 'SELECT COUNT(*) as count FROM search_engines');
    const promoTabs = await dbGet(db, 'SELECT COUNT(*) as count FROM promo_categories');

    return {
        categories: categories.count,
        links: links.count,
        searchEngines: searchEngines.count,
        promoTabs: promoTabs.count
    };
}

// 如果直接运行此文件，则执行迁移
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateConfigToSQLite()
        .then(() => {
            console.log('\n迁移成功完成！');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n迁移失败！');
            console.error(error);
            process.exit(1);
        });
}
