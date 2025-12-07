#!/usr/bin/env node
/**
 * 从 Navlink1202 导入配置到开发环境
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DB = path.join(__dirname, '../../Navlink1202/data/navlink.db');
const TARGET_DB = path.join(__dirname, '../../data/navlink.db');

async function importConfig() {
    console.log('========================================');
    console.log('  从 Navlink1202 导入配置');
    console.log('========================================\n');

    // 1. 读取源数据库
    console.log('📖 读取 Navlink1202 配置...');
    const sourceDb = new sqlite3.Database(SOURCE_DB);

    const getSourceConfig = () => {
        return new Promise((resolve, reject) => {
            sourceDb.get('SELECT config_data FROM site_config WHERE id = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const sourceConfig = await getSourceConfig();
    if (!sourceConfig || !sourceConfig.config_data) {
        console.error('❌ Navlink1202数据库中没有配置数据');
        process.exit(1);
    }

    const configData = JSON.parse(sourceConfig.config_data);
    console.log(`✓ 配置大小: ${(sourceConfig.config_data.length / 1024).toFixed(2)} KB`);
    console.log(`✓ categories: ${configData.categories?.length || 0} 个`);
    console.log(`✓ topNav: ${configData.topNav?.length || 0} 项`);
    console.log(`✓ logo: ${configData.logoUrl}`);
    console.log(`✓ hero title: ${configData.hero?.title}`);

    sourceDb.close();

    // 2. 写入目标数据库
    console.log('\n💾 写入开发环境数据库...');
    const targetDb = new sqlite3.Database(TARGET_DB);

    const updateTarget = () => {
        return new Promise((resolve, reject) => {
            targetDb.run(
                'UPDATE site_config SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
                [sourceConfig.config_data],
                function (err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });
    };

    await updateTarget();
    console.log('✅ 配置已成功写入');

    // 3. 验证
    console.log('\n🔍 验证数据...');
    const verify = () => {
        return new Promise((resolve, reject) => {
            targetDb.get('SELECT config_data FROM site_config WHERE id = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const result = await verify();
    const verifyConfig = JSON.parse(result.config_data);
    console.log(`✓ 验证成功:`);
    console.log(`  - categories: ${verifyConfig.categories?.length}`);
    console.log(`  - topNav: ${verifyConfig.topNav?.length}`);
    console.log(`  - logo: ${verifyConfig.logoUrl}`);

    targetDb.close();

    console.log('\n🎉 导入完成!\n');
    console.log('现在刷新浏览器,应该能看到Navlink1202的数据了。');
}

importConfig().catch(error => {
    console.error('\n❌ 导入失败:', error);
    process.exit(1);
});
