import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../config.js';
import { checkUrlHealth } from '../services/healthCheck.js';

const router = express.Router();
const CONFIG_PATH = path.join(DATA_DIR, 'app_config.json');

// Helper to read config
async function readConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// API: Check URL Health
router.post('/check-url', async (req, res) => {
    try {
        const { url } = req.body;
        const result = await checkUrlHealth(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to check URL' });
    }
});

// API: Batch Check Links
router.post('/check-links', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        const results = await Promise.all(
            urls.map(async (url) => {
                const result = await checkUrlHealth(url);
                return { url, ...result };
            })
        );

        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check links' });
    }
});

export default router;
