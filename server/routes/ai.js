import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import fetch from 'node-fetch';
import configService from '../services/ConfigService.js';

const router = express.Router();

/**
 * AI 聊天代理 (支持 SSE 流式请求)
 * POST /api/ai/chat
 */
router.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { model, messages, temperature, max_tokens, stream, providerId } = req.body;

        // 🛡️ 安全增强：从后端配置中获取 API Key 和 BaseURL
        const fullConfig = await configService.getFullConfig();
        const aiConfig = fullConfig?.aiConfig;

        if (!aiConfig || !aiConfig.providers) {
            return res.status(500).json({ error: '系统未配置 AI 服务' });
        }

        // 查找指定的 provider 或默认 provider
        let provider = null;
        if (providerId) {
            provider = aiConfig.providers.find(p => p.id === providerId && p.enabled);
        } else {
            provider = aiConfig.providers.find(p => p.id === aiConfig.defaultProvider && p.enabled)
                || aiConfig.providers.find(p => p.enabled);
        }

        if (!provider || !provider.apiKey) {
            return res.status(400).json({ error: '未找到可用的 AI 配置或 API Key 已失效' });
        }

        const apiKey = provider.apiKey;
        const baseUrl = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');

        let apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

        console.log(`[AI Proxy] Chat Request Forwarding:
            Model: ${model || provider.model}
            Provider: ${provider.name}
            Target URL: ${apiUrl}
            Stream: ${stream !== false}
        `);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || provider.model || 'gpt-3.5-turbo',
                messages,
                temperature: temperature ?? 0.7,
                max_tokens: max_tokens ?? 2000,
                stream: stream !== false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Proxy] API Error (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: `AI 服务返回错误 (${response.status})`,
                details: errorText
            });
        }

        // 处理流式响应
        if (stream !== false) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Content-Encoding', 'none');

            response.body.on('data', (chunk) => {
                res.write(chunk);
            });

            response.body.on('end', () => {
                res.end();
            });

            response.body.on('error', (err) => {
                console.error('[AI Proxy] Stream error:', err);
                res.end();
            });
        } else {
            const data = await response.json();
            res.json(data);
        }
    } catch (error) {
        console.error('[AI Proxy] Request failed:', error);
        res.status(500).json({ error: '内部服务器错误', details: error.message });
    }
});

/**
 * 获取模型列表代理
 * POST /api/ai/models
 */
router.post('/models', authenticateToken, async (req, res) => {
    try {
        const { baseUrl, apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key is required' });
        }

        let effectiveBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        let apiUrl = '';

        if (effectiveBaseUrl.endsWith('/models')) {
            apiUrl = effectiveBaseUrl;
        } else {
            apiUrl = `${effectiveBaseUrl}/models`;
        }

        console.log(`[AI Proxy] Incoming Models Request: Target URL: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Proxy] Models API Error (${response.status}) from ${apiUrl}:`, errorText);
            return res.status(response.status).json({
                error: `Failed to fetch models: ${response.status}`,
                details: errorText,
                apiUrl
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[AI Proxy] Models request execution failed:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
