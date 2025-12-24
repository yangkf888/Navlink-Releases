const { getDb } = require('../database');
const embeddingService = require('./EmbeddingService');

/**
 * 向量存储服务
 * 使用 SQLite 存储向量，支持余弦相似度检索
 * 注：这是简化版实现，适用于小规模数据（<10000条）
 * 大规模数据建议使用 Chroma 或 Qdrant
 */
class VectorStore {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化向量存储表
     */
    init() {
        if (this.initialized) return;

        const db = getDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS kb_vectors (
                item_id TEXT PRIMARY KEY,
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);

        this.initialized = true;
        console.log('[VectorStore] Initialized');
    }

    /**
     * 存储向量
     * @param {string} itemId - 知识条目 ID
     * @param {number[]} embedding - 向量数组
     */
    async store(itemId, embedding) {
        this.init();
        const db = getDb();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT OR REPLACE INTO kb_vectors (item_id, embedding, created_at)
            VALUES (?, ?, ?)
        `).run(itemId, JSON.stringify(embedding), now);

        // 更新知识条目的 embedded 状态
        db.prepare('UPDATE knowledge_items SET embedded = 1 WHERE id = ?').run(itemId);

        console.log('[VectorStore] Stored vector for:', itemId);
    }

    /**
     * 删除向量
     * @param {string} itemId - 知识条目 ID
     */
    delete(itemId) {
        this.init();
        const db = getDb();
        db.prepare('DELETE FROM kb_vectors WHERE item_id = ?').run(itemId);
    }

    /**
     * 搜索相似内容
     * @param {number[]} queryEmbedding - 查询向量
     * @param {number} limit - 返回数量
     * @returns {Array<{itemId: string, score: number}>}
     */
    async search(queryEmbedding, limit = 5) {
        this.init();
        const db = getDb();

        // 获取所有向量
        const rows = db.prepare('SELECT item_id, embedding FROM kb_vectors').all();

        if (rows.length === 0) {
            return [];
        }

        // 计算余弦相似度
        const results = rows.map(row => {
            const embedding = JSON.parse(row.embedding);
            const score = this.cosineSimilarity(queryEmbedding, embedding);
            return { itemId: row.item_id, score };
        });

        // 排序并返回 top-k
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * 计算余弦相似度
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 为知识条目生成并存储向量
     * @param {string} itemId - 知识条目 ID
     */
    async embedItem(itemId) {
        const db = getDb();
        const item = db.prepare('SELECT title, content FROM knowledge_items WHERE id = ?').get(itemId);

        if (!item) {
            throw new Error('Item not found');
        }

        // 组合标题和内容作为嵌入文本
        const text = `${item.title}\n\n${item.content}`;

        // 获取向量
        const embedding = await embeddingService.getEmbedding(text);

        // 存储向量
        await this.store(itemId, embedding);

        return embedding;
    }

    /**
     * 批量嵌入未向量化的条目
     * @param {number} batchSize - 批量大小
     */
    async embedPending(batchSize = 10) {
        const db = getDb();
        const items = db.prepare(`
            SELECT id, title, content FROM knowledge_items 
            WHERE embedded = 0 
            LIMIT ?
        `).all(batchSize);

        if (items.length === 0) {
            return { processed: 0, success: 0, failed: 0 };
        }

        let success = 0;
        let failed = 0;

        for (const item of items) {
            try {
                await this.embedItem(item.id);
                success++;
            } catch (error) {
                console.error(`[VectorStore] Failed to embed item ${item.id}:`, error.message);
                failed++;
            }
        }

        return { processed: items.length, success, failed };
    }

    /**
     * 语义搜索
     * @param {string} query - 查询文本
     * @param {number} limit - 返回数量
     */
    async semanticSearch(query, limit = 5) {
        // 获取查询向量
        const queryEmbedding = await embeddingService.getEmbedding(query);

        // 搜索相似内容
        const results = await this.search(queryEmbedding, limit);

        // 获取知识条目详情
        const db = getDb();
        const itemsWithDetails = results.map(r => {
            const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(r.itemId);
            if (item) {
                return {
                    ...item,
                    tags: JSON.parse(item.tags || '[]'),
                    score: r.score
                };
            }
            return null;
        }).filter(Boolean);

        return itemsWithDetails;
    }
}

// 导出单例
module.exports = new VectorStore();
