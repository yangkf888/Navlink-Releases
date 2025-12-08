#!/usr/bin/env node
/**
 * 数据库迁移:添加config_data字段
 * 用于从旧版本升级到新版本(使用JSON配置)
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';

// 使用环境变量或默认路径
const DB_PATH = process.env.DB_PATH || '/app/data/navlink.db';

console.log('========================================');
console.log('  NavLink数据库迁移: 添加config_data字段');
console.log('========================================\n');

// 检查数据库文件是否存在
if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ 数据库文件不存在: ${DB_PATH}`);
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

// 检查site_config表结构
db.all("PRAGMA table_info(site_config)", (err, columns) => {
    if (err) {
        console.error('❌ 查询表结构失败:', err);
        process.exit(1);
    }

    console.log('📊 当前site_config表字段:');
    columns.forEach(col => {
        console.log(`   - ${col.name} (${col.type})`);
    });

    // 检查是否已有config_data字段
    const hasConfigData = columns.some(col => col.name === 'config_data');

    if (hasConfigData) {
        console.log('\n✅ config_data字段已存在,无需迁移');
        db.close();
        process.exit(0);
    }

    console.log('\n⚠️  缺少config_data字段,开始迁移...');

    // 添加config_data字段
    db.run('ALTER TABLE site_config ADD COLUMN config_data TEXT', (err) => {
        if (err) {
            console.error('❌ 添加字段失败:', err);
            db.close();
            process.exit(1);
        }

        console.log('✅ 成功添加config_data字段');

        // 验证
        db.all("PRAGMA table_info(site_config)", (err, newColumns) => {
            if (err) {
                console.error('❌ 验证失败:', err);
                db.close();
                process.exit(1);
            }

            console.log('\n📊 更新后的site_config表字段:');
            newColumns.forEach(col => {
                console.log(`   ${col.name === 'config_data' ? '✨' : '  '} ${col.name} (${col.type})`);
            });

            db.close();
            console.log('\n🎉 迁移完成!\n');
            console.log('请重启容器以使更改生效:');
            console.log('  docker restart navlink-app\n');
        });
    });
});
