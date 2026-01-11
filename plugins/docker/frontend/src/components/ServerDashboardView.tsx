import React, { useEffect } from 'react';
import { SystemInfo, AuditLog } from '../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import { useDockerAuditLogs } from '../hooks/useDocker';

interface ServerDashboardViewProps {
    info: SystemInfo | null;
    loading: boolean;
    serverId: string;
    serverName: string;
    tabs?: React.ReactNode;
}

const ServerDashboardView: React.FC<ServerDashboardViewProps> = ({ info, loading, serverId, serverName, tabs }) => {
    const { logs, loading: logsLoading, loadLogs } = useDockerAuditLogs(serverId, 10);

    // Reload logs when serverId changes
    useEffect(() => {
        loadLogs();
    }, [serverId, loadLogs]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">系统概览</h2>
                    {tabs}
                </div>
                {!loading && info && (
                    <div className="flex gap-2 flex-shrink-0 self-end md:self-auto">
                        <button
                            onClick={() => loadLogs()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-[var(--theme-primary)] hover:border-[var(--theme-primary)] transition"
                        >
                            <Icon icon={`fa-solid fa-refresh ${logsLoading ? 'animate-spin' : ''}`} />
                            <span>刷新</span>
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : !info ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                    <Icon icon="fa-solid fa-triangle-exclamation" className="text-4xl text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-red-700 mb-2">无法连接到服务器</h3>
                    <p className="text-red-600">请检查服务器状态或网络连接</p>
                </div>
            ) : (
                <>
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Containers Card */}
                        <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition">
                                    <Icon icon="fa-solid fa-box" className="text-xl" />
                                </div>
                                <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Containers</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">{info.containers}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                <span className="text-green-600 dark:text-green-400 font-medium">{info.containersRunning} 运行</span>
                                <span className="text-orange-500 dark:text-orange-400">{info.containersPaused} 暂停</span>
                                <span className="text-gray-400 dark:text-gray-500">{info.containersStopped} 停止</span>
                            </div>
                        </div>

                        {/* Images Card */}
                        <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition">
                                    <Icon icon="fa-solid fa-layer-group" className="text-xl" />
                                </div>
                                <span className="text-[10px] font-bold text-white bg-purple-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Images</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">{info.images}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">本地镜像总数</div>
                        </div>

                        {/* CPU Card */}
                        <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/50 transition">
                                    <Icon icon="fa-solid fa-microchip" className="text-xl" />
                                </div>
                                <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full uppercase tracking-wider">CPU</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">{info.cpus}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">可用核心数</div>
                        </div>

                        {/* Memory Card */}
                        <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition">
                                    <Icon icon="fa-solid fa-memory" className="text-xl" />
                                </div>
                                <span className="text-[10px] font-bold text-white bg-green-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Memory</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">{formatBytes(info.memory)}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">总内存容量</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* System Details (2/3 width) */}
                        <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                <Icon icon="fa-solid fa-circle-info" className="text-[var(--theme-primary)]" />
                                系统详情
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">操作系统</div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Icon icon="fa-brands fa-linux" className="text-gray-400 dark:text-gray-500" />
                                        {info.os} ({info.arch})
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Docker 版本</div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Icon icon="fa-brands fa-docker" className="text-blue-500" />
                                        {info.dockerVersion} (API {info.apiVersion})
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">服务器时间</div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 font-mono">
                                        {new Date(info.serverTime).toLocaleString('zh-CN')}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">内核版本</div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 text-sm bg-gray-50 dark:bg-gray-800 p-1 rounded border border-gray-100 dark:border-gray-700 inline-block">
                                        Linux Kernel
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-transparent dark:border-white/[0.02]">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">容器状态分布</h4>
                                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${(info.containersRunning / info.containers) * 100}%` }} className="bg-green-500 h-full" title={`运行中: ${info.containersRunning}`}></div>
                                    <div style={{ width: `${(info.containersPaused / info.containers) * 100}%` }} className="bg-orange-400 h-full" title={`暂停: ${info.containersPaused}`}></div>
                                    <div style={{ width: `${(info.containersStopped / info.containers) * 100}%` }} className="bg-gray-300 dark:bg-gray-500 h-full" title={`停止: ${info.containersStopped}`}></div>
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 运行中 ({Math.round((info.containersRunning / info.containers) * 100) || 0}%)</div>
                                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> 暂停 ({Math.round((info.containersPaused / info.containers) * 100) || 0}%)</div>
                                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-500"></span> 停止 ({Math.round((info.containersStopped / info.containers) * 100) || 0}%)</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity (1/3 width) */}
                        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-white/[0.05] shadow-sm p-0 overflow-hidden flex flex-col h-full max-h-[400px]">
                            <div className="p-4 border-b border-transparent dark:border-white/[0.02] bg-gray-50/50 dark:bg-black">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <Icon icon="fa-solid fa-clock-rotate-left" className="text-orange-500" />
                                    最近活动
                                </h3>
                            </div>
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                                {logsLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : logs.length > 0 ? (
                                    <div className="divide-y divide-gray-50 dark:divide-white/[0.02]">
                                        {logs.map((log: AuditLog) => {
                                            const isSuccess = log.status === 'success';
                                            let icon = 'fa-solid fa-info-circle';
                                            let color = 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';

                                            if (log.action.includes('start')) { icon = 'fa-solid fa-play'; color = 'text-green-500 bg-green-50 dark:bg-green-900/20'; }
                                            else if (log.action.includes('stop')) { icon = 'fa-solid fa-stop'; color = 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'; }
                                            else if (log.action.includes('delete') || log.action.includes('remove')) { icon = 'fa-solid fa-trash'; color = 'text-red-500 bg-red-50 dark:bg-red-900/20'; }
                                            else if (log.action.includes('create')) { icon = 'fa-solid fa-plus'; color = 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'; }

                                            return (
                                                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-transparent transition">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                                                            <Icon icon={icon} className="text-[10px]" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                                {log.action} {log.resource_type}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                                {log.resource_name || (log.resource_id ? log.resource_id.substring(0, 12) : '-')}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                                                {formatDate(log.created_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-600">
                                        <p className="text-sm">暂无活动记录</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ServerDashboardView;
