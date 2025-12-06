import React, { useState, useEffect } from 'react';
import { api } from '@/shared/services/api';
import { Play, Square, RefreshCw } from 'lucide-react';

interface Plugin {
    id: string;
    name: string;
    version: string;
    status: string;
    port?: number;
    type: string;
}

export default function PluginList() {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        loadPlugins();
    }, []);
    
    async function loadPlugins() {
        try {
            const data = await api.get('/api/plugins');
            setPlugins(data);
        } catch (error) {
            console.error('Failed to load plugins:', error);
        } finally {
            setLoading(false);
        }
    }
    
    async function startPlugin(id: string) {
        try {
            await api.post(`/api/plugins/${id}/start`);
            loadPlugins();
        } catch (error) {
            console.error('Failed to start plugin:', error);
        }
    }
    
    async function stopPlugin(id: string) {
        try {
            await api.post(`/api/plugins/${id}/stop`);
            loadPlugins();
        } catch (error) {
            console.error('Failed to stop plugin:', error);
        }
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">插件管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理所有插件的启动和停止</p>
                </div>
                <button
                    onClick={loadPlugins}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw size={16} />
                    刷新
                </button>
            </div>
            
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">加载中...</p>
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
                                <tr key={plugin.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{plugin.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{plugin.version}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{plugin.type}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                            plugin.status === 'running' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {plugin.status === 'running' ? '运行中' : '已停止'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{plugin.port || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        {plugin.status === 'running' ? (
                                            <button
                                                onClick={() => stopPlugin(plugin.id)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                            >
                                                <Square size={14} />
                                                停止
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => startPlugin(plugin.id)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                <Play size={14} />
                                                启动
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
