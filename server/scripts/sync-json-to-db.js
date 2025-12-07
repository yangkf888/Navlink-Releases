#!/usr/bin/env node
/**
 * 将 app_config.json 同步到数据库
 * 用于将JSON文件配置导入到site_config.config_data字段
 */

import sqlite3 from 'sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/navlink.db');
const JSON_PATH = path.join(__dirname, '../../data/app_config.json');

async function syncConfig() {
    console.log('========================================');
    console.log('  同步 app_config.json → 数据库');
    console.log('========================================\n');

    // 1. 读取JSON文件
    console.log('📖 读取 app_config.json...');
    const jsonContent = await fs.readFile(JSON_PATH, 'utf-8');
    const config = JSON.parse(jsonContent);
    console.log(`✓ 配置大小: ${(jsonContent.length / 1024).toFixed(2)} KB`);
    console.log(`✓ categories: ${config.categories?.length || 0} 个`);
    console.log(`✓ promo: ${config.promo?.length || 0} 个标签页`);

    // 2. 连接数据库
    console.log('\n🔗 连接数据库...');
    const db = new sqlite3.Database(DB_PATH);

    // 3. 检查现有配置
    const checkExisting = () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT id, length(config_data) as len FROM site_config WHERE id = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const existing = await checkExisting();
    if (existing) {
        console.log(`✓ 数据库中现有配置大小: ${(existing.len / 1024).toFixed(2)} KB`);
    } else {
        console.log('⚠️  数据库中无配置记录');
    }

    // 4. 写入数据库
    console.log('\n💾 写入数据库...');
    const updateDb = () => {
        return new Promise((resolve, reject) => {
            const sql = existing
                ? 'UPDATE site_config SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
                : 'INSERT INTO site_config (id, config_data) VALUES (1, ?)';

            db.run(sql, [jsonContent], function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    await updateDb();
    console.log('✅ 配置已成功写入数据库');

    // 5. 验证
    console.log('\n🔍 验证数据...');
    const verify = () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT config_data FROM site_config WHERE id = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const result = await verify();
    const verifyConfig = JSON.parse(result.config_data);
    console.log(`✓ 验证成功: categories=${verifyConfig.categories?.length}, promo=${verifyConfig.promo?.length}`);

    // 6. 关闭数据库
    db.close();

    console.log('\n🎉 同步完成!\n');
    console.log('现在刷新浏览器,应该能看到完整的数据了。');
}

syncConfig().catch(error => {
    console.error('\n❌ 同步失败:', error);
    process.exit(1);
});
