const express = require('express');
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const embeddingService = require('../services/EmbeddingService');
const vectorStore = require('../services/VectorStore');

const router = express.Router();

// 自动向量化队列和状态
let isProcessingQueue = false;
const embeddingQueue = [];

/**
 * 将知识条目添加到向量化队列
 */
function queueForEmbedding(id) {
    if (!embeddingQueue.includes(id)) {
        embeddingQueue.push(id);
        processEmbeddingQueue();
    }
}

/**
 * 处理向量化队列
 */
async function processEmbeddingQueue() {
    if (isProcessingQueue || embeddingQueue.length === 0) return;

    isProcessingQueue = true;
    console.log('[kbrag] Processing embedding queue, items:', embeddingQueue.length);

    while (embeddingQueue.length > 0) {
        const id = embeddingQueue.shift();
        try {
            const db = getDb();
            const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
            if (!item || item.embedded === 1) continue;

            // 获取嵌入向量
            const text = `${item.title}\n\n${item.content}`;
            const embedding = await embeddingService.getEmbedding(text);

            if (embedding) {
                // 保存向量
                await vectorStore.saveVector(id, embedding);

                // 更新状态
                db.prepare('UPDATE knowledge_items SET embedded = 1 WHERE id = ?').run(id);
                console.log('[kbrag] Auto-embedded item:', id);
            }
        } catch (error) {
            console.error('[kbrag] Auto-embedding failed for', id, error.message);
            // 不重新加入队列，避免无限循环
        }
        // 短暂延迟避免请求过快
        await new Promise(r => setTimeout(r, 500));
    }

    isProcessingQueue = false;
}

/**
 * 获取知识条目列表
 * GET /api/items?page=1&limit=20&tag=xxx&search=xxx
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { page = 1, limit = 20, tag, search, embedded } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = 'SELECT * FROM knowledge_items WHERE 1=1';
        let countSql = 'SELECT COUNT(*) as total FROM knowledge_items WHERE 1=1';
        const params = [];
        const countParams = [];

        // 标签过滤
        if (tag) {
            sql += ` AND tags LIKE ?`;
            countSql += ` AND tags LIKE ?`;
            const tagParam = `%"${tag}"%`;
            params.push(tagParam);
            countParams.push(tagParam);
        }

        // 分类过滤
        const { category } = req.query;
        if (category) {
            sql += ` AND category = ?`;
            countSql += ` AND category = ?`;
            params.push(category);
            countParams.push(category);
        }

        // 搜索过滤
        if (search) {
            sql += ` AND (title LIKE ? OR content LIKE ?)`;
            countSql += ` AND (title LIKE ? OR content LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
            countParams.push(searchParam, searchParam);
        }

        // 向量化状态过滤
        if (embedded !== undefined) {
            sql += ` AND embedded = ?`;
            countSql += ` AND embedded = ?`;
            params.push(parseInt(embedded));
            countParams.push(parseInt(embedded));
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const items = db.prepare(sql).all(...params);
        const { total } = db.prepare(countSql).get(...countParams);

        // 解析 tags JSON
        const parsedItems = items.map(item => ({
            ...item,
            tags: JSON.parse(item.tags || '[]')
        }));

        res.json({
            success: true,
            data: parsedItems,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[kbrag] Get items error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取单个知识条目
 * GET /api/items/:id
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;

        const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);

        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        res.json({
            success: true,
            data: {
                ...item,
                tags: JSON.parse(item.tags || '[]')
            }
        });
    } catch (error) {
        console.error('[kbrag] Get item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建知识条目
 * POST /api/items
 */
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { title, content, url, tags = [], category = '', note } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO knowledge_items (id, title, content, url, tags, category, note, created_at, updated_at, embedded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(id, title, content, url || null, JSON.stringify(tags), category, note || null, now, now);

        console.log('[kbrag] Created item:', id);

        // 自动加入向量化队列
        queueForEmbedding(id);

        res.json({
            success: true,
            data: { id, title, content, url, tags, category, note, created_at: now, updated_at: now, embedded: 0 }
        });
    } catch (error) {
        console.error('[kbrag] Create item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新知识条目
 * PUT /api/items/:id
 */
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { title, content, url, tags, category, note } = req.body;

        const existing = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        const now = new Date().toISOString();
        const contentChanged = content !== undefined && content !== existing.content;

        db.prepare(`
            UPDATE knowledge_items 
            SET title = ?, content = ?, url = ?, tags = ?, category = ?, note = ?, updated_at = ?, embedded = ?
            WHERE id = ?
        `).run(
            title ?? existing.title,
            content ?? existing.content,
            url ?? existing.url,
            tags ? JSON.stringify(tags) : existing.tags,
            category ?? existing.category ?? '',
            note ?? existing.note,
            now,
            contentChanged ? 0 : existing.embedded, // 内容变化时重置向量化状态
            id
        );

        console.log('[kbrag] Updated item:', id);

        // 如果内容变化，自动加入向量化队列
        if (contentChanged) {
            queueForEmbedding(id);
        }

        res.json({ success: true, data: { id, updated_at: now } });
    } catch (error) {
        console.error('[kbrag] Update item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除知识条目
 * DELETE /api/items/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;

        const result = db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        console.log('[kbrag] Deleted item:', id);

        res.json({ success: true });
    } catch (error) {
        console.error('[kbrag] Delete item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量删除
 * POST /api/items/batch-delete
 */
router.post('/batch-delete', (req, res) => {
    try {
        const db = getDb();
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid ids' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const result = db.prepare(`DELETE FROM knowledge_items WHERE id IN (${placeholders})`).run(...ids);

        console.log('[kbrag] Batch deleted items:', result.changes);

        res.json({ success: true, deleted: result.changes });
    } catch (error) {
        console.error('[kbrag] Batch delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取统计信息
 * GET /api/items/stats
 */
router.get('/stats/summary', (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM knowledge_items').get();
        const embedded = db.prepare('SELECT COUNT(*) as count FROM knowledge_items WHERE embedded = 1').get();
        const pending = db.prepare('SELECT COUNT(*) as count FROM knowledge_items WHERE embedded = 0').get();

        res.json({
            success: true,
            data: {
                total: total.count,
                embedded: embedded.count,
                pending: pending.count
            }
        });
    } catch (error) {
        console.error('[kbrag] Get stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取按分类统计
 * GET /api/items/stats/by-category
 */
router.get('/stats/by-category', (req, res) => {
    try {
        const db = getDb();

        const rows = db.prepare(`
            SELECT category, COUNT(*) as count 
            FROM knowledge_items 
            GROUP BY category
        `).all();

        const stats = {};
        for (const row of rows) {
            const catName = row.category || '未分类';
            stats[catName] = row.count;
        }

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[kbrag] Get category stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
