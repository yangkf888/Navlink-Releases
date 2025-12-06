import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Filter, Calendar, Database, AlertCircle } from 'lucide-react';

interface Log {
    timestamp: string;
    level: string;
    context?: string;
    message: string;
    [key: string]: any;
}

interface LogFile {
    name: string;
    size: number;
    updatedAt: string;
}

export default function Logs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [files, setFiles] = useState<LogFile[]>([]);
    const [loading, setLoading] = useState(false);

    // 过滤条件
    const [filters, setFilters] = useState({
        level: '',
        context: '',
        logType: 'combined',
        limit: 100
    });

    useEffect(() => {
        loadLogs();
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/logs/files', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFiles(data);
            }
        } catch (err) {
            console.error('Failed to list files:', err);
        }
    };

    const loadLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const params = new URLSearchParams();

            if (filters.level) params.append('level', filters.level);
            if (filters.context) params.append('context', filters.context);
            if (filters.logType) params.append('logType', filters.logType);
            params.append('limit', filters.limit.toString());

            const response = await fetch(`/api/logs?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('加载日志失败');
            }

            const data = await response.json();
            setLogs(data);
        } catch (err: any) {
            console.error('Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const getLevelBadge = (level: string) => {
        const colors = {
            error: 'bg-red-100 text-red-800',
            warn: 'bg-yellow-100 text-yellow-800',
            info: 'bg-blue-100 text-blue-800',
            debug: 'bg-gray-100 text-gray-800',
            verbose: 'bg-purple-100 text-purple-800'
        };
        return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    // 解析文件名中的日期和类型
    // combined-2023-10-01.log
    const getFileMeta = (filename: string) => {
        const parts = filename.split('-');
        const type = parts[0];
        // 简单处理：假设格式固定
        return { type };
    };

    return (
        <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
            {/* 顶栏 */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <FileText className="text-blue-600" size={32} />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">系统日志</h1>
                        <p className="text-sm text-gray-500 mt-1">查看和分析系统运行日志</p>
                    </div>
                </div>
                <button
                    onClick={() => { loadLogs(); loadFiles(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw size={20} />
                    刷新
                </button>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* 左侧：日志文件列表 */}
                <div className="w-64 bg-white rounded-xl border border-gray-200 flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Database size={16} />
                            日志文件 ({files.length})
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {files.map(file => (
                            <div
                                key={file.name}
                                className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-all group"
                                onClick={() => {
                                    // 简单的逻辑：点击文件自动设置过滤器查看该类型日志
                                    // 注意：这里目前后端API是查询解析后的日志流，不是直接读文件内容
                                    // 对接文件读取API需要更多后端支持，目前先展示列表响应用户需求
                                    const meta = getFileMeta(file.name);
                                    setFilters(prev => ({ ...prev, logType: meta.type }));
                                    loadLogs();
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText size={14} className={file.name.includes('error') ? 'text-red-500' : 'text-blue-500'} />
                                    <span className="text-sm font-medium text-gray-700 truncate" title={file.name}>{file.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>{formatSize(file.size)}</span>
                                    <span>{formatDate(file.updatedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 右侧：日志内容与过滤 */}
                <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-gray-200">
                    {/* 过滤器 */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex gap-4">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                                <select
                                    value={filters.logType}
                                    onChange={(e) => setFilters({ ...filters, logType: e.target.value })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value="combined">全部日志 (Combined)</option>
                                    <option value="error">错误日志 (Error)</option>
                                    <option value="system">系统日志 (System)</option>
                                </select>
                                <select
                                    value={filters.level}
                                    onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value="">所有级别</option>
                                    <option value="error">Error</option>
                                    <option value="warn">Warn</option>
                                    <option value="info">Info</option>
                                </select>
                                <input
                                    type="text"
                                    value={filters.context}
                                    onChange={(e) => setFilters({ ...filters, context: e.target.value })}
                                    placeholder="搜索上下文..."
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={loadLogs}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
                                    >
                                        查询
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 日志表格 */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">时间</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">级别</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">上下文</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">消息</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            加载中...
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            暂无日志记录
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-900 font-mono text-xs whitespace-nowrap">
                                                {log.timestamp}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelBadge(log.level)}`}>
                                                    {log.level.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-medium">
                                                {log.context || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 font-mono text-xs break-all">
                                                {log.message}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
