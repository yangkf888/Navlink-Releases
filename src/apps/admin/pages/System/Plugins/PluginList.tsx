import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, RefreshCw, Search as SearchIcon, AlertCircle, Loader, ExternalLink } from 'lucide-react';

interface Plugin {
    id: string;
    name: string;
    version: string;
    status: string;
    port?: number;
    type: string;
}

export default function PluginList() {
    const navigate = useNavigate();
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadPlugins();
    }, []);

    async function loadPlugins() {
        try {
            setLoading(true);
            setError('');

            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/plugins', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('获取插件列表失败');
            }

            const data = await response.json();
            setPlugins(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function scanPlugins() {
        try {
            setScanning(true);
            setError('');
            setSuccess('');

            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/plugins/rescan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('扫描插件失败');
            }

            setSuccess('扫描完成!已发现所有本地插件');

            // 重新加载插件列表
            await loadPlugins();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setScanning(false);
        }
    }

    async function startPlugin(id: string) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/plugins/${id}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('启动插件失败');
            }

            setSuccess(`插件 ${id} 已启动`);
            await loadPlugins();
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function stopPlugin(id: string) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/plugins/${id}/stop`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('停止插件失败');
            }

            setSuccess(`插件 ${id} 已停止`);
            await loadPlugins();
        } catch (err: any) {
            setError(err.message);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">插件管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理本地已安装的插件</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={scanPlugins}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        {scanning ? (
                            <>
                                <Loader className="animate-spin" size={16} />
                                <span>扫描中...</span>
                            </>
                        ) : (
                            <>
                                <SearchIcon size={16} />
                                <span>扫描插件</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={loadPlugins}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        刷新
                    </button>
                </div>
            </div>

            {/* Success Message */}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{success}</span>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Plugin Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <Loader className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-500">加载中...</p>
                </div>
            ) : plugins.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">没有发现任何插件</p>
                    <button
                        onClick={scanPlugins}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        扫描插件目录
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">插件名称</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">端口</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {plugins.map(plugin => (
                                <tr key={plugin.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                                                {plugin.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{plugin.name}</div>
                                                <div className="text-xs text-gray-500">{plugin.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{plugin.version}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${plugin.type === 'node' ? 'bg-green-100 text-green-800' :
                                            plugin.type === 'docker' ? 'bg-blue-100 text-blue-800' :
                                                plugin.type === 'python' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {plugin.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${plugin.status === 'running' ? 'bg-green-100 text-green-800' :
                                            plugin.status === 'starting' ? 'bg-yellow-100 text-yellow-800' :
                                                plugin.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${plugin.status === 'running' ? 'bg-green-500' :
                                                plugin.status === 'starting' ? 'bg-yellow-500 animate-pulse' :
                                                    plugin.status === 'failed' ? 'bg-red-500' :
                                                        'bg-gray-500'
                                                }`}></span>
                                            {
                                                plugin.status === 'running' ? '运行中' :
                                                    plugin.status === 'starting' ? '启动中' :
                                                        plugin.status === 'failed' ? '失败' :
                                                            '已停止'
                                            }
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {plugin.port ? (
                                            <span className="text-blue-600 font-mono">{plugin.port}</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <div className="flex justify-end gap-2">
                                            {plugin.status === 'running' ? (
                                                <>
                                                    <button
                                                        onClick={() => window.open(`/apps/${plugin.id}/`, '_blank')}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                        打开
                                                    </button>

                                                    <button
                                                        onClick={() => stopPlugin(plugin.id)}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                                    >
                                                        <Square size={14} />
                                                        停止
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => startPlugin(plugin.id)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                                >
                                                    <Play size={14} />
                                                    启动
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Table Footer */}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                            共 <span className="font-medium text-gray-900">{plugins.length}</span> 个插件
                            <span className="ml-4">运行中: <span className="font-medium text-green-600">{plugins.filter(p => p.status === 'running').length}</span></span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
