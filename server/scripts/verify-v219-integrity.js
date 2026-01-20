#!/usr/bin/env node
/**
 * v2.1.9 系统完整性验证脚本
 * 验证：1. 数据库物理表结构 2. SyncService 写入流 3. ConfigService 读取流
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { DatabaseWrapper } from '../utils/db-wrapper.js';
import SyncService from '../services/SyncService.js';
import ConfigService from '../services/ConfigService.js';
import SiteConfigDAO from '../database/dao/SiteConfigDAO.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'navlink.db');

async function runTest() {
    console.log('========================================');
    console.log('🚀 v2.1.9 系统完整性深度扫描开始');
    console.log('========================================\n');

    const db = new DatabaseWrapper(DB_PATH);
    let passCount = 0;
    let failCount = 0;

    const report = (name, status, message = '') => {
        if (status) {
            console.log(`[PASS] ${name}`);
            passCount++;
        } else {
            console.error(`[FAIL] ${name} ❌`);
            if (message) console.error(`       原因: ${message}`);
            failCount++;
        }
    };

    try {
        // --- 1. 物理表结构验证 ---
        console.log('--- [1] 验证物理表结构 ---');
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.name));
            });
        });

        const expectedTables = ['items', 'subcategories', 'nav_items', 'promo_categories', 'promo_items'];
        for (const table of expectedTables) {
            report(`表名检测: ${table}`, tables.includes(table));
        }

        const legacyTables = ['links', 'sub_categories', 'top_nav_items', 'promo_tabs'];
        for (const table of legacyTables) {
            if (tables.includes(table)) {
                console.warn(`[WARN] 检测到陈旧表: ${table} (虽然不影响新版逻辑，但在清理后应该消失)`);
            }
        }

        // --- 2. 核心字段验证 ---
        console.log('\n--- [2] 验证核心字段 ---');
        const checkColumn = async (table, column) => {
            const info = await new Promise((resolve) => {
                db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
                    resolve(rows || []);
                });
            });
            return info.some(c => c.name === column);
        };

        report('items 表包含 click_count', await checkColumn('items', 'click_count'));
        report('nav_items 表包含 title', await checkColumn('nav_items', 'title'));
        report('promo_items 表包含 promo_category_id', await checkColumn('promo_items', 'promo_category_id'));

        // --- 3. SyncService 逻辑链验证 ---
        console.log('\n--- [3] 验证 SyncService (写入流) ---');
        // 模拟一个配置
        const mockConfig = {
            categories: [{
                id: 9999,
                name: "测试分类",
                items: [{ id: 99991, title: "测试链接", url: "http://test.com" }]
            }],
            promo: []
        };

        try {
            await SyncService.syncConfigToSQL(mockConfig);
            // 验证是否写入
            const row = await new Promise((resolve) => {
                db.get("SELECT * FROM items WHERE id = ?", [99991], (err, row) => resolve(row));
            });
            report('SyncService 同步到 items 表', row && row.id === 99991 && row.title === "测试链接");
        } catch (e) {
            report('SyncService 运行', false, e.message);
        }

        // --- 4. ConfigService 逻辑链验证 ---
        console.log('\n--- [4] 验证 ConfigService (加载流) ---');
        try {
            // 篡改数据库环境以强制 ConfigService 降级到多表读取
            await new Promise((resolve) => db.run("UPDATE site_config SET config_data = NULL WHERE id = 1", [], () => resolve()));

            const fullConfig = await ConfigService.getFullConfig();
            const hasTestItem = fullConfig.categories.some(c => c.name === "测试分类");
            report('ConfigService 从多表加载数据', hasTestItem);

            // 验证字段一致性 (ConfigService 应该把 items.title 赋值给前端需要的 title)
            const testCat = fullConfig.categories.find(c => c.name === "测试分类");
            const testItem = testCat?.items?.[0];
            report('ConfigService 字段转换 (items -> title)', testItem && testItem.title === "测试链接");
        } catch (e) {
            report('ConfigService 运行', false, e.message);
        }

        // --- 5. 清理测试数据 ---
        await new Promise((resolve) => db.run("DELETE FROM items WHERE id = 99991", [], () => resolve()));
        await new Promise((resolve) => db.run("DELETE FROM categories WHERE id = 9999", [], () => resolve()));

    } catch (error) {
        console.error('\n严重错误:', error);
    } finally {
        console.log('\n========================================');
        console.log(`🏁 验证结束: [${passCount}] 通过 / [${failCount}] 失败`);
        console.log('========================================');

        if (failCount === 0) {
            console.log('\n✅ 恭喜！系统完整性验证 100% 通过。v2.1.9 准备就绪！');
        } else {
            console.error('\n❌ 警告！发现潜在不一致性，请根据上述详细信息进行修复。');
        }

        process.exit(failCount === 0 ? 0 : 1);
    }
}

runTest();
