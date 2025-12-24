const express = require('express');
const { getDb } = require('../database');
const vectorStore = require('../services/VectorStore');
const embeddingService = require('../services/EmbeddingService');

const router = express.Router();

/**
 * 关键词搜索
 * GET /api/search?q=xxx&limit=10
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { q, limit = 10 } = req.query;

        if (!q) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }

        // 关键词搜索
        const items = db.prepare(`
            SELECT id, title, content, url, tags, created_at
            FROM knowledge_items 
            WHERE title LIKE ? OR content LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(`%${q}%`, `%${q}%`, parseInt(limit));

        const results = items.map(item => ({
            ...item,
            tags: JSON.parse(item.tags || '[]'),
            snippet: generateSnippet(item.content, q)
        }));

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[kbrag] Search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 语义搜索 (向量检索)
 * POST /api/search/semantic
 */
router.post('/semantic', async (req, res) => {
    try {
        const { query, limit = 5 } = req.body;

        if (!query) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }

        // 检查 Embedding 是否配置
        if (!embeddingService.isConfigured()) {
            // 降级到关键词搜索
            const db = getDb();
            const items = db.prepare(`
                SELECT id, title, content, url, tags, created_at
                FROM knowledge_items 
                WHERE content LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
            `).all(`%${query}%`, parseInt(limit));

            return res.json({
                success: true,
                data: items.map(item => ({
                    ...item,
                    tags: JSON.parse(item.tags || '[]'),
                    snippet: generateSnippet(item.content, query),
                    score: 0
                })),
                method: 'keyword_fallback'
            });
        }

        // 执行语义搜索
        const results = await vectorStore.semanticSearch(query, parseInt(limit));

        res.json({
            success: true,
            data: results.map(item => ({
                ...item,
                snippet: generateSnippet(item.content, query)
            })),
            method: 'semantic'
        });
    } catch (error) {
        console.error('[kbrag] Semantic search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * RAG 查询 (用于 AI 对话)
 * POST /api/search/rag
 */
router.post('/rag', async (req, res) => {
    try {
        const { query, limit = 3 } = req.body;

        if (!query) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }

        let items;
        let method = 'keyword';

        // 尝试语义搜索
        if (embeddingService.isConfigured()) {
            try {
                items = await vectorStore.semanticSearch(query, parseInt(limit));
                method = 'semantic';
            } catch (e) {
                console.warn('[kbrag] Semantic search failed, falling back to keyword:', e.message);
            }
        }

        // 降级到关键词搜索
        if (!items || items.length === 0) {
            const db = getDb();
            items = db.prepare(`
                SELECT id, title, content, url
                FROM knowledge_items 
                WHERE title LIKE ? OR content LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
            `).all(`%${query}%`, `%${query}%`, parseInt(limit));
        }

        // 构建用于 AI 上下文的内容
        const context = items.map((item, index) => (
            `[来源${index + 1}] ${item.title}\n${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`
        )).join('\n\n');

        res.json({
            success: true,
            data: {
                context,
                sources: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    url: item.url,
                    score: item.score || null
                })),
                count: items.length,
                method
            }
        });
    } catch (error) {
        console.error('[kbrag] RAG query error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 手动向量化单个条目
 * POST /api/search/embed/:id
 */
router.post('/embed/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!embeddingService.isConfigured()) {
            return res.status(400).json({ success: false, error: 'Embedding API not configured' });
        }

        await vectorStore.embedItem(id);

        res.json({ success: true, message: 'Item embedded successfully' });
    } catch (error) {
        console.error('[kbrag] Embed item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量向量化待处理条目
 * POST /api/search/embed-pending
 */
router.post('/embed-pending', async (req, res) => {
    try {
        const { batchSize = 10 } = req.body;

        if (!embeddingService.isConfigured()) {
            return res.status(400).json({ success: false, error: 'Embedding API not configured' });
        }

        const result = await vectorStore.embedPending(parseInt(batchSize));

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[kbrag] Embed pending error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 生成搜索结果摘要
 */
function generateSnippet(content, query, contextLength = 100) {
    if (!content || !query) return content?.substring(0, 200) || '';

    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
        return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }

    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + query.length + contextLength);

    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
}

module.exports = router;
