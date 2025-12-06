import React from 'react';
import { Container, DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface ContainerListProps {
    containers: Container[];
    loading: boolean;
    error: string | null;
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
    onRefresh: () => void;
    onCreate: () => void;
    onAction: (action: string, containerId: string) => void;
    onOpenShell: (containerId: string, name: string) => void;
    onOpenLogs: (containerId: string, name: string) => void;
}

export const ContainerList: React.FC<ContainerListProps> = ({
    containers,
    loading,
    error,
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer,
    onRefresh,
    onCreate,
    onAction,
    onOpenShell,
    onOpenLogs
}) => {
    const formatDate = (ts: number) => {
        return new Date(ts * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">容器列表</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">容器列表</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                    <Icon icon="fa-solid fa-triangle-exclamation" className="text-4xl text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-red-700 mb-2">无法加载容器列表</h3>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">容器列表</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>

                <div className="flex gap-2 flex-shrink-0 self-end md:self-auto">
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--theme-primary)] text-white rounded-lg text-sm hover:brightness-110 transition flex-shrink-0"
                    >
                        <Icon icon="fa-solid fa-plus" />
                        <span>创建容器</span>
                    </button>
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-[var(--theme-primary)] hover:border-[var(--theme-primary)] transition flex-shrink-0"
                    >
                        <Icon icon="fa-solid fa-refresh" />
                        <span>刷新</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">容器名称 / ID</th>
                                <th className="px-6 py-3">状态</th>
                                <th className="px-6 py-3">镜像</th>
                                <th className="px-6 py-3">网络 / 端口</th>
                                <th className="px-6 py-3">挂载</th>
                                <th className="px-6 py-3">创建时间</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {containers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        暂无容器
                                    </td>
                                </tr>
                            ) : containers.map(container => (
                                <tr key={container.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${container.state === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`}></div>
                                            <div>
                                                <div className="font-bold text-gray-800">{container.name}</div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5 bg-gray-100 px-1.5 py-0.5 rounded w-fit">{container.id ? container.id.substring(0, 12) : '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${container.state === 'running'
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {container.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 max-w-[150px] xl:max-w-[200px]">
                                            <Icon icon="fa-solid fa-layer-group" className="text-gray-400 text-xs" />
                                            <span className="truncate" title={container.image}>{container.image}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        <div className="flex flex-col gap-1">
                                            {container.networks && container.networks.length > 0 && (
                                                <div className="flex items-center gap-1 text-blue-600">
                                                    <Icon icon="fa-solid fa-network-wired" />
                                                    <span>{container.networks.join(', ')}</span>
                                                </div>
                                            )}
                                            {container.ports && container.ports.length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {container.ports.filter(p => p.PublicPort).slice(0, 2).map((p, i) => (
                                                        <span key={i} className="font-mono bg-gray-50 px-1 rounded border border-gray-100 w-fit">
                                                            {p.PublicPort}:{p.PrivatePort}
                                                        </span>
                                                    ))}
                                                    {container.ports.filter(p => p.PublicPort).length > 2 && (
                                                        <span className="text-gray-400">+{container.ports.filter(p => p.PublicPort).length - 2} more</span>
                                                    )}
                                                </div>
                                            ) : <span className="text-gray-300">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {container.mounts && container.mounts.length > 0 ? (
                                            <div className="flex flex-col gap-0.5 max-w-[150px]">
                                                {container.mounts.slice(0, 2).map((m, i) => (
                                                    <div key={i} className="truncate" title={`${m.Source} -> ${m.Destination}`}>
                                                        <span className="font-mono text-gray-400">{m.Destination}</span>
                                                    </div>
                                                ))}
                                                {container.mounts.length > 2 && (
                                                    <span className="text-gray-400">+{container.mounts.length - 2} more</span>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {formatDate(container.created)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {container.state === 'running' ? (
                                                <>
                                                    <button onClick={() => onAction('restart', container.id)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition" title="重启">
                                                        <Icon icon="fa-solid fa-rotate-right" />
                                                    </button>
                                                    <button onClick={() => onAction('stop', container.id)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition" title="停止">
                                                        <Icon icon="fa-solid fa-stop" />
                                                    </button>
                                                    <button onClick={() => onOpenShell(container.id, container.name)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Shell">
                                                        <Icon icon="fa-solid fa-terminal" />
                                                    </button>
                                                    <button onClick={() => onOpenLogs(container.id, container.name)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="日志">
                                                        <Icon icon="fa-solid fa-file-lines" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => onAction('start', container.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="启动">
                                                    <Icon icon="fa-solid fa-play" />
                                                </button>
                                            )}
                                            <button onClick={() => onAction('delete', container.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="删除">
                                                <Icon icon="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {containers.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">
                        暂无容器
                    </div>
                ) : containers.map(container => (
                    <div key={container.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${container.state === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`}></div>
                                <div>
                                    <div className="font-bold text-gray-800 text-lg">{container.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{container.id ? container.id.substring(0, 12) : '-'}</div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${container.state === 'running'
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {container.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex items-center gap-2">
                                <Icon icon="fa-solid fa-layer-group" className="text-gray-400 w-5 text-center" />
                                <span className="truncate flex-1">{container.image}</span>
                            </div>
                            {container.ports && container.ports.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <Icon icon="fa-solid fa-network-wired" className="text-gray-400 w-5 text-center mt-0.5" />
                                    <div className="flex flex-wrap gap-1">
                                        {container.ports.filter(p => p.PublicPort).map((p, i) => (
                                            <span key={i} className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-xs">
                                                {p.PublicPort}:{p.PrivatePort}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                            {container.state === 'running' ? (
                                <>
                                    <button onClick={() => onAction('restart', container.id)} className="flex flex-col items-center gap-1 text-yellow-600" title="重启">
                                        <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center"><Icon icon="fa-solid fa-rotate-right" /></div>
                                        <span className="text-[10px]">重启</span>
                                    </button>
                                    <button onClick={() => onAction('stop', container.id)} className="flex flex-col items-center gap-1 text-orange-600" title="停止">
                                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Icon icon="fa-solid fa-stop" /></div>
                                        <span className="text-[10px]">停止</span>
                                    </button>
                                    <button onClick={() => onOpenShell(container.id, container.name)} className="flex flex-col items-center gap-1 text-gray-600" title="Shell">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Icon icon="fa-solid fa-terminal" /></div>
                                        <span className="text-[10px]">Shell</span>
                                    </button>
                                    <button onClick={() => onOpenLogs(container.id, container.name)} className="flex flex-col items-center gap-1 text-blue-600" title="日志">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Icon icon="fa-solid fa-file-lines" /></div>
                                        <span className="text-[10px]">日志</span>
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => onAction('start', container.id)} className="flex flex-col items-center gap-1 text-green-600" title="启动">
                                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center"><Icon icon="fa-solid fa-play" /></div>
                                    <span className="text-[10px]">启动</span>
                                </button>
                            )}
                            <button onClick={() => onAction('delete', container.id)} className="flex flex-col items-center gap-1 text-red-600" title="删除">
                                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Icon icon="fa-solid fa-trash" /></div>
                                <span className="text-[10px]">删除</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
