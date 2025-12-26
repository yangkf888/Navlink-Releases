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
import { AlertDialog } from '@/shared/components/common/AlertDialog';

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
    const [installSuccessDialog, setInstallSuccessDialog] = useState(false);

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
            // 显示安装成功对话框
            setInstallSuccessDialog(true);
        } catch (err: any) {
            alert(`安装失败: ${err.message}`);
        } finally {
            setInstalling(null);
        }
    }

    // State for confirmation modal (Uninstall or Update)
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; pluginId: string; type: 'uninstall' | 'update' } | null>(null);

    // State for delete data option
    const [deleteData, setDeleteData] = useState(false);

    // Triggered by card buttons
    function requestUninstall(pluginId: string) {
        setDeleteData(false); // Reset
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
            await executeUninstall(pluginId, deleteData);
        } else if (type === 'update') {
            await executeUpdate(pluginId);
        }
    }

    async function executeUninstall(pluginId: string, deleteData: boolean = false) {
        console.log('[Debug] Executing uninstall for:', pluginId, 'Delete Data:', deleteData);
        try {
            setInstalling(pluginId);
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/plugin-market/${pluginId}${deleteData ? '?deleteData=true' : ''}`, {
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

    // ... (executeUpdate function unchanged) ...

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
            {/* Uninstall Modal - Specialized */}
            {confirmModal && confirmModal.type === 'uninstall' && (
                <UninstallDialog
                    isOpen={confirmModal.isOpen}
                    pluginId={confirmModal.pluginId}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmModal(null)}
                    deleteData={deleteData}
                    setDeleteData={setDeleteData}
                />
            )}

            {/* General Confirm Modal (For Update) */}
            {confirmModal && confirmModal.type === 'update' && (
                <ConfirmDialog
                    isOpen={confirmModal.isOpen}
                    title="确认更新插件?"
                    message={`即将更新插件 ${confirmModal.pluginId} 到最新版本。\n更新过程中插件将简短停止。`}
                    confirmText="确认更新"
                    confirmVariant="primary"
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* 插件安装成功对话框 */}
            <AlertDialog
                isOpen={installSuccessDialog}
                title="🎉 插件安装成功！"
                message={`插件已下载并解压到 plugins 目录。\n\n请按以下步骤启用插件：\n\n1. 前往「插件管理」页面\n2. 点击「扫描插件」刷新列表\n3. 找到新插件并点击「启动」\n\n⚠️ 首次启动需要下载依赖，可能需要 1-2 分钟，请耐心等待。\n📋 启动完成后，刷新页面即可使用新插件。`}
                variant="success"
                buttonText="知道了"
                onClose={() => setInstallSuccessDialog(false)}
            />
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

interface UninstallDialogProps {
    isOpen: boolean;
    pluginId: string;
    onConfirm: () => void;
    onCancel: () => void;
    deleteData: boolean;
    setDeleteData: (val: boolean) => void;
}

function UninstallDialog({ isOpen, pluginId, onConfirm, onCancel, deleteData, setDeleteData }: UninstallDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">确认卸载插件?</h3>
                    </div>
                </div>

                {/* Content */}
                <p className="text-gray-600 mb-6 pl-13">
                    即将卸载插件 {pluginId}。<br />
                    此操作将永久删除该插件的所有文件，且无法恢复。
                </p>

                {/* Checkbox */}
                <div className="mb-6 pl-13">
                    <div className="flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                        <input
                            type="checkbox"
                            id="deleteData-custom"
                            checked={deleteData}
                            onChange={(e) => setDeleteData(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                        />
                        <label htmlFor="deleteData-custom" className="text-sm text-red-700 font-medium cursor-pointer">
                            同时删除插件数据文件 (数据库/配置等)
                        </label>
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                        取消
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                    >
                        确认卸载
                    </button>
                </div>
            </div>
        </div>
    );
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
                                <span className="ml-2">安装中...</span>
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                <span className="ml-2">安装</span>
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
                                        <span className="ml-2">更新中...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpCircle size={16} />
                                        <span className="ml-2">更新</span>
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
                            <span className="ml-2">卸载</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
