const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const projectRoot = path.join(__dirname, '..', '..', '..', '..');
const SOURCE_DB = path.join(projectRoot, 'navlink.db');
const TARGET_DB = path.join(projectRoot, 'data', 'sub.db');

console.log('[Migration] Migrating data from navlink.db to sub.db...');
console.log('[Migration] Source:', SOURCE_DB);
console.log('[Migration] Target:', TARGET_DB);

const sourceDb = new sqlite3.Database(SOURCE_DB, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('[Migration] Failed to open source database:', err);
        process.exit(1);
    }
});

const targetDb = new sqlite3.Database(TARGET_DB, (err) => {
    if (err) {
        console.error('[Migration] Failed to open target database:', err);
        process.exit(1);
    }
});

// 默认租户和用户
const DEFAULT_TENANT_ID = 'default';
const DEFAULT_USER_ID = 'user_1001';

sourceDb.all('SELECT * FROM subscriptions', [], (err, rows) => {
    if (err) {
        console.error('[Migration] Failed to read source data:', err);
        sourceDb.close();
        targetDb.close();
        process.exit(1);
    }

    console.log(`[Migration] Found ${rows.length} subscriptions to migrate`);

    if (rows.length === 0) {
        console.log('[Migration] No data to migrate');
        sourceDb.close();
        targetDb.close();
        return;
    }

    // 清空目标表
    targetDb.run('DELETE FROM subscriptions', (err) => {
        if (err) {
            console.error('[Migration] Failed to clear target table:', err);
            sourceDb.close();
            targetDb.close();
            process.exit(1);
        }

        console.log('[Migration] Cleared existing data in target database');

        // 开始事务
        targetDb.serialize(() => {
            targetDb.run('BEGIN TRANSACTION');

            const insertSql = `INSERT INTO subscriptions (
                id, tenant_id, user_id, name, customType, category, notes,
                isActive, autoRenew, startDate, expiryDate,
                periodValue, periodUnit, reminderValue, reminderUnit, useLunar,
                price, currency, currencySymbol, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            let successCount = 0;
            let errorCount = 0;

            rows.forEach((row, index) => {
                targetDb.run(insertSql, [
                    row.id,
                    DEFAULT_TENANT_ID,
                    DEFAULT_USER_ID,
                    row.name,
                    row.custom_type || '',
                    row.category || '',
                    row.notes || '',
                    row.is_active || 1,
                    row.auto_renew || 0,
                    row.start_date || '',
                    row.expiry_date,
                    row.period_value || 1,
                    row.period_unit || 'month',
                    row.reminder_value || 7,
                    row.reminder_unit || 'day',
                    row.use_lunar || 0,
                    row.price || 0,
                    row.currency || 'CNY',
                    row.currency_symbol || '¥',
                    row.created_at || new Date().toISOString(),
                    row.updated_at || new Date().toISOString()
                ], (err) => {
                    if (err) {
                        console.error(`[Migration] Error inserting row ${index + 1}:`, err.message);
                        errorCount++;
                    } else {
                        successCount++;
                        console.log(`[Migration] ✓ Migrated: ${row.name} (${successCount}/${rows.length})`);
                    }

                    // 最后一条记录处理完成后提交事务
                    if (index === rows.length - 1) {
                        if (errorCount > 0) {
                            targetDb.run('ROLLBACK', () => {
                                console.log(`\n[Migration] ROLLBACK due to errors: ${errorCount} failed`);
                                sourceDb.close();
                                targetDb.close();
                                process.exit(1);
                            });
                        } else {
                            targetDb.run('COMMIT', () => {
                                console.log(`\n[Migration] SUCCESS: ${successCount} subscriptions migrated!`);
                                sourceDb.close();
                                targetDb.close();
                            });
                        }
                    }
                });
            });
        });
    });
});
