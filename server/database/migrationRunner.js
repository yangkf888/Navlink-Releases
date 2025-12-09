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

export function runMigrations() {
    console.log('📦 Checking for database migrations...');
    initMigrationTable();

    const applied = new Set(getAppliedMigrations());
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ensure timestamp order

    let count = 0;

    for (const file of files) {
        if (applied.has(file)) continue;

        console.log(`Changes: Applying migration ${file}...`);
        const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

        // Allow multiple statements
        const runMigration = db.transaction(() => {
            db.exec(content);
            db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        });

        try {
            runMigration();
            console.log(`✅ Applied migration ${file}`);
            count++;
        } catch (error) {
            console.error(`❌ Failed to apply migration ${file}:`, error.message);
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
