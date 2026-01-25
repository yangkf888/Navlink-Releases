import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.cwd(), 'data', 'navlink.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'server', 'database', 'migrations');

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

function initMigrationTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function getAppliedMigrations() {
    return db.prepare('SELECT name FROM migrations').all().map(row => row.name);
}

export async function runMigrations() {
    console.log('📦 Checking for database migrations...');
    initMigrationTable();

    const applied = new Set(getAppliedMigrations());

    // 支持 .sql 和 .js 迁移文件
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
        .sort(); // 确保按名称顺序（通常带时间戳前缀）执行

    let count = 0;

    for (const file of files) {
        if (applied.has(file)) continue;

        const filePath = path.join(MIGRATIONS_DIR, file);
        console.log(`Changes: Applying migration ${file}...`);

        try {
            if (file.endsWith('.sql')) {
                // 处理 SQL 迁移
                const content = fs.readFileSync(filePath, 'utf-8');
                const runSqlMigration = db.transaction(() => {
                    db.exec(content);
                    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
                });
                runSqlMigration();
            } else if (file.endsWith('.js')) {
                // 处理 JS 脚本迁移
                // 注意：使用 import() 动态加载 ES 模块
                // JS 模块应导出一个异步函数 run(db)
                const moduleUrl = `file://${filePath}`;
                const migrationModule = await import(moduleUrl);

                if (typeof migrationModule.up === 'function' || typeof migrationModule.run === 'function') {
                    const runFunc = migrationModule.up || migrationModule.run;

                    // 使用事务包装 JS 迁移 (如果脚本内部支持)
                    const runJsMigration = db.transaction(async () => {
                        await runFunc(db);
                        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
                    });

                    // 注意：better-sqlite3 的 transaction 是同步的，如果 JS 中有异步操作，这里需要特殊处理
                    // 大多数我们的 DB 迁移是同步的，如果是异步则需去掉 transaction 包装或手动管理
                    await runFunc(db);
                    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
                } else {
                    console.warn(`⚠️  Skip ${file}: No up() or run() function exported.`);
                    continue;
                }
            }

            console.log(`✅ Applied migration ${file}`);
            count++;
        } catch (error) {
            console.error(`❌ Failed to apply migration ${file}:`, error.message);
            // 关键逻辑：如果迁移失败，强制退出进程，防止带病运行导致数据损坏
            process.exit(1);
        }
    }

    if (count === 0) {
        console.log('✨ Database is up to date.');
    } else {
        console.log(`🚀 Successfully applied ${count} migrations.`);
    }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigrations();
}
