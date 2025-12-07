#!/usr/bin/env node
/**
 * 数据迁移脚本: 将关系型表数据迁移到JSON配置
 * 从categories/links表迁移到site_config.config_data
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');

class DataMigration {
    constructor() {
        const SqliteDB = sqlite3.Database;
        this.db = new SqliteDB(DB_PATH);
    }

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

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async migrateCategories() {
        console.log('\n🔄 开始迁移categories数据...');

        // 1. 获取当前配置
        const configRow = await this.get('SELECT config_data FROM site_config WHERE id = 1');
        if (!configRow || !configRow.config_data) {
            console.error('❌ 未找到配置数据');
            return;
        }

        const config = JSON.parse(configRow.config_data);
        console.log(`📊 当前配置中categories数量: ${config.categories?.length || 0}`);

        // 2. 从关系型表读取分类数据
        const categories = await this.all(`
            SELECT id, name, icon, hidden, sort_order 
            FROM categories 
            ORDER BY sort_order
        `);

        console.log(`📦 从categories表读取到 ${categories.length} 个分类`);

        // 3. 为每个分类读取subcategories和items
        const fullCategories = [];
        for (const cat of categories) {
            // 读取子分类
            const subcategories = await this.all(`
                SELECT id, name, color, sort_order
                FROM sub_categories
                WHERE category_id = ?
                ORDER BY sort_order
            `, [cat.id]);

            // 读取该分类的链接
            const items = await this.all(`
                SELECT id, title, url, description, icon, color, sort_order, sub_category_id
                FROM links
                WHERE category_id = ?
                ORDER BY sort_order
            `, [cat.id]);

            // 构建完整的分类对象
            const fullCategory = {
                id: cat.id,
                name: cat.name,
                icon: cat.icon,
                hidden: Boolean(cat.hidden),
                subcategories: subcategories.map(sub => ({
                    id: sub.id,
                    name: sub.name,
                    color: sub.color || '#000000'
                })),
                items: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    url: item.url,
                    description: item.description || '',
                    icon: item.icon || 'fa-solid fa-link',
                    color: item.color || '#000000',
                    subcategoryId: item.sub_category_id || undefined
                }))
            };

            fullCategories.push(fullCategory);
            console.log(`  ✓ ${cat.name}: ${subcategories.length} 个子分类, ${items.length} 个链接`);
        }

        // 4. 更新配置
        config.categories = fullCategories;

        // 5. 保存回数据库
        const configJson = JSON.stringify(config);
        await this.run(
            'UPDATE site_config SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            [configJson]
        );

        console.log(`\n✅ 迁移完成! 已将 ${fullCategories.length} 个分类写入config_data`);
        console.log(`📈 配置JSON大小: ${(configJson.length / 1024).toFixed(2)} KB`);
    }

    async migratePromo() {
        console.log('\n🔄 检查promo数据...');

        const configRow = await this.get('SELECT config_data FROM site_config WHERE id = 1');
        const config = JSON.parse(configRow.config_data);

        const promoTabs = await this.all(`
            SELECT id, name, url, sort_order
            FROM promo_tabs
            ORDER BY sort_order
        `);

        if (promoTabs.length === 0) {
            console.log('  ℹ️  promo_tabs表为空,跳过');
            return;
        }

        const fullPromo = [];
        for (const tab of promoTabs) {
            const items = await this.all(`
                SELECT id, title, url, color, icon, is_ad, sort_order
                FROM promo_items
                WHERE tab_id = ?
                ORDER BY sort_order
            `, [tab.id]);

            fullPromo.push({
                id: tab.id,
                name: tab.name,
                url: tab.url || '',
                items: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    url: item.url || '',
                    color: item.color || '#000000',
                    icon: item.icon || 'fa-solid fa-link',
                    isAd: Boolean(item.is_ad)
                }))
            });

            console.log(`  ✓ ${tab.name}: ${items.length} 个推荐项`);
        }

        config.promo = fullPromo;

        const configJson = JSON.stringify(config);
        await this.run(
            'UPDATE site_config SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            [configJson]
        );

        console.log(`✅ promo数据迁移完成! ${fullPromo.length} 个标签页`);
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close(() => resolve());
        });
    }
}

// 执行迁移
async function main() {
    console.log('========================================');
    console.log('  NavLink 数据迁移工具');
    console.log('  关系型表 → JSON配置');
    console.log('========================================');

    const migration = new DataMigration();

    try {
        await migration.migrateCategories();
        await migration.migratePromo();
        console.log('\n🎉 所有数据迁移完成!\n');
    } catch (error) {
        console.error('\n❌ 迁移失败:', error);
        process.exit(1);
    } finally {
        await migration.close();
    }
}

main();
