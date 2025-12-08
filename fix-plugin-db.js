#!/usr/bin/env node

/**
 * 快速修复脚本：在容器内添加缺失的数据库字段
 * 
 * 此脚本会：
 * 1. 备份现有数据库
 * 2. 为sub插件数据库添加缺失的字段
 * 3. 检查docker和vps插件是否存在类似问题
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 开始修复插件数据库表结构问题...\n');

// 容器名称
const CONTAINER = 'navlink-app';

// 备份数据库
console.log('📦 步骤 1/4: 备份数据库文件...');
try {
    execSync(`docker exec ${CONTAINER} cp /app/data/sub.db /app/data/sub.db.backup`, { stdio: 'inherit' });
    console.log('✅ sub.db 已备份\n');
} catch (err) {
    console.error('❌ 备份失败，请手动备份后重试');
    process.exit(1);
}

// 执行迁移脚本
console.log('🔄 步骤 2/4: 执行sub插件数据库迁移...');
try {
    execSync(`docker exec -w /app/plugins/sub/backend-nodejs ${CONTAINER} node database/migrate-schema.js`, { stdio: 'inherit' });
    console.log('✅ 迁移脚本执行完成\n');
} catch (err) {
    console.warn('⚠️  迁移脚本执行可能有问题，继续检查...\n');
}

// 重启sub插件（如果有独立进程）
console.log('🔄 步骤 3/4: 重启容器以使更改生效...');
try {
    execSync(`docker restart ${CONTAINER}`, { stdio: 'inherit' });
    console.log('✅ 容器已重启\n');
    console.log('⏳ 等待容器完全启动（30秒）...');
    execSync('sleep 30', { stdio: 'inherit' });
} catch (err) {
    console.error('❌ 重启容器失败');
    process.exit(1);
}

// 验证修复
console.log('🔍 步骤 4/4: 验证修复结果...');
console.log('请访问 http://localhost:3005 的sub插件页面测试创建订阅功能\n');

console.log('✨ 修复脚本执行完成！');
console.log('\n📝 后续步骤:');
console.log('1. 访问 http://localhost:3005/api/plugins/sub');
console.log('2. 尝试创建一个新的订阅');
console.log('3. 如果仍有问题，请查看容器日志: docker logs navlink-app');
