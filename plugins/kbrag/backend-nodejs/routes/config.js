const express = require('express');
const { getDb } = require('../database');
const embeddingService = require('../services/EmbeddingService');

const router = express.Router();

/**
 * 获取所有配置
 * GET /api/config
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const configs = db.prepare('SELECT * FROM kb_config').all();

        const configMap = {};
        configs.forEach(c => {
            try {
                configMap[c.key] = JSON.parse(c.value);
            } catch {
                configMap[c.key] = c.value;
            }
        });

        res.json({ success: true, data: configMap });
    } catch (error) {
        console.error('[kbrag] Get config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取 Embedding 配置
 * GET /api/config/embedding
 */
router.get('/embedding', (req, res) => {
    try {
        const db = getDb();
        const config = db.prepare("SELECT value FROM kb_config WHERE key = 'embedding'").get();

        if (!config) {
            return res.json({
                success: true,
                data: {
                    provider: 'openai',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'text-embedding-3-small',
                    apiKey: ''
                }
            });
        }

        res.json({ success: true, data: JSON.parse(config.value) });
    } catch (error) {
        console.error('[kbrag] Get embedding config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存 Embedding 配置
 * POST /api/config/embedding
 */
router.post('/embedding', (req, res) => {
    try {
        const db = getDb();
        const { provider, baseUrl, model, apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({ success: false, error: 'API Key is required' });
        }

        const value = JSON.stringify({ provider, baseUrl, model, apiKey });

        db.prepare(`
            INSERT OR REPLACE INTO kb_config (key, value) VALUES ('embedding', ?)
        `).run(value);

        // 清除配置缓存
        embeddingService.clearConfigCache();

        console.log('[kbrag] Embedding config saved');

        res.json({ success: true });
    } catch (error) {
        console.error('[kbrag] Save embedding config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 测试 Embedding API 连接
 * POST /api/config/embedding/test
 */
router.post('/embedding/test', async (req, res) => {
    try {
        const { baseUrl, apiKey, model } = req.body;

        if (!baseUrl || !apiKey) {
            return res.status(400).json({ success: false, error: 'baseUrl and apiKey are required' });
        }

        if (!model) {
            return res.status(400).json({ success: false, error: '请先选择一个模型' });
        }

        console.log('[kbrag] Testing embedding API:', { baseUrl, model });

        // 调用 Embedding API 测试
        // 使用数组格式的 input，兼容更多 API
        const response = await fetch(`${baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                input: ['Test'] // 使用数组格式，部分 API 要求这种格式
            })
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[kbrag] Invalid JSON response:', responseText.substring(0, 500));
            return res.status(400).json({ success: false, error: 'API 返回了无效的响应格式' });
        }

        if (!response.ok) {
            const errorMsg = data.error?.message || data.message || data.error || JSON.stringify(data);
            console.error('[kbrag] Embedding test failed:', errorMsg);
            return res.status(400).json({ success: false, error: errorMsg });
        }

        // 处理成功响应
        const embedding = data.data?.[0]?.embedding;
        res.json({
            success: true,
            data: {
                dimensions: embedding?.length || 0,
                model: data.model || model
            }
        });
    } catch (error) {
        console.error('[kbrag] Test embedding API error:', error);
        res.status(500).json({ success: false, error: error.message || '连接失败，请检查网络或 API 地址' });
    }
});

/**
 * 获取可用模型列表
 * POST /api/config/embedding/models
 */
router.post('/embedding/models', async (req, res) => {
    try {
        const { baseUrl, apiKey } = req.body;

        if (!baseUrl || !apiKey) {
            return res.status(400).json({ success: false, error: 'baseUrl and apiKey are required' });
        }

        // 调用 OpenAI 兼容的 /models API
        const response = await fetch(`${baseUrl}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(400).json({
                success: false,
                error: error.error?.message || `Failed to fetch models (${response.status})`
            });
        }

        const data = await response.json();

        // 过滤出 embedding 模型
        const embeddingModels = (data.data || [])
            .filter(model => {
                const id = model.id.toLowerCase();
                // 筛选 embedding 相关模型
                return id.includes('embedding') ||
                    id.includes('embed') ||
                    id.includes('text-embedding');
            })
            .map(model => ({
                id: model.id,
                name: model.id,
                created: model.created
            }))
            .sort((a, b) => a.id.localeCompare(b.id));

        // 如果没有找到 embedding 模型，返回所有模型
        const allModels = embeddingModels.length > 0
            ? embeddingModels
            : (data.data || []).map(model => ({
                id: model.id,
                name: model.id,
                created: model.created
            })).sort((a, b) => a.id.localeCompare(b.id));

        res.json({
            success: true,
            data: allModels,
            hasEmbeddingModels: embeddingModels.length > 0
        });
    } catch (error) {
        console.error('[kbrag] Get models error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
