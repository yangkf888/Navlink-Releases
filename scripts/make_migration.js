import fs from 'fs';
import path from 'path';

const name = process.argv[2];

if (!name) {
    console.error('Usage: node scripts/make_migration.js <name>');
    console.error('Example: node scripts/make_migration.js add_user_email');
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
const filename = `${timestamp}_${name}.sql`;
const filepath = path.join(process.cwd(), 'server', 'database', 'migrations', filename);

// Ensure directory exists
const dir = path.dirname(filepath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(filepath, `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- Write your SQL up migration here\n`);

console.log(`✅ Created migration file: server/database/migrations/${filename}`);
