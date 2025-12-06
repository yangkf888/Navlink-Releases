import React, { useState, useEffect } from 'react';
import {
    Package,
    Download,
    RefreshCw,
    Trash2,
    CheckCircle,
    AlertCircle,
    Loader,
    Search,
    Filter,
    ArrowUpCircle
} from 'lucide-react';
import { ConfirmDialog } from '@/shared/components/common/ConfirmDialog';

interface MarketPlugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    icon?: string;
    downloadUrl: string;
    homepage?: string;
    installed: boolean;
    installedVersion?: string;
    status?: string;
    updateAvailable?: boolean;
}

export default function PluginMarket() {
    const [plugins, setPlugins] = useState<MarketPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [installing, setInstalling] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        loadMarketPlugins();
    }, []);

    async function loadMarketPlugins() {
        try {
            setLoading(true);
            setError('');

            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/market/plugins', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                // Handle unauthorized silently or redirect, but for now just don't crash
                console.warn('Unauthorized fetch');
            }

            if (!response.ok) {
                throw new Error('Failed to fetch plugins');
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                setPlugins(data);
            } else {
                setPlugins([]);
                console.error('API returned non-array:', data);
            }
        } catch (err: any) {
            setError(err.message);
            setPlugins([]);
        } finally {
            setLoading(false);
        }
    }

    async function installPlugin(pluginId: string) {
        try {
            setInstalling(pluginId);

            const token = localStorage.getItem('auth_token');
            // Modified to use the new simple install endpoint
            const response = await fetch('/api/market/install', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pluginId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Installation failed');
            }

            // 刷新列表
            await loadMarketPlugins();
            alert('插件安装成功!');
        } catch (err: any) {
            alert(`安装失败: ${err.message}`);
        } finally {
            setInstalling(null);
        }
    }

    // State for confirmation modal (Uninstall or Update)
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; pluginId: string; type: 'uninstall' | 'update' } | null>(null);

    // Triggered by card buttons
    function requestUninstall(pluginId: string) {
        setConfirmModal({ isOpen: true, pluginId, type: 'uninstall' });
    }

    function requestUpdate(pluginId: string) {
        setConfirmModal({ isOpen: true, pluginId, type: 'update' });
    }

    // Triggered by modal confirm
    async function handleConfirm() {
        if (!confirmModal) return;
        const { pluginId, type } = confirmModal;
        setConfirmModal(null); // Close modal

        if (type === 'uninstall') {
            await executeUninstall(pluginId);
        } else if (type === 'update') {
            await executeUpdate(pluginId);
        }
    }

    async function executeUninstall(pluginId: string) {
        console.log('[Debug] Executing uninstall for:', pluginId);
        try {
            setInstalling(pluginId);
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/plugin-market/${pluginId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Uninstall failed');
            }

            await loadMarketPlugins();
        } catch (err: any) {
            console.error(err);
            alert(`卸载失败: ${err.message}`);
        } finally {
            setInstalling(null);
        }
    }

    async function executeUpdate(pluginId: string) {
        console.log('[Debug] Executing update for:', pluginId);
        try {
            setInstalling(pluginId);
            const token = localStorage.getItem('auth_token');
            // Assuming this is the correct endpoint based on server.js review
            const response = await fetch(`/api/plugin-market/${pluginId}/update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Update failed');
            }

            await loadMarketPlugins();
        } catch (err: any) {
            console.error(err);
            alert(`更新失败: ${err.message}`);
        } finally {
            setInstalling(null);
        }
    }

    async function refreshMarket() {
        await loadMarketPlugins();
    }

    const filteredPlugins = plugins.filter(plugin => {
        const matchesSearch = plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plugin.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const categories = ['all', ...new Set(plugins.map(p => p.category))];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">应用商城</h1>
                    <p className="text-sm text-gray-500 mt-1">发现并安装插件扩展功能</p>
                </div>
                <button
                    onClick={refreshMarket}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    刷新
                </button>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="搜索插件..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat === 'all' ? '全部分类' : cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Plugin Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlugins.map(plugin => (
                        <PluginCard
                            key={plugin.id}
                            plugin={plugin}
                            installing={installing === plugin.id}
                            onInstall={() => installPlugin(plugin.id)}
                            onUpdate={() => requestUpdate(plugin.id)}
                            onUninstall={() => requestUninstall(plugin.id)}
                        />
                    ))}
                </div>
            )}

            {filteredPlugins.length === 0 && !loading && (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">没有找到匹配的插件</p>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <ConfirmDialog
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.type === 'uninstall' ? "确认卸载插件?" : "确认更新插件?"}
                    message={confirmModal.type === 'uninstall'
                        ? `即将卸载插件 ${confirmModal.pluginId}。\n此操作将永久删除该插件的所有文件和数据，且无法恢复。`
                        : `即将更新插件 ${confirmModal.pluginId} 到最新版本。\n更新过程中插件将简短停止。`
                    }
                    confirmText={confirmModal.type === 'uninstall' ? "确认卸载" : "确认更新"}
                    confirmVariant={confirmModal.type === 'uninstall' ? "danger" : "primary"}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
        </div>
    );
}

interface PluginCardProps {
    plugin: MarketPlugin;
    installing: boolean;
    onInstall: () => void;
    onUpdate: () => void;
    onUninstall: () => void;
}

function PluginCard({ plugin, installing, onInstall, onUpdate, onUninstall }: PluginCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                        {plugin.icon || plugin.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                        <p className="text-xs text-gray-500">{plugin.author}</p>
                    </div>
                </div>
                {plugin.installed && (
                    <CheckCircle className="text-green-500" size={20} />
                )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{plugin.description}</p>

            {/* Metadata */}
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">{plugin.category}</span>
                <span>v{plugin.version}</span>
                {plugin.installed && plugin.installedVersion && (
                    <span className="text-blue-600">已安装 v{plugin.installedVersion}</span>
                )}
            </div>

            {/* Update Badge */}
            {plugin.updateAvailable && (
                <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700 text-sm">
                    <ArrowUpCircle size={16} />
                    <span>有新版本可用</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {!plugin.installed ? (
                    <button
                        onClick={onInstall}
                        disabled={installing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {installing ? (
                            <>
                                <Loader className="animate-spin" size={16} />
                                <span>安装中...</span>
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                <span>安装</span>
                            </>
                        )}
                    </button>
                ) : (
                    <>
                        {plugin.updateAvailable && (
                            <button
                                onClick={onUpdate}
                                disabled={installing}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                            >
                                {installing ? (
                                    <>
                                        <Loader className="animate-spin" size={16} />
                                        <span>更新中...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpCircle size={16} />
                                        <span>更新</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            onClick={onUninstall}
                            disabled={installing}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            <Trash2 size={16} />
                            <span>卸载</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
