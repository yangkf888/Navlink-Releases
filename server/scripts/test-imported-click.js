
import StatsService from '../services/StatsService.js';
import { DatabaseWrapper } from '../utils/db-wrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/navlink.db');

const db = new DatabaseWrapper(DB_PATH);

async function run() {
    // Target ID from the user's DB dump
    const targetId = "1768786290723";

    console.log(`🤖 Testing click tracking for item ID: ${targetId}`);

    try {
        // 1. Get initial count
        const before = db.get('SELECT click_count, title FROM items WHERE id = ?', [targetId]);
        if (!before) {
            console.error('❌ Item not found!');
            return;
        }
        console.log(`📊 Initial Count for "${before.title}":`, before.click_count);

        // 2. Track Click
        console.log('🖱️  Tracking click...');
        await StatsService.trackClick(targetId, false);

        // Wait for async
        await new Promise(r => setTimeout(r, 1000));

        // 3. Get final count
        const after = db.get('SELECT click_count FROM items WHERE id = ?', [targetId]);
        console.log(`📊 Final Count:`, after.click_count);

        if (after.click_count > before.click_count) {
            console.log('🎉 SUCCESS: Click count incremented!');
        } else {
            console.error('❌ FAILURE: Click count did NOT increment.');
        }

    } catch (err) {
        console.error('💥 Error:', err);
    }
}

run();
