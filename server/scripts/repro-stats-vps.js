
import StatsService from '../services/StatsService.js';
import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/navlink.db');

// Manually access DB to insert test data
const db = new DatabaseWrapper(DB_PATH);

async function run() {
    console.log('🤖 Starting Stats Repro Script...');
    const testId = "1737380000000"; // Large numeric string ID
    const testUrl = "https://repro-test.com";

    try {
        // 1. Clean up potential old test data
        db.run('DELETE FROM items WHERE id = ?', [testId]);
        db.run('DELETE FROM categories WHERE id = ?', [99999]);

        // 2. Insert dummy category
        console.log('📝 Inserting dummy category...');
        db.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [99999, 'Repro Cat', 0]);

        // 3. Insert test item with large string ID
        console.log(`📝 Inserting test item with ID: "${testId}" (String)`);

        // Note: passing ID as string to INSERT. SQLite column is INTEGER.
        db.run(
            `INSERT INTO items (id, category_id, subcategory_id, title, url, description, icon, click_count, sort_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [testId, 99999, null, 'Repro Item', testUrl, 'Test Desc', '', 0]
        );

        // Verify insertion
        const inserted = db.get('SELECT * FROM items WHERE id = ?', [testId]);
        console.log('✅ Item inserted. DB Row:', inserted);
        console.log('   DB ID Type:', typeof inserted.id); // Should be number in better-sqlite3

        // 4. Track Click using String ID
        console.log('🖱️  Tracking click with ID:', testId, '(String)');
        await StatsService.trackClick(testId, false);

        // Wait a bit for async execution (StatsService uses fire-and-forget)
        await new Promise(r => setTimeout(r, 1000));

        // 5. Verify Click Count
        const updated = db.get('SELECT * FROM items WHERE id = ?', [testId]);
        console.log('📊 Result after click. Click Count:', updated.click_count);

        if (updated.click_count > 0) {
            console.log('🎉 SUCCESS: Click tracked successfully!');
        } else {
            console.error('❌ FAILURE: Click count is still 0!');
        }

        // Cleanup
        db.run('DELETE FROM items WHERE id = ?', [testId]);
        db.run('DELETE FROM categories WHERE id = ?', [99999]);

    } catch (err) {
        console.error('💥 Error:', err);
    }
}

run();
