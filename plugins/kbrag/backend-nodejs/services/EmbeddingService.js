const { getDb } = require('../database');

/**
 * Embedding 服务
 * 调用云端 Embedding API 将文本转换为向量
 */
class EmbeddingService {
    constructor() {
        this.config = null;
    }

    /**
     * 获取 Embedding 配置
     */
    getConfig() {
        if (this.config) return this.config;

        try {
            const db = getDb();
            const row = db.prepare("SELECT value FROM kb_config WHERE key = 'embedding'").get();

            if (row) {
                this.config = JSON.parse(row.value);
            } else {
                // 默认配置
                this.config = {
                    provider: 'openai',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'text-embedding-3-small',
                    apiKey: ''
                };
            }
            return this.config;
        } catch (error) {
            console.error('[EmbeddingService] Get config error:', error);
            return null;
        }
    }

    /**
     * 清除配置缓存
     */
    clearConfigCache() {
        this.config = null;
    }

    /**
     * 检查配置是否有效
     */
    isConfigured() {
        const config = this.getConfig();
        return config && config.apiKey && config.baseUrl;
    }

    /**
     * 获取单个文本的 Embedding
     * @param {string} text - 要嵌入的文本
     * @returns {Promise<number[]>} - 向量数组
     */
    async getEmbedding(text) {
        const config = this.getConfig();

        if (!config || !config.apiKey) {
            throw new Error('Embedding API not configured');
        }

        try {
            const response = await fetch(`${config.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model || 'text-embedding-3-small',
                    input: text.substring(0, 8000) // 限制长度
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Embedding API failed');
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.error('[EmbeddingService] Get embedding error:', error);
            throw error;
        }
    }

    /**
     * 批量获取 Embeddings
     * @param {string[]} texts - 文本数组
     * @returns {Promise<number[][]>} - 向量数组
     */
    async getBatchEmbeddings(texts) {
        const config = this.getConfig();

        if (!config || !config.apiKey) {
            throw new Error('Embedding API not configured');
        }

        try {
            // 限制每个文本长度
            const truncatedTexts = texts.map(t => t.substring(0, 8000));

            const response = await fetch(`${config.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model || 'text-embedding-3-small',
                    input: truncatedTexts
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Embedding API failed');
            }

            const data = await response.json();
            // 按原始顺序返回
            return data.data
                .sort((a, b) => a.index - b.index)
                .map(d => d.embedding);
        } catch (error) {
            console.error('[EmbeddingService] Batch embedding error:', error);
            throw error;
        }
    }
}

// 导出单例
module.exports = new EmbeddingService();
