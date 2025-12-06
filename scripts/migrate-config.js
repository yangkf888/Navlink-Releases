#!/usr/bin/env node

/**
 * 配置迁移命令行工具
 * 使用方法: node scripts/migrate-config.js
 */

import { migrateConfigToSQLite } from '../server/database/migrateConfig.js';

console.log('\n╔════════════════════════════════════════╗');
console.log('║  NavLink 配置数据迁移工具              ║');
console.log('║  JSON -> SQLite                       ║');
console.log('╚════════════════════════════════════════╝\n');

console.log('⚠️  警告: 此操作将会：');
console.log('  1. 备份当前 app_config.json');
console.log('  2. 将所有配置迁移到 SQLite 数据库');
console.log('  3. 更新后端 API 以使用新的数据库');
console.log('');

// 执行迁移
migrateConfigToSQLite()
    .then((result) => {
        console.log('\n✅ 迁移成功完成！');
        console.log('\n📋 后续步骤:');
        console.log('  1. 重启服务器: npm run dev 或 node server.js');
        console.log('  2. 验证前端配置加载正常');
        console.log('  3. 测试管理后台配置页面');
        console.log('\n💡 提示:');
        console.log('  - 原 JSON 文件已备份到 app_config.json.backup');
        console.log('  - 所有 API 接口保持不变');
        console.log('  - 数据库文件位于 data/navlink.db\n');

        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ 迁移失败！');
        console.error('错误信息:', error.message);
        console.error('');
        console.error('💡 故障排除:');
        console.error('  1. 确保 data/app_config.json 存在且格式正确');
        console.error('  2. 确保有 data 目录的读写权限');
        console.error('  3. 检查 data/navlink.db 文件权限');
        console.error('  4. 查看完整错误堆栈:\n');
        console.error(error.stack);

        process.exit(1);
    });
