/**
 * Sub插件多租户数据库迁移脚本
 * 添加 tenant_id 和 user_id 字段到所有表
 */

const sqlite3 = require('sqlite3').Database;
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'sub.db');

console.log('🔧 Sub插件多租户迁移');
console.log('数据库路径:', DB_PATH);
console.log('=====================================');

const db = new sqlite3(DB_PATH, (err) => {
    if (err) {
        console.error('❌ 数据库连接失败:', err);
        process.exit(1);
    }
});

// 迁移SQL
const migrations = [
    // 1. 为 subscriptions 表添加字段
    {
        name: '为 subscriptions 表添加多租户字段',
        sql: `
            ALTER TABLE subscriptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
            ALTER TABLE subscriptions ADD COLUMN user_id TEXT;
        `
    },
    // 2. 为 custom_reminders 表添加字段
    {
        name: '为 custom_reminders 表添加多租户字段',
        sql: `
            ALTER TABLE custom_reminders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
            ALTER TABLE custom_reminders ADD COLUMN user_id TEXT;
        `
    },
    // 3. 创建索引
    {
        name: '创建多租户索引',
        sql: `
            CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_user ON subscriptions(tenant_id, user_id);
            
            CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON custom_reminders(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_user ON custom_reminders(user_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_tenant_user ON custom_reminders(tenant_id, user_id);
        `
    }
];

// 执行迁移
function runMigrations() {
    return new Promise((resolve, reject) => {
        let completed = 0;
        
        migrations.forEach((migration, index) => {
            console.log(`\n${index + 1}. ${migration.name}...`);
            
            db.exec(migration.sql, (err) => {
                if (err) {
                    // 如果是字段已存在错误,忽略
                    if (err.message.includes('duplicate column name')) {
                        console.log('   ⚠️  字段已存在,跳过');
                    } else {
                        console.error(`   ❌ 失败:`, err.message);
                        reject(err);
                        return;
                    }
                } else {
                    console.log('   ✅ 成功');
                }
                
                completed++;
                if (completed === migrations.length) {
                    resolve();
                }
            });
        });
    });
}

// 验证迁移结果
function verifyMigration() {
    return new Promise((resolve, reject) => {
        console.log('\n🔍 验证迁移结果...');
        
        db.all(`PRAGMA table_info(subscriptions)`, (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const hasTenantId = columns.some(col => col.name === 'tenant_id');
            const hasUserId = columns.some(col => col.name === 'user_id');
            
            console.log(`   tenant_id 字段: ${hasTenantId ? '✅' : '❌'}`);
            console.log(`   user_id 字段: ${hasUserId ? '✅' : '❌'}`);
            
            if (hasTenantId && hasUserId) {
                console.log('\n✅ 迁移验证成功!');
                resolve();
            } else {
                reject(new Error('字段验证失败'));
            }
        });
    });
}

// 显示数据统计
function showStats() {
    return new Promise((resolve) => {
        console.log('\n📊 数据统计:');
        
        db.get(`SELECT COUNT(*) as total FROM subscriptions`, (err, row) => {
            if (!err) {
                console.log(`   订阅总数: ${row.total}`);
            }
        });
        
        db.get(`SELECT COUNT(*) as total FROM custom_reminders`, (err, row) => {
            if (!err) {
                console.log(`   提醒总数: ${row.total}`);
            }
            resolve();
        });
    });
}

// 主流程
(async () => {
    try {
        await runMigrations();
        await verifyMigration();
        await showStats();
        
        console.log('\n=====================================');
        console.log('🎉 Sub插件多租户迁移完成!');
        console.log('=====================================\n');
        
        db.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ 迁移失败:', error.message);
        db.close();
        process.exit(1);
    }
})();
