/**
 * Embedding 配置组件
 */
import React, { useState, useEffect } from 'react';
import { EmbeddingConfig as EmbeddingConfigType } from '../types';
import { apiGet, apiPost } from '../utils/api';

interface Model {
    id: string;
    name: string;
}

export const EmbeddingConfig: React.FC = () => {
    const [config, setConfig] = useState<EmbeddingConfigType>({
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        apiKey: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [models, setModels] = useState<Model[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);

    const providers = [
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
        { id: 'azure', name: 'Azure OpenAI', baseUrl: '' },
        { id: 'custom', name: '自定义', baseUrl: '' },
    ];

    // 加载配置
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await apiGet<{ success: boolean; data: EmbeddingConfigType }>('config/embedding');
                if (response.success) {
                    setConfig(response.data);
                    // 如果已有配置，尝试加载模型列表
                    if (response.data.baseUrl && response.data.apiKey) {
                        fetchModels(response.data.baseUrl, response.data.apiKey);
                    }
                }
            } catch (error) {
                console.error('[kbrag] Load config error:', error);
            } finally {
                setLoading(false);
            }
        };
        loadConfig();
    }, []);

    // 获取模型列表
    const fetchModels = async (baseUrl: string, apiKey: string) => {
        if (!baseUrl || !apiKey) {
            setModels([]);
            return;
        }

        setLoadingModels(true);
        setModelsError(null);

        try {
            const response = await apiPost<{ success: boolean; data: Model[]; error?: string }>(
                'config/embedding/models',
                { baseUrl, apiKey }
            );

            if (response.success && response.data.length > 0) {
                setModels(response.data);
                // 如果当前选择的模型不在列表中，选择第一个
                if (!response.data.find(m => m.id === config.model)) {
                    setConfig(prev => ({ ...prev, model: response.data[0].id }));
                }
            } else {
                setModels([]);
                setModelsError(response.error || '未找到可用模型');
            }
        } catch (error) {
            console.error('[kbrag] Fetch models error:', error);
            setModels([]);
            setModelsError(error instanceof Error ? error.message : '获取模型失败');
        } finally {
            setLoadingModels(false);
        }
    };

    // 保存配置
    const handleSave = async () => {
        if (!config.apiKey.trim()) {
            alert('请填写 API Key');
            return;
        }
        setSaving(true);
        try {
            await apiPost('config/embedding', config);
            alert('配置已保存');
        } catch (error) {
            alert('保存失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    // 测试连接
    const handleTest = async () => {
        if (!config.apiKey.trim()) {
            alert('请先填写 API Key');
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const response = await apiPost<{ success: boolean; data?: { dimensions: number; model: string }; error?: string }>(
                'config/embedding/test',
                config
            );
            if (response.success) {
                setTestResult({
                    success: true,
                    message: `连接成功！模型: ${response.data?.model}, 维度: ${response.data?.dimensions}`,
                });
            } else {
                setTestResult({ success: false, message: response.error || '测试失败' });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setTesting(false);
        }
    };

    // 获取模型按钮点击
    const handleFetchModels = () => {
        if (!config.baseUrl || !config.apiKey) {
            alert('请先填写 API 地址和 API Key');
            return;
        }
        fetchModels(config.baseUrl, config.apiKey);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Embedding 配置</h1>
                <p className="text-gray-500 mt-1">配置用于向量化的 Embedding API</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                {/* 服务商 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">服务商</label>
                    <select
                        value={config.provider}
                        onChange={(e) => {
                            const provider = providers.find(p => p.id === e.target.value);
                            if (provider) {
                                setConfig({
                                    ...config,
                                    provider: provider.id,
                                    baseUrl: provider.baseUrl || config.baseUrl,
                                });
                                setModels([]); // 切换服务商时清空模型列表
                            }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {providers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* API 地址 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API 地址</label>
                    <input
                        type="url"
                        value={config.baseUrl}
                        onChange={(e) => {
                            setConfig({ ...config, baseUrl: e.target.value });
                            setModels([]); // 修改地址时清空模型列表
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="https://api.openai.com/v1"
                    />
                    <p className="text-xs text-gray-500 mt-1">支持 OpenAI 兼容的 API</p>
                </div>

                {/* API Key */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => {
                            setConfig({ ...config, apiKey: e.target.value });
                            setModels([]); // 修改 Key 时清空模型列表
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="sk-..."
                    />
                </div>

                {/* 模型选择 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">模型</label>
                        <button
                            onClick={handleFetchModels}
                            disabled={loadingModels || !config.baseUrl || !config.apiKey}
                            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            {loadingModels ? (
                                <><i className="fas fa-spinner fa-spin"></i> 获取中...</>
                            ) : (
                                <><i className="fas fa-sync-alt"></i> 获取模型列表</>
                            )}
                        </button>
                    </div>

                    {models.length > 0 ? (
                        <select
                            value={config.model}
                            onChange={(e) => setConfig({ ...config, model: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={config.model}
                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="text-embedding-3-small"
                            />
                            <p className="text-xs text-gray-500">
                                <i className="fas fa-info-circle mr-1"></i>
                                点击"获取模型列表"可自动加载可用模型，或手动输入模型名称
                            </p>
                        </div>
                    )}

                    {modelsError && (
                        <p className="text-xs text-red-500 mt-1">
                            <i className="fas fa-exclamation-circle mr-1"></i>
                            {modelsError}
                        </p>
                    )}
                </div>

                {/* 测试结果 */}
                {testResult && (
                    <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
                        {testResult.message}
                    </div>
                )}

                {/* 按钮 */}
                <div className="flex gap-3">
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        {testing ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i>测试中...</>
                        ) : (
                            <><i className="fas fa-plug mr-2"></i>测试连接</>
                        )}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '保存配置'}
                    </button>
                </div>
            </div>

            {/* 说明 */}
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                <h3 className="font-semibold mb-2">
                    <i className="fas fa-info-circle mr-2"></i>
                    配置说明
                </h3>
                <ul className="list-disc list-inside space-y-1">
                    <li>Embedding API 用于将文本转换为向量，实现语义搜索</li>
                    <li>输入 API 地址和 Key 后，点击"获取模型列表"可查看可用模型</li>
                    <li>推荐使用 OpenAI 的 text-embedding-3-small 模型</li>
                    <li>支持 OpenAI 兼容的 API（如 DeepSeek、阿里通义等）</li>
                </ul>
            </div>
        </div>
    );
};
