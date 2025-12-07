const sqlite3 = require('sqlite3').Database;
const path = require('path');

// 数据库路径
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const DB_PATH = path.join(projectRoot, 'data', 'sub.db');

console.log('[Migration] Starting schema update for sub.db...');
console.log('[Migration] Database path:', DB_PATH);

const db = new sqlite3(DB_PATH, (err) => {
    if (err) {
        console.error('[Migration] Failed to open database:', err);
        process.exit(1);
    }
});

// 迁移脚本：添加新字段
db.serialize(() => {
    console.log('[Migration] Adding new columns...');

    //添加新字段（如果不存在）
    const migrations = [
        // 类型字段
        `ALTER TABLE subscriptions ADD COLUMN customType TEXT DEFAULT ''`,

        // 周期字段
        `ALTER TABLE subscriptions ADD COLUMN periodValue INTEGER DEFAULT 1`,
        `ALTER TABLE subscriptions ADD COLUMN periodUnit TEXT DEFAULT 'month'`,

        // 提醒字段
        `ALTER TABLE subscriptions ADD COLUMN reminderValue INTEGER DEFAULT 7`,
        `ALTER TABLE subscriptions ADD COLUMN reminderUnit TEXT DEFAULT 'day'`,

        // 开始日期
        `ALTER TABLE subscriptions ADD COLUMN startDate TEXT DEFAULT ''`,

        // 自动续费
        `ALTER TABLE subscriptions ADD COLUMN autoRenew INTEGER DEFAULT 0`,

        // 农历
        `ALTER TABLE subscriptions ADD COLUMN useLunar INTEGER DEFAULT 0`,

        // 币种符号
        `ALTER TABLE subscriptions ADD COLUMN currencySymbol TEXT DEFAULT '¥'`,

        // 租户和用户字段（多租户支持）
        `ALTER TABLE subscriptions ADD COLUMN tenant_id TEXT DEFAULT 'default'`,
        `ALTER TABLE subscriptions ADD COLUMN user_id TEXT DEFAULT 'user_1001'`
    ];

    let successCount = 0;
    let errorCount = 0;

    migrations.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                // 如果列已存在，忽略错误
                if (err.message.includes('duplicate column name')) {
                    console.log(`[Migration] Column already exists (${index + 1}/${migrations.length})`);
                } else {
                    console.error(`[Migration] Error: ${err.message}`);
                    errorCount++;
                }
            } else {
                console.log(`[Migration] ✓ Added column (${index + 1}/${migrations.length})`);
                successCount++;
            }

            // 最后一个迁移完成后关闭数据库
            if (index === migrations.length - 1) {
                console.log(`\n[Migration] Summary: ${successCount} columns added, ${errorCount} errors`);

                // 创建索引
                console.log('[Migration] Creating indexes...');
                db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_user ON subscriptions(tenant_id, user_id)', (err) => {
                    if (err) {
                        console.error('[Migration] Index creation error:', err);
                    } else {
                        console.log('[Migration] ✓ Tenant/User index created');
                    }

                    db.close((err) => {
                        if (err) {
                            console.error('[Migration] Failed to close database:', err);
                        } else {
                            console.log('[Migration] Database migration completed!');
                        }
                    });
                });
            }
        });
    });
});
