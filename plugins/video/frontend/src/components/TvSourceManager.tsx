import { useState, useEffect } from 'react';
import { TvSource } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';

interface TvSourceManagerProps {
    onSourcesChange?: () => void;
}

type StatusFilter = 'all' | 'enabled' | 'disabled';

export function TvSourceManager({ onSourcesChange }: TvSourceManagerProps) {
    const [sources, setSources] = useState<TvSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 筛选和搜索
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // 选择状态
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // 表单状态
    const [showForm, setShowForm] = useState(false);
    const [editingSource, setEditingSource] = useState<TvSource | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        type: 'm3u' as 'm3u' | 'json',
        enabled: 1,
        sort_order: 0
    });

    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        setLoading(true);
        try {
            const res = await apiGet<TvSource[]>('/tv/sources');
            if (res.success && res.data) {
                setSources(res.data);
            }
        } catch (error) {
            console.error('Failed to load TV sources:', error);
        } finally {
            setLoading(false);
        }
    };

    // 筛选后的数据
    const filteredSources = sources.filter(source => {
        // 搜索过滤
        if (searchKeyword && !source.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
            return false;
        }
        // 状态过滤
        if (statusFilter === 'enabled' && !source.enabled) return false;
        if (statusFilter === 'disabled' && source.enabled) return false;
        return true;
    });

    // 全选/取消全选
    const handleSelectAll = () => {
        if (selectedIds.length === filteredSources.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredSources.map(s => s.id));
        }
    };

    // 单个选择
    const handleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    // 添加源
    const handleAdd = () => {
        setEditingSource(null);
        setFormData({ name: '', url: '', type: 'm3u', enabled: 1, sort_order: sources.length + 1 });
        setShowForm(true);
    };

    // 编辑源
    const handleEdit = (source: TvSource) => {
        setEditingSource(source);
        setFormData({
            name: source.name,
            url: source.url,
            type: source.type,
            enabled: source.enabled,
            sort_order: source.sort_order
        });
        setShowForm(true);
    };

    // 保存
    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingSource) {
                await apiPut(`/tv/sources/${editingSource.id}`, formData);
            } else {
                await apiPost('/tv/sources', formData);
            }
            await loadSources();
            setShowForm(false);
            onSourcesChange?.();
        } catch (error) {
            alert('保存失败');
        }
        setSaving(false);
    };

    // 删除
    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`确定要删除电视源"${name}"吗？`)) return;
        await apiDelete(`/tv/sources/${id}`);
        setSources(prev => prev.filter(s => s.id !== id));
        onSourcesChange?.();
    };

    // 切换启用状态
    const handleToggleEnabled = async (source: TvSource) => {
        await apiPut(`/tv/sources/${source.id}`, { enabled: source.enabled ? 0 : 1 });
        setSources(prev => prev.map(s =>
            s.id === source.id ? { ...s, enabled: s.enabled ? 0 : 1 } : s
        ));
        onSourcesChange?.();
    };

    // 刷新缓存
    const handleRefresh = async (id: number) => {
        try {
            await apiGet(`/tv/playlist/${id}?refresh=true`);
            alert('刷新成功');
        } catch (error) {
            console.error('Failed to refresh source:', error);
            alert('刷新失败');
        }
    };

    // 批量操作
    const handleBatchUpdate = async (updates: { enabled?: number }) => {
        if (selectedIds.length === 0) {
            alert('请先选择要操作的电视源');
            return;
        }
        await apiPost('/tv/sources/batch-update', { ids: selectedIds, updates });
        await loadSources();
        setSelectedIds([]);
        onSourcesChange?.();
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) {
            alert('请先选择要删除的电视源');
            return;
        }
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 个电视源吗？`)) return;
        await apiPost('/tv/sources/batch-delete', { ids: selectedIds });
        await loadSources();
        setSelectedIds([]);
        onSourcesChange?.();
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-800 rounded w-full"></div>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-800 rounded"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 工具栏 */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* 搜索 */}
                <div className="relative flex-1 min-w-[200px]">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input
                        type="text"
                        placeholder="搜索站点名称..."
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 
                                 focus:border-red-500 focus:outline-none"
                    />
                </div>

                {/* 状态筛选 */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 
                             focus:border-red-500 focus:outline-none"
                >
                    <option value="all">全部状态</option>
                    <option value="enabled">已启用</option>
                    <option value="disabled">已禁用</option>
                </select>

                {/* 操作按钮 */}
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 
                             transition-colors flex items-center gap-2"
                >
                    <i className="fas fa-plus"></i>
                    添加
                </button>
            </div>

            {/* 批量操作栏 */}
            {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-gray-400">已选择 {selectedIds.length} 项</span>
                    <button
                        onClick={() => handleBatchUpdate({ enabled: 1 })}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 text-sm"
                    >
                        批量启用
                    </button>
                    <button
                        onClick={() => handleBatchUpdate({ enabled: 0 })}
                        className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-500 text-sm"
                    >
                        批量禁用
                    </button>
                    <button
                        onClick={handleBatchDelete}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 text-sm"
                    >
                        批量删除
                    </button>
                </div>
            )}

            {/* 表格 */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                            <th className="p-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === filteredSources.length && filteredSources.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded"
                                />
                            </th>
                            <th className="p-3">站点名称</th>
                            <th className="p-3 w-20">状态</th>
                            <th className="p-3">接口地址</th>
                            <th className="p-3 w-24">类型</th>
                            <th className="p-3 w-20">排序</th>
                            <th className="p-3 w-48">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSources.map(source => (
                            <tr
                                key={source.id}
                                className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors
                                          ${!source.enabled ? 'opacity-50' : ''}`}
                            >
                                <td className="p-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(source.id)}
                                        onChange={() => handleSelect(source.id)}
                                        className="rounded"
                                    />
                                </td>
                                <td className="p-3">
                                    <span className="text-white font-medium">{source.name}</span>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${source.enabled
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {source.enabled ? '启用' : '禁用'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className="text-gray-400 text-xs truncate block max-w-xs" title={source.url}>
                                        {source.url}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${source.type === 'm3u' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {source.type.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-3 text-gray-400">{source.sort_order}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleRefresh(source.id)}
                                            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                                            title="刷新缓存"
                                        >
                                            <i className="fas fa-sync-alt"></i>
                                        </button>
                                        <button
                                            onClick={() => handleToggleEnabled(source)}
                                            className={`p-1.5 transition-colors ${source.enabled ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'
                                                }`}
                                            title={source.enabled ? '禁用' : '启用'}
                                        >
                                            <i className={`fas fa-${source.enabled ? 'toggle-on' : 'toggle-off'}`}></i>
                                        </button>
                                        <button
                                            onClick={() => handleEdit(source)}
                                            className="p-1.5 text-gray-400 hover:text-white transition-colors"
                                            title="编辑"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(source.id, source.name)}
                                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                                            title="删除"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {
                filteredSources.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <i className="fas fa-database text-4xl mb-4 opacity-50"></i>
                        <p>暂无电视源</p>
                    </div>
                )
            }

            {/* 表单弹窗 */}
            {
                showForm && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
                            <h2 className="text-xl font-bold text-white mb-4">
                                {editingSource ? '编辑电视源' : '添加电视源'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-300 mb-2">名称 *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="如：IPTV直播源"
                                        className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg 
                                             border border-gray-700 focus:border-red-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-300 mb-2">地址 *</label>
                                    <input
                                        type="url"
                                        value={formData.url}
                                        onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                                        placeholder="如：https://example.com/live.m3u"
                                        className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg 
                                             border border-gray-700 focus:border-red-500 focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-300 mb-2">类型</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'm3u' | 'json' }))}
                                            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg 
                                                 border border-gray-700 focus:border-red-500 focus:outline-none"
                                        >
                                            <option value="m3u">M3U</option>
                                            <option value="json">JSON</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-gray-300 mb-2">排序</label>
                                        <input
                                            type="number"
                                            value={formData.sort_order}
                                            onChange={e => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg 
                                                 border border-gray-700 focus:border-red-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.enabled === 1}
                                            onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked ? 1 : 0 }))}
                                            className="rounded"
                                        />
                                        启用
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg 
                                         hover:bg-gray-700 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formData.name || !formData.url}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg 
                                         hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
