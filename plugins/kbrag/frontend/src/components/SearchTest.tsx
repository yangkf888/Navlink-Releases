/**
 * 检索测试组件
 */
import React, { useState } from 'react';
import { SearchResult, KnowledgeItem } from '../types';
import { apiPost, apiGet } from '../utils/api';

interface SearchTestProps {
    onViewItem: (item: KnowledgeItem) => void;
}

export const SearchTest: React.FC<SearchTestProps> = ({ onViewItem }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState<'keyword' | 'semantic'>('semantic');
    const [searchMethod, setSearchMethod] = useState<string>('');

    // 执行搜索
    const handleSearch = async () => {
        if (!query.trim()) {
            alert('请输入搜索内容');
            return;
        }
        setLoading(true);
        setResults([]);
        try {
            if (method === 'keyword') {
                const response = await apiGet<{ success: boolean; data: SearchResult[] }>(
                    `search?q=${encodeURIComponent(query)}&limit=10`
                );
                if (response.success) {
                    setResults(response.data);
                    setSearchMethod('keyword');
                }
            } else {
                const response = await apiPost<{ success: boolean; data: SearchResult[]; method: string }>(
                    'search/semantic',
                    { query, limit: 10 }
                );
                if (response.success) {
                    setResults(response.data);
                    setSearchMethod(response.method);
                }
            }
        } catch (error) {
            alert('搜索失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    // 测试 RAG 接口
    const handleRAGTest = async () => {
        if (!query.trim()) {
            alert('请输入问题');
            return;
        }
        setLoading(true);
        try {
            const response = await apiPost<{
                success: boolean;
                data: { context: string; sources: Array<{ id: string; title: string; url?: string; score?: number }>; count: number; method: string };
            }>('search/rag', { query, limit: 3 });
            if (response.success) {
                alert(
                    `RAG 检索结果 (${response.data.method}):\n\n` +
                    `找到 ${response.data.count} 条相关知识\n\n` +
                    `来源:\n${response.data.sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}\n\n` +
                    `上下文预览 (前 500 字):\n${response.data.context.substring(0, 500)}...`
                );
            }
        } catch (error) {
            alert('RAG 测试失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">知识检索</h1>
                <p className="text-gray-500 mt-1">检索知识库内容</p>
            </div>

            {/* 搜索表单 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                            placeholder="输入搜索内容或问题..."
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">搜索方式:</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value as 'keyword' | 'semantic')}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="semantic">语义搜索</option>
                            <option value="keyword">关键词搜索</option>
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i>搜索中...</>
                        ) : (
                            <><i className="fas fa-search mr-2"></i>搜索</>
                        )}
                    </button>
                    <button
                        onClick={handleRAGTest}
                        disabled={loading}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        <i className="fas fa-robot mr-2"></i>RAG 测试
                    </button>
                </div>
            </div>

            {/* 搜索结果 */}
            {results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                            搜索结果 ({results.length})
                        </h2>
                        <span className="text-sm text-gray-500">
                            使用方法: {searchMethod === 'semantic' ? '语义搜索' : searchMethod === 'keyword_fallback' ? '关键词降级' : '关键词搜索'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {results.map((result, index) => (
                            <div
                                key={result.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => onViewItem(result)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-sm">#{index + 1}</span>
                                            <h3 className="font-medium text-gray-900">{result.title}</h3>
                                            {result.score !== undefined && result.score > 0 && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                    相似度: {(result.score * 100).toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                        {result.snippet && (
                                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{result.snippet}</p>
                                        )}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {result.tags.map((tag, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <button className="p-2 text-gray-400 hover:text-blue-600">
                                        <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 无结果 */}
            {results.length === 0 && query && !loading && (
                <div className="bg-white rounded-xl p-12 text-center">
                    <i className="fas fa-search text-gray-300 text-5xl mb-4"></i>
                    <p className="text-gray-500">未找到相关内容</p>
                </div>
            )}

            {/* 使用说明 */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                <h3 className="font-semibold mb-2">
                    <i className="fas fa-lightbulb mr-2"></i>
                    使用提示
                </h3>
                <ul className="list-disc list-inside space-y-1">
                    <li><strong>语义搜索</strong>: 理解语义，找到相关内容（需要配置 Embedding API 并向量化内容）</li>
                    <li><strong>关键词搜索</strong>: 精确匹配关键词</li>
                    <li><strong>RAG 测试</strong>: 模拟 AI 对话时的知识检索，返回可注入 AI 上下文的内容</li>
                </ul>
            </div>
        </div>
    );
};
