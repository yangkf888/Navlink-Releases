import React, { useState, useEffect } from 'react';
import { NetdiskSource } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { DirectoryPicker } from './DirectoryPicker';

interface NetdiskSourceManagerProps {
    onSourceChange?: () => void;
}

export function NetdiskSourceManager({ onSourceChange }: NetdiskSourceManagerProps) {
    const [sources, setSources] = useState<NetdiskSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [scanningStatuses, setScanningStatuses] = useState<Record<number, any>>({});

    // 目录选择器状态
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerSourceId, setPickerSourceId] = useState<number | null>(null);
    const [pickerMode, setPickerMode] = useState<'add' | 'edit'>('add');
    const [pickerEditIndex, setPickerEditIndex] = useState<number>(-1);

    // 筛选和搜索
    const [searchKeyword, setSearchKeyword] = useState('');

    // 选择状态
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // 表单状态
    const [showForm, setShowForm] = useState(false);
    const [editingSource, setEditingSource] = useState<NetdiskSource | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'alist',
        url: '',
        username: 'admin',
        password: '',
        root_path: '/',
        enabled: true,
        proxy_enabled: false,
        hidden: false,
        remark: ''
    });

    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        setLoading(true);
        try {
            const res = await apiGet<NetdiskSource[]>('/netdisk/sources');
            if (res.success && res.data) {
                setSources(res.data);
            }
        } catch (error) {
            console.error('Failed to load netdisk sources:', error);
        } finally {
            setLoading(false);
        }
    };

    // 扫描状态轮询
    useEffect(() => {
        const interval = setInterval(() => {
            sources.forEach(source => {
                if (source.enabled) {
                    apiGet<any>(`/netdisk/scan/${source.id}/status`).then(res => {
                        if (res.success && res.data) {
                            setScanningStatuses(prev => ({
                                ...prev,
                                [source.id]: res.data
                            }));
                        }
                    });
                }
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [sources]);

    const handleAdd = () => {
        setEditingSource(null);
        setFormData({
            name: '',
            type: 'alist',
            url: '',
            username: 'admin',
            password: '',
            root_path: '/',
            enabled: true,
            proxy_enabled: false,
            hidden: false,
            remark: ''
        });
        setShowForm(true);
    };

    const handleEdit = (source: NetdiskSource) => {
        setEditingSource(source);
        setFormData({
            name: source.name,
            type: source.type || 'alist',
            url: source.url,
            username: source.username || 'admin',
            password: '',
            root_path: source.root_path,
            enabled: !!source.enabled,
            proxy_enabled: !!source.proxy_enabled,
            hidden: !!source.hidden,
            remark: source.remark || ''
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 在这个精简后的版本中，handleSave 不再处理 scan_paths，
            // 除非是初次创建且有默认值，或者我们保持现有逻辑不覆盖它。
            // 由于 scan_paths 已经在表格的子行中管理，这里我们只需要保证不误删它即可。

            const payload: any = {
                ...formData
            };

            // 修复：编辑模式下，如果密码为空，则不发送该字段以实现“留空保持不变”
            if (editingSource && !payload.password) {
                delete payload.password;
            }

            if (editingSource) {
                await apiPut(`/netdisk/sources/${editingSource.id}`, payload);
            } else {
                await apiPost('/netdisk/sources', payload);
            }

            setShowForm(false);
            loadSources();
            onSourceChange?.();
        } catch (error) {
            console.error('Failed to save source:', error);
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    // 校验必填项
    const isFormValid = () => {
        if (!formData.name) return false;
        if (formData.type === 'local') {
            return !!formData.root_path;
        } else {
            return !!formData.url;
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`确定要删除网盘源"${name}"吗？`)) return;

        try {
            await apiDelete(`/netdisk/sources/${id}`);
            loadSources();
            onSourceChange?.();
        } catch (error) {
            console.error('Failed to delete source:', error);
        }
    };

    const handleTest = async (source: NetdiskSource) => {
        try {
            const res = await apiPost<{ connected: boolean; itemCount?: number; error?: string }>(`/netdisk/sources/${source.id}/test`);
            if (res.success && res.data) {
                if (res.data.connected) {
                    alert(`连接成功！共 ${res.data.itemCount || 0} 个项目`);
                } else {
                    alert(`连接失败：${res.data.error || '未知错误'}`);
                }
            }
        } catch (error) {
            alert('测试失败');
        }
    };

    const handleToggleEnabled = async (source: NetdiskSource) => {
        try {
            await apiPut(`/netdisk/sources/${source.id}`, {
                enabled: !source.enabled
            });
            loadSources();
            onSourceChange?.();
        } catch (error) {
            console.error('Failed to toggle source:', error);
        }
    };

    // 批量操作
    const handleSelectAll = () => {
        if (selectedIds.length === filteredSources.length && filteredSources.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredSources.map(s => s.id));
        }
    };

    const handleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 个网盘源吗？`)) return;

        try {
            // 这里通常后端支持批量删除，如果不支持则循环。本项目后端目前需循环。
            await Promise.all(selectedIds.map(id => apiDelete(`/netdisk/sources/${id}`)));
            setSelectedIds([]);
            loadSources();
            onSourceChange?.();
        } catch (error) {
            console.error('Batch delete failed:', error);
        }
    };

    const handleBatchStatus = async (enabled: boolean) => {
        if (selectedIds.length === 0) return;
        try {
            await Promise.all(selectedIds.map(id => apiPut(`/netdisk/sources/${id}`, { enabled: enabled ? 1 : 0 })));
            setSelectedIds([]);
            loadSources();
            onSourceChange?.();
        } catch (error) {
            console.error('Batch status update failed:', error);
        }
    };

    const handleToggleExpand = (id: number) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleScan = async (sourceId: number, path?: string) => {
        try {
            const res = await apiPost(`/netdisk/scan`, { sourceId, path });
            if (res.success) {
                alert(path ? `正在扫描目录: ${path}` : '正在全量扫描...');
            }
        } catch (error) {
            alert('扫描启动失败');
        }
    };

    const handleClearIndex = async (sourceId: number, path?: string) => {
        if (!confirm(path ? `确定要清除目录 "${path}" 的媒体索引吗？` : '确定要清除该网盘的所有媒体索引吗？')) return;
        try {
            const res = await apiPost(`/netdisk/clear-index`, { sourceId, path });
            if (res.success) {
                alert('清理成功');
                onSourceChange?.();
            }
        } catch (error) {
            alert('清理失败');
        }
    };

    const handleUpdateScanPaths = async (source: NetdiskSource, newPaths: any[]) => {
        try {
            await apiPut(`/netdisk/sources/${source.id}`, {
                scan_paths: JSON.stringify(newPaths)
            });
            loadSources();
        } catch (error) {
            alert('更新失败');
        }
    };

    const filteredSources = sources.filter(source =>
        source.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        source.url.toLowerCase().includes(searchKeyword.toLowerCase())
    );

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
                <div className="relative flex-1 min-w-[200px]">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input
                        type="text"
                        placeholder="搜索网盘源名称..."
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 
                                 focus:border-red-500 focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <>
                            <button
                                onClick={() => handleBatchStatus(true)}
                                className="px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors text-sm"
                            >
                                启用选中
                            </button>
                            <button
                                onClick={() => handleBatchStatus(false)}
                                className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                            >
                                禁用选中
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
                            >
                                删除选中
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 transition-colors flex items-center gap-2 text-sm"
                    >
                        <i className="fas fa-plus"></i>
                        添加网盘源
                    </button>
                </div>
            </div>

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
                                    className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                />
                            </th>
                            <th className="p-3 w-10"></th>
                            <th className="p-3">名称</th>
                            <th className="p-3 w-20">状态</th>
                            <th className="p-3 w-20">代理</th>
                            <th className="p-3 w-20">隐藏</th>
                            <th className="p-3">存储类型</th>
                            <th className="p-3">地址/根目录</th>
                            <th className="p-3">备注</th>
                            <th className="p-3 w-40">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSources.map(source => (
                            <React.Fragment key={source.id}>
                                <tr
                                    className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors
                                          ${!source.enabled ? 'opacity-50' : ''}
                                          ${selectedIds.includes(source.id) ? 'bg-blue-600/10' : ''}`}
                                >
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(source.id)}
                                            onChange={() => handleSelect(source.id)}
                                            className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => handleToggleExpand(source.id)}
                                            className={`p-1 text-gray-400 hover:text-white transition-transform ${expandedIds.includes(source.id) ? 'rotate-90' : ''}`}
                                        >
                                            <i className="fas fa-chevron-right text-xs"></i>
                                        </button>
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
                                        {source.type !== 'local' ? (
                                            <span className={`px-2 py-1 rounded text-xs ${source.proxy_enabled
                                                ? 'bg-purple-500/20 text-purple-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {source.proxy_enabled ? '开启' : '关闭'}
                                            </span>
                                        ) : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${source.hidden
                                            ? 'bg-orange-500/20 text-orange-400'
                                            : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {source.hidden ? '是' : '否'}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                                            {source.type === 'alist' ? 'Alist' : (source.type === 'webdav' ? 'WebDAV' : '本地目录')}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className="text-gray-400 text-xs truncate block max-w-xs" title={source.type === 'local' ? source.root_path : source.url}>
                                            {source.type === 'local' ? source.root_path : source.url}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className="text-gray-500 text-xs">{source.remark || '-'}</span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleScan(source.id)}
                                                className="p-1.5 text-gray-400 hover:text-green-400 transition-colors"
                                                title="立即全量扫描"
                                            >
                                                <i className="fas fa-sync-alt"></i>
                                            </button>
                                            <button
                                                onClick={() => handleTest(source)}
                                                className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                                                title="测试连接"
                                            >
                                                <i className="fas fa-plug"></i>
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
                                {
                                    expandedIds.includes(source.id) && (
                                        <tr className="bg-gray-800/30 border-b border-gray-800">
                                            <td colSpan={10} className="p-4">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                            扫描目录管理
                                                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-[10px] lowercase normal-case flex items-center gap-1">
                                                                <i className="fas fa-info-circle"></i> 建议按分类添加目录
                                                            </span>
                                                        </h4>
                                                        <button
                                                            onClick={() => {
                                                                setPickerSourceId(source.id);
                                                                setPickerMode('add');
                                                                setPickerOpen(true);
                                                            }}
                                                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-md transition-all hover:bg-blue-500/20"
                                                        >
                                                            <i className="fas fa-folder-open"></i> 浏览并添加目录
                                                        </button>
                                                    </div>

                                                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-[11px] text-blue-300/80 leading-relaxed shadow-inner">
                                                        <div className="font-bold mb-1 flex items-center gap-1 text-blue-400">
                                                            <i className="fas fa-lightbulb"></i> 使用小贴士：
                                                        </div>
                                                        <ul className="list-disc list-inside space-y-0.5 opacity-80">
                                                            <li>添加新目录后系统将<b>自动启动全量扫描</b>。</li>
                                                            <li>勾选“隐藏”属性后，访客（未登录用户）在手机/网页端将无法看到该目录下的资源。</li>
                                                            <li>如果目录中包含 NFO 文件，系统将优先从本地读取元数据（海报、简介等）。</li>
                                                        </ul>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {/* 表头 */}
                                                        {(Array.isArray(source.scan_paths) ? source.scan_paths : []).length > 0 && (
                                                            <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                                <div className="w-[calc(33.333%-10px)] ml-1">媒体库名称</div>
                                                                <div className="flex-1">媒体库路径</div>
                                                                <div className="w-[200px] text-right pr-12">操作</div>
                                                            </div>
                                                        )}
                                                        {(Array.isArray(source.scan_paths) ? source.scan_paths : []).map((pathObj: any, idx: number) => (
                                                            <div key={idx} className="flex flex-wrap items-center gap-2 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                                                                <div className="flex-1 flex items-center gap-2 min-w-[300px]">
                                                                    <input
                                                                        type="text"
                                                                        value={pathObj.name}
                                                                        onChange={(e) => {
                                                                            const next = [...(source.scan_paths as any[])];
                                                                            next[idx] = { ...next[idx], name: e.target.value };
                                                                            handleUpdateScanPaths(source, next);
                                                                        }}
                                                                        placeholder="媒体库名称 (如: 电影、剧集)"
                                                                        className="w-1/3 px-2 py-1.5 bg-gray-800 text-white border border-gray-700 rounded text-xs focus:border-blue-500 outline-none hover:border-gray-600 transition-colors"
                                                                        title="显示在前端侧边栏的名称"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={pathObj.path}
                                                                        onChange={(e) => {
                                                                            const next = [...(source.scan_paths as any[])];
                                                                            next[idx] = { ...next[idx], path: e.target.value };
                                                                            handleUpdateScanPaths(source, next);
                                                                        }}
                                                                        placeholder="媒体库路径 (网盘中的目录路径)"
                                                                        className="flex-1 px-2 py-1.5 bg-gray-800 text-white border border-gray-700 rounded text-xs focus:border-blue-500 outline-none hover:border-gray-600 transition-colors"
                                                                        title="网盘中实际存放媒体的目录路径"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            setPickerSourceId(source.id);
                                                                            setPickerMode('edit');
                                                                            setPickerEditIndex(idx);
                                                                            setPickerOpen(true);
                                                                        }}
                                                                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
                                                                        title="浏览选择"
                                                                    >
                                                                        <i className="fas fa-folder-open"></i>
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 cursor-pointer hover:bg-gray-700 transition-colors" title="启用后，若缺少本地 NFO 或封面，将通过 TMDB 补全数据">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={pathObj.tmdb_enabled !== false}
                                                                            onChange={(e) => {
                                                                                const next = [...(source.scan_paths as any[])];
                                                                                next[idx] = { ...next[idx], tmdb_enabled: e.target.checked };
                                                                                handleUpdateScanPaths(source, next);
                                                                            }}
                                                                            className="w-3 h-3 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                                                                        />
                                                                        TMDB
                                                                    </label>
                                                                    <label className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 cursor-pointer hover:bg-gray-700 transition-colors">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!pathObj.hidden}
                                                                            onChange={(e) => {
                                                                                const next = [...(source.scan_paths as any[])];
                                                                                next[idx] = { ...next[idx], hidden: e.target.checked };
                                                                                handleUpdateScanPaths(source, next);
                                                                            }}
                                                                            className="w-3 h-3 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                                                                        />
                                                                        隐藏
                                                                    </label>
                                                                    <button
                                                                        onClick={() => handleScan(source.id, pathObj.path)}
                                                                        className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${scanningStatuses[source.id]?.paths?.[pathObj.path]?.scanning
                                                                            ? 'bg-blue-600 text-white animate-pulse'
                                                                            : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                                                            }`}
                                                                    >
                                                                        <i className={`fas ${scanningStatuses[source.id]?.paths?.[pathObj.path]?.scanning ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                                                                        {scanningStatuses[source.id]?.paths?.[pathObj.path]?.scanning ? '正在扫描' : '扫描'}
                                                                    </button>
                                                                    {scanningStatuses[source.id]?.paths?.[pathObj.path]?.scanning && (
                                                                        <span className="text-[10px] text-blue-400 animate-pulse">
                                                                            {scanningStatuses[source.id]?.paths?.[pathObj.path]?.message}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleClearIndex(source.id, pathObj.path)}
                                                                        className="px-2 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 text-xs transition-colors"
                                                                    >
                                                                        <i className="fas fa-eraser mr-1"></i> 清理索引
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            const next = (source.scan_paths as any[]).filter((_, i) => i !== idx);
                                                                            handleUpdateScanPaths(source, next);
                                                                        }}
                                                                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                                                        title="删除目录"
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(Array.isArray(source.scan_paths) ? source.scan_paths : []).length === 0 && (
                                                            <div className="text-center py-4 text-gray-600 italic text-xs">
                                                                未配置扫描目录，将扫描全量资源
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="pt-2 border-t border-gray-700/50 flex gap-4">
                                                        <button
                                                            onClick={() => handleClearIndex(source.id)}
                                                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                                                        >
                                                            <i className="fas fa-trash-alt"></i> 清空全部索引
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {
                filteredSources.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <i className="fas fa-cloud text-4xl mb-4 opacity-50"></i>
                        <p>暂无网盘源</p>
                    </div>
                )
            }

            {/* 表单弹窗 */}
            {
                showForm && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
                        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl border border-gray-800">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                {editingSource ? <i className="fas fa-edit text-blue-500"></i> : <i className="fas fa-plus-circle text-blue-500"></i>}
                                {editingSource ? '编辑网盘源' : '添加网盘源'}
                            </h2>

                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">名称 *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="我的网盘"
                                            className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                 border border-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">存储类型 *</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => {
                                                const newType = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    type: newType,
                                                    // WebDAV 默认开启代理以解决认证和播放问题
                                                    proxy_enabled: newType === 'webdav' ? true : (newType === 'local' ? false : prev.proxy_enabled)
                                                }));
                                            }}
                                            className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                 border border-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                                        >
                                            <option value="alist">Alist / OpenList</option>
                                            <option value="webdav">WebDAV</option>
                                            <option value="local">本地目录</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.type !== 'local' && (
                                    <>
                                        <div>
                                            <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">地址 *</label>
                                            <input
                                                type="url"
                                                value={formData.url}
                                                onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                                                placeholder="http://192.168.1.100:5244"
                                                className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                     border border-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">用户名 (可选)</label>
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                                    placeholder="admin"
                                                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                         border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">密码 (可选)</label>
                                                <input
                                                    type="password"
                                                    value={formData.password}
                                                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                                    placeholder={editingSource ? '留空保持不变' : '密码'}
                                                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                         border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {formData.type === 'local' && (
                                    <div>
                                        <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">本地根路径 *</label>
                                        <input
                                            type="text"
                                            value={formData.root_path}
                                            onChange={e => setFormData(prev => ({ ...prev, root_path: e.target.value }))}
                                            placeholder="/home/media"
                                            className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                                 border border-gray-700 focus:border-blue-500 focus:outline-none"
                                        />
                                        <p className="mt-1 text-[10px] text-gray-500">后端可访问的绝对路径</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wider">备注</label>
                                    <textarea
                                        value={formData.remark}
                                        onChange={e => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                                        placeholder="用于辨识网盘源..."
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg 
                                             border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-6 pt-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.enabled}
                                            onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                                        />
                                        启用源
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.hidden}
                                            onChange={e => setFormData(prev => ({ ...prev, hidden: e.target.checked }))}
                                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                                        />
                                        未登录隐藏
                                    </label>
                                    {formData.type !== 'local' && (
                                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={formData.proxy_enabled}
                                                onChange={e => setFormData(prev => ({ ...prev, proxy_enabled: e.target.checked }))}
                                                className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                                            />
                                            启用图片/流代理
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-lg 
                                         hover:bg-gray-700 transition-colors border border-gray-700"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !isFormValid()}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg 
                                         hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
                                >
                                    {saving ? '正在保存...' : '确认保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 目录选择器 */}
            {
                pickerSourceId && (
                    <DirectoryPicker
                        sourceId={pickerSourceId}
                        isOpen={pickerOpen}
                        onClose={() => {
                            setPickerOpen(false);
                            setPickerSourceId(null);
                            setPickerEditIndex(-1);
                        }}
                        onSelect={(path, name) => {
                            const source = sources.find(s => s.id === pickerSourceId);
                            if (!source) return;

                            const currentPaths = Array.isArray(source.scan_paths) ? source.scan_paths : [];

                            if (pickerMode === 'add') {
                                // 添加新目录
                                handleUpdateScanPaths(source, [...currentPaths, { name, path, tmdb_enabled: false }]);
                                // 自动执行扫描任务
                                setTimeout(() => {
                                    handleScan(source.id, path);
                                }, 500);
                            } else if (pickerMode === 'edit' && pickerEditIndex >= 0) {
                                // 编辑现有目录路径
                                const next = [...currentPaths];
                                next[pickerEditIndex] = { ...next[pickerEditIndex], path, name: next[pickerEditIndex].name || name };
                                handleUpdateScanPaths(source, next);
                            }
                        }}
                    />
                )
            }
        </div >
    );
}
