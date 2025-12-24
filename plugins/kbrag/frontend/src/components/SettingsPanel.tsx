/**
 * 配置弹窗组件 - 包含 Embedding 配置和分类管理
 */
import { useState, useEffect } from 'react';
import { EmbeddingConfig as EmbeddingConfigType, Category } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';

interface SettingsPanelProps {
    onClose: () => void;
}

interface Model {
    id: string;
    name: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
    const [activeSection, setActiveSection] = useState<'embedding' | 'categories'>('embedding');

    // Embedding 配置状态
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

    // 分类管理状态
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const providers = [
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
        { id: 'azure', name: 'Azure OpenAI', baseUrl: '' },
        { id: 'custom', name: '自定义', baseUrl: '' },
    ];

    // 加载 Embedding 配置
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await apiGet<{ success: boolean; data: EmbeddingConfigType }>('config/embedding');
                if (response.success) {
                    setConfig(response.data);
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

    // 加载分类
    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Category[] }>('categories');
            if (response.success) {
                setCategories(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load categories error:', error);
        } finally {
            setLoadingCategories(false);
        }
    };

    // 获取模型列表
    const fetchModels = async (baseUrl: string, apiKey: string) => {
        if (!baseUrl || !apiKey) return;
        setLoadingModels(true);
        try {
            const response = await apiPost<{ success: boolean; data: Model[] }>(
                'config/embedding/models',
                { baseUrl, apiKey }
            );
            if (response.success && response.data.length > 0) {
                setModels(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Fetch models error:', error);
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
        if (!config.apiKey.trim() || !config.model) {
            alert('请先填写 API Key 和选择模型');
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

    // 添加分类
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            alert('请输入分类名称');
            return;
        }
        try {
            const response = await apiPost<{ success: boolean; data: Category }>('categories', {
                name: newCategoryName.trim(),
                color: newCategoryColor
            });
            if (response.success) {
                setCategories([...categories, response.data]);
                setNewCategoryName('');
                setNewCategoryColor('#3B82F6');
            }
        } catch (error) {
            alert('添加失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    // 开始编辑分类
    const startEditing = (cat: Category) => {
        setEditingId(cat.id);
        setEditName(cat.name);
        setEditColor(cat.color);
    };

    // 保存编辑
    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        try {
            const response = await apiPut<{ success: boolean; data: Category }>(`categories/${editingId}`, {
                name: editName.trim(),
                color: editColor
            });
            if (response.success) {
                setCategories(categories.map(c => c.id === editingId ? response.data : c));
                setEditingId(null);
            }
        } catch (error) {
            alert('保存失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    // 取消编辑
    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
        setEditColor('');
    };

    // 删除分类
    const handleDeleteCategory = async (id: string) => {
        if (!confirm('确定要删除这个分类吗？')) return;
        try {
            await apiDelete(`categories/${id}`);
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center backdrop-blur-sm animate-fade-in p-0 md:p-4">
            <div className="bg-white w-full max-w-4xl h-screen md:h-[85vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-14 md:h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-10">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
                            <i className="fas fa-gear text-base md:text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-gray-800">知识库设置</h2>
                            <p className="text-xs text-gray-400 hidden md:block">配置 Embedding API 和分类管理</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <i className="fas fa-times text-lg md:text-xl"></i>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="hidden md:flex w-56 bg-gray-50 border-r border-gray-100 flex-col shrink-0 overflow-y-auto p-4">
                        <div className="space-y-2">
                            {[
                                { id: 'embedding', icon: 'fa-solid fa-microchip', label: 'Embedding 配置' },
                                { id: 'categories', icon: 'fa-solid fa-folder', label: '分类管理' },
                            ].map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id as 'embedding' | 'categories')}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                                        ${activeSection === section.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }
                                    `}
                                >
                                    <i className={section.icon}></i>
                                    <span>{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Tabs */}
                    <div className="md:hidden border-b border-gray-200 bg-white sticky top-0 z-10 flex w-full">
                        {[
                            { id: 'embedding', icon: 'fa-solid fa-microchip', label: 'Embedding' },
                            { id: 'categories', icon: 'fa-solid fa-folder', label: '分类' },
                        ].map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as 'embedding' | 'categories')}
                                className={`
                                    flex-1 flex flex-col items-center gap-1 px-4 py-3 transition-all
                                    ${activeSection === section.id
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-500'
                                    }
                                `}
                            >
                                <i className={`${section.icon} text-lg`}></i>
                                <span className="text-xs font-medium">{section.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        {/* Embedding 配置 */}
                        {activeSection === 'embedding' && (
                            <div className="space-y-6 max-w-xl">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <>
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
                                                        setModels([]);
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
                                                    setModels([]);
                                                }}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="https://api.openai.com/v1"
                                            />
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
                                                    setModels([]);
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
                                                    onClick={() => fetchModels(config.baseUrl, config.apiKey)}
                                                    disabled={loadingModels || !config.baseUrl || !config.apiKey}
                                                    className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    <i className={`fas ${loadingModels ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                                                    获取模型
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
                                                <input
                                                    type="text"
                                                    value={config.model}
                                                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    placeholder="text-embedding-3-small"
                                                />
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
                                                {testing ? '测试中...' : '测试连接'}
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {saving ? '保存中...' : '保存配置'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 分类管理 */}
                        {activeSection === 'categories' && (
                            <div className="space-y-6 max-w-xl">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">分类管理</h3>
                                    <p className="text-sm text-gray-500">创建和管理知识分类，便于组织内容</p>
                                </div>

                                {/* 添加分类 */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">添加新分类</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={newCategoryColor}
                                            onChange={(e) => setNewCategoryColor(e.target.value)}
                                            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="输入分类名称"
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                        />
                                        <button
                                            onClick={handleAddCategory}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                        >
                                            <i className="fas fa-plus"></i>
                                            添加
                                        </button>
                                    </div>
                                </div>

                                {/* 分类列表 */}
                                <div className="space-y-2">
                                    {loadingCategories ? (
                                        <div className="flex justify-center py-8">
                                            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : categories.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <i className="fas fa-folder-open text-4xl mb-2 opacity-50"></i>
                                            <p>暂无分类，请添加</p>
                                        </div>
                                    ) : (
                                        categories.map(cat => (
                                            <div key={cat.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                                {editingId === cat.id ? (
                                                    <>
                                                        <input
                                                            type="color"
                                                            value={editColor}
                                                            onChange={(e) => setEditColor(e.target.value)}
                                                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveEdit();
                                                                if (e.key === 'Escape') cancelEditing();
                                                            }}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="text-green-600 hover:text-green-700 p-2"
                                                            title="保存"
                                                        >
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                        <button
                                                            onClick={cancelEditing}
                                                            className="text-gray-500 hover:text-gray-700 p-2"
                                                            title="取消"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div
                                                            className="w-6 h-6 rounded"
                                                            style={{ backgroundColor: cat.color }}
                                                        ></div>
                                                        <span className="flex-1 font-medium text-gray-800">{cat.name}</span>
                                                        <button
                                                            onClick={() => startEditing(cat)}
                                                            className="text-blue-500 hover:text-blue-700 transition-colors p-2"
                                                            title="编辑分类"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCategory(cat.id)}
                                                            className="text-red-500 hover:text-red-700 transition-colors p-2"
                                                            title="删除分类"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
