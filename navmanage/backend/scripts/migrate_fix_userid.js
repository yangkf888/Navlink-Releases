
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../data/navmanage.db');

async function migrate() {
    console.log('Starting migration to fix user_id constraint...');

    if (!fs.existsSync(dbPath)) {
        console.error('Database file not found at:', dbPath);
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    try {
        // Disable foreign keys to avoid issues during table recreation
        db.run('PRAGMA foreign_keys=off;');

        db.run('BEGIN TRANSACTION;');

        // 1. Create new table (without NOT NULL on user_id)
        db.run(`
            CREATE TABLE IF NOT EXISTS activation_codes_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                plan_type TEXT DEFAULT 'personal',
                max_installs INTEGER DEFAULT 1,
                remaining_installs INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 2. Copy data
        db.run('INSERT INTO activation_codes_new SELECT * FROM activation_codes;');

        // 3. Drop old table
        db.run('DROP TABLE activation_codes;');

        // 4. Rename new table
        db.run('ALTER TABLE activation_codes_new RENAME TO activation_codes;');

        db.run('COMMIT;');
        db.run('PRAGMA foreign_keys=on;');

        // Save database
        const data = db.export();
        const saveBuffer = Buffer.from(data);
        fs.writeFileSync(dbPath, saveBuffer);

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
        db.run('ROLLBACK;');
    } finally {
        db.close();
    }
}

migrate();
