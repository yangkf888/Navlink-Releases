import React, { useState, useEffect } from 'react';
import { FileText, Search, Trash2, RefreshCw, Download, AlertCircle, Database } from 'lucide-react';
import { Input } from '@/shared/components/ui/AdminInput';

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

function LogsPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [files, setFiles] = useState<LogFile[]>([]);
    const [loading, setLoading] = useState(false);

    // 过滤条件
    const [filters, setFilters] = useState({
        level: '',
        context: '',
        logType: 'combined',
        limit: 100,
        startDate: '',
        endDate: ''
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
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
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

    const handleClearLogs = async () => {
        if (!window.confirm('⚠️ 确定要清理所有日志吗？\n\n此操作将删除所有日志文件，不可恢复！')) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/logs/clear', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('清理失败');
            }

            alert('✅ 日志清理成功');
            setLogs([]);
            loadFiles();
        } catch (err: any) {
            alert('❌ 日志清理失败: ' + err.message);
            console.error('Failed to clear logs:', err);
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
        // Match format: type-YYYY-MM-DD.log
        const match = filename.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.log$/);
        if (match) {
            return {
                type: match[1],
                date: match[2]
            };
        }
        // Fallback or other formats
        const parts = filename.split('-');
        return { type: parts[0], date: null };
    };

    // 点击文件时加载特定日期的日志
    const handleFileClick = (file: LogFile) => {
        const meta = getFileMeta(file.name);

        let newFilters = { ...filters, logType: meta.type };

        if (meta.date) {
            // Set date range for that specific day
            // Logs use 'YYYY-MM-DD HH:mm:ss'
            // We want to cover from 00:00:00 to 23:59:59 of that day
            newFilters.startDate = `${meta.date} 00:00:00`;
            newFilters.endDate = `${meta.date} 23:59:59`;
        } else {
            // If no date in filename (e.g. current log file if differently named), clear date filters
            newFilters.startDate = '';
            newFilters.endDate = '';
        }

        setFilters(newFilters);
        // Note: loadLogs uses the *current* state of filters due to closure if called directly here?
        // Actually, state updates are async. We should use useEffect or pass params.
        // For simplicity, let's trigger a reload via useEffect dependency or manual call with params
        // But since we can't easily change useEffect dependency logic here without major refactor,
        // let's pass the new filters directly to a helper or just rely on the user clicking 'Search' or 
        // wait, we want instant feedback.

        // Better approach: Update loadLogs to accept optional override params OR just call it after timeout?
        // Actually React batching... let's modify loadLogs to read from state is standard but here we want immediate action.
        // Let's modify loadLogs to take optional filters argument.
        loadLogsWithFilters(newFilters);
    };

    const loadLogsWithFilters = async (currentFilters: typeof filters) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const params = new URLSearchParams();

            if (currentFilters.level) params.append('level', currentFilters.level);
            if (currentFilters.context) params.append('context', currentFilters.context);
            if (currentFilters.logType) params.append('logType', currentFilters.logType);
            if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
            if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
            params.append('limit', currentFilters.limit.toString());

            const response = await fetch(`/api/logs?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('加载日志失败');

            const data = await response.json();
            setLogs(data);
        } catch (err: any) {
            console.error('Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
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
                <div className="flex gap-2">
                    <button
                        onClick={() => { loadLogs(); loadFiles(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <RefreshCw size={20} />
                        刷新
                    </button>
                    <button
                        onClick={handleClearLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        <Trash2 size={20} />
                        清理日志
                    </button>
                </div>
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
                                className={`p-3 rounded-lg cursor-pointer border hover:border-gray-200 transition-all group ${
                                    // Highlight logic could be added here if we track selected file
                                    'hover:bg-gray-50 border-transparent'
                                    }`}
                                onClick={() => handleFileClick(file)}
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
                            <div className="flex-1 grid grid-cols-5 gap-4">
                                <select
                                    value={filters.logType}
                                    onChange={(e) => setFilters({ ...filters, logType: e.target.value })}
                                    className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                                >
                                    <option value="combined">全部日志</option>
                                    <option value="error">错误日志</option>
                                    <option value="system">系统日志</option>
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
                                <Input
                                    type="text"
                                    value={filters.context}
                                    onChange={(e) => setFilters({ ...filters, context: e.target.value })}
                                    placeholder="上下文..."
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <Input
                                    type="date"
                                    value={filters.startDate ? filters.startDate.split(' ')[0] : ''}
                                    onChange={(e) => {
                                        const date = e.target.value;
                                        setFilters(prev => ({
                                            ...prev,
                                            startDate: date ? `${date} 00:00:00` : '',
                                            endDate: date ? `${date} 23:59:59` : ''
                                        }));
                                    }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="选择日期"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => loadLogsWithFilters(filters)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap w-full"
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

export default LogsPage;
