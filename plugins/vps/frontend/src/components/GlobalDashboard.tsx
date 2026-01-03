
import React, { useMemo, useState, useEffect } from 'react';
import { VpsServer, VpsGroup } from '../types';
import { Icon } from './common/Icon';
import { createGroup, updateGroup, deleteGroup, checkServerStatus } from '../api';
import { ConfirmModal } from './common/ConfirmModal';

interface GlobalDashboardProps {
    servers: VpsServer[];
    groups: VpsGroup[];
    onConnect: (serverId: string) => void;
    onAddServer: () => void;
    onEditServer: (server: VpsServer) => void;
    onDeleteServer: (server: VpsServer) => void;
    onRefresh: () => void;
}

export default function GlobalDashboard({ servers, groups, onConnect, onAddServer, onEditServer, onDeleteServer, onRefresh }: GlobalDashboardProps) {
    const [activeTab, setActiveTab] = useState<string>('All');
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [editingGroup, setEditingGroup] = useState<VpsGroup | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

    const stats = useMemo(() => {
        const total = servers.length;
        const online = servers.filter(s => s.status === 'online').length;
        const offline = servers.filter(s => s.status === 'offline').length;
        const unknown = total - online - offline;

        // OS Distribution
        const osDist: Record<string, number> = {};
        servers.forEach(s => {
            if (s.os_info) {
                try {
                    const osData = JSON.parse(s.os_info);
                    const osName = osData.name?.split(' ')[0] || 'Unknown';
                    osDist[osName] = (osDist[osName] || 0) + 1;
                } catch {
                    // Fallback for old format
                    const osName = s.os_info.split(' ')[0];
                    osDist[osName] = (osDist[osName] || 0) + 1;
                }
            } else {
                osDist['Unknown'] = (osDist['Unknown'] || 0) + 1;
            }
        });

        const cpuCores = servers.reduce((acc, s) => {
            if (!s.cpu_info) return acc;
            try {
                const cpuData = JSON.parse(s.cpu_info);
                return acc + (cpuData.cores || 0);
            } catch {
                // Fallback for old format
                const match = s.cpu_info?.match(/\((\d+)\s+Cores\)/);
                return acc + (match ? parseInt(match[1]) : 0);
            }
        }, 0);
        const ramTotal = servers.reduce((acc, s) => {
            if (!s.mem_info) return acc;
            try {
                const memData = JSON.parse(s.mem_info);
                return acc + (memData.total || 0);
            } catch {
                // Fallback for old format
                const match = s.mem_info?.match(/^(\d+)\s+MB/);
                return acc + (match ? parseInt(match[1]) : 0);
            }
        }, 0);

        return { total, online, offline, unknown, osDist, cpuCores, ramTotal };
    }, [servers]);

    // Keep latest servers in ref to access inside interval without re-running effect
    const serversRef = React.useRef(servers);
    useEffect(() => {
        serversRef.current = servers;
    }, [servers]);

    // Polling for status and latency
    useEffect(() => {
        const checkStatus = async () => {
            const currentServers = serversRef.current;
            try {
                // Only check if there are servers
                if (currentServers.length === 0) return;

                await checkServerStatus(currentServers.map(s => s.id));

                // Trigger refresh to update status (system info is now automatically fetched by backend)
                onRefresh();
            } catch (error) {
                console.error('Status check failed:', error);
            }
        };

        // Check every 30 seconds
        const interval = setInterval(checkStatus, 30000);

        // Initial check (only once on mount)
        checkStatus();

        return () => clearInterval(interval);
    }, [onRefresh]); // Only depend on onRefresh (which is now stable)

    // Helper functions to parse JSON system info
    const parseOSInfo = (osInfoStr?: string) => {
        if (!osInfoStr) return '-';
        try {
            const info = JSON.parse(osInfoStr);
            // 只显示名称，不显示版本和内核
            return info.name || '-';
        } catch {
            // Fallback for old format
            return osInfoStr.split('\n').pop()?.trim() || '-';
        }
    };

    const parseCPUInfo = (cpuInfoStr?: string) => {
        if (!cpuInfoStr) return '-';
        try {
            const info = JSON.parse(cpuInfoStr);
            const model = info.model || 'Unknown';
            const cores = info.cores || 0;

            // 显示完整的CPU型号和核心数
            if (cores > 0) {
                return `${model} (${cores}核)`;
            } else {
                return model;
            }
        } catch {
            // Fallback for old format
            return cpuInfoStr.split('\n').pop()?.trim() || '-';
        }
    };

    const parseMemInfo = (memInfoStr?: string) => {
        if (!memInfoStr) return '-';
        try {
            const info = JSON.parse(memInfoStr);
            const total = info.total || 0;
            const used = info.used || 0;
            const percentage = info.usedPercentage || 0;

            if (total === 0) return '-';

            // 格式：百分比 (已用/总量)
            // 如果大于1024MB，转换为GB显示
            if (total >= 1024) {
                const totalGB = (total / 1024).toFixed(1);
                const usedGB = (used / 1024).toFixed(1);
                return `${percentage}% (${usedGB}/${totalGB}GB)`;
            } else {
                return `${percentage}% (${used}/${total}MB)`;
            }
        } catch {
            // Fallback for old format
            return memInfoStr.split('\n').pop()?.trim() || '-';
        }
    };

    const parseDiskInfo = (diskInfoStr?: string) => {
        if (!diskInfoStr) return '-';
        try {
            const info = JSON.parse(diskInfoStr);
            const percentage = info.usedPercentage || 0;
            const used = info.used || '0';
            const total = info.total || '0';

            // 格式：百分比 (已用/总量)
            return `${percentage}% (${used}/${total})`;
        } catch {
            // Fallback for old format
            return diskInfoStr.split('\n').pop()?.trim() || '-';
        }
    };

    const filteredServers = useMemo(() => {
        if (activeTab === 'All') return servers;
        const group = groups.find(g => g.name === activeTab);
        return group ? servers.filter(s => s.group_id === group.id) : [];
    }, [servers, groups, activeTab]);

    // Group Management
    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await createGroup({ name: newGroupName });
            onRefresh();
            setNewGroupName('');
            setIsAddingGroup(false);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRenameGroup = async (group: VpsGroup, newName: string) => {
        try {
            await updateGroup(group.id, { name: newName });
            onRefresh();
            setEditingGroup(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        try {
            await deleteGroup(groupId);
            onRefresh();
            if (activeTab === groups.find(g => g.id === groupId)?.name) {
                setActiveTab('All');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-[var(--theme-text)]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">总览</h2>
            </div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Servers */}
                <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Icon icon="fa-solid fa-server" className="text-xl" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-500/5 px-2 py-1 rounded-full">Total</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.total}</div>
                    <div className="text-sm text-gray-500">总服务器数</div>
                </div>

                {/* Online */}
                <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                            <Icon icon="fa-solid fa-signal" className="text-xl" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-500/5 px-2 py-1 rounded-full">Online</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.online}</div>
                    <div className="text-sm text-gray-500">在线服务器</div>
                </div>

                {/* Offline */}
                <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                            <Icon icon="fa-solid fa-power-off" className="text-xl" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-500/5 px-2 py-1 rounded-full">Offline</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stats.offline}</div>
                    <div className="text-sm text-gray-500">离线服务器</div>
                </div>

                {/* OS Distribution */}
                <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Icon icon="fa-brands fa-linux" className="text-xl" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-500/5 px-2 py-1 rounded-full">Systems</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[var(--theme-text)]">
                        {Object.entries(stats.osDist).slice(0, 3).map(([os, count]) => (
                            <span key={os} className="text-xs bg-gray-500/10 border border-gray-500/20 px-2 py-1 rounded">
                                {os}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Server List Table */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border-color)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 overflow-hidden w-full md:w-auto">
                        <h3 className="text-lg font-bold whitespace-nowrap">服务器详情</h3>
                        <div className="h-6 w-px border-l border-[var(--border-color)] mx-2 hidden md:block"></div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                            <button
                                onClick={() => setActiveTab('All')}
                                className={`
                                    px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all
                                    ${activeTab === 'All'
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'bg-gray-500/5 text-gray-400 hover:bg-gray-500/10 hover:text-[var(--theme-text)]'
                                    }
                                `}
                            >
                                全部
                            </button>
                            {groups.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setActiveTab(g.name)}
                                    className={`
                                        px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all
                                        ${activeTab === g.name
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'bg-gray-500/5 text-gray-400 hover:bg-gray-500/10 hover:text-[var(--theme-text)]'
                                        }
                                    `}
                                >
                                    {g.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={onAddServer}
                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Icon icon="fa-solid fa-plus" />
                            <span>添加服务器</span>
                        </button>
                        <button
                            onClick={() => setShowGroupSettings(true)}
                            className="bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--theme-text)] px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-500/10 flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Icon icon="fa-solid fa-cog" />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-500/5 text-gray-400 text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                                <th className="px-6 py-3 font-medium">状态</th>
                                <th className="px-6 py-3 font-medium">名称 / 主机</th>
                                <th className="px-6 py-3 font-medium">操作系统</th>
                                <th className="px-6 py-3 font-medium">CPU</th>
                                <th className="px-6 py-3 font-medium">内存</th>
                                <th className="px-6 py-3 font-medium">硬盘</th>
                                <th className="px-6 py-3 font-medium text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-[var(--border-color)]">
                            {filteredServers.map(server => (
                                <tr key={server.id} className="hover:bg-gray-500/5 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${server.status === 'online' ? 'bg-green-500' : server.status === 'error' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                                            <span className="text-sm text-gray-500">
                                                {server.status === 'online'
                                                    ? (server.latency ? `${server.latency}ms` : 'Online')
                                                    : (server.status === 'error' ? 'Error' : 'Offline')
                                                }
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-[var(--theme-text)]">{server.name}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-0.5">{server.host}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="fa-brands fa-linux" className="text-gray-400" />
                                            {parseOSInfo(server.os_info)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {parseCPUInfo(server.cpu_info)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {parseMemInfo(server.mem_info)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-400">
                                            {parseDiskInfo(server.disk_info)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onConnect(server.id)}
                                                className="text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-md transition-colors"
                                            >
                                                连接
                                            </button>
                                            <button
                                                onClick={() => onEditServer(server)}
                                                className="text-gray-400 hover:text-blue-600 bg-gray-500/10 hover:bg-gray-500/20 px-3 py-1 rounded-md transition-colors"
                                                title="编辑"
                                            >
                                                <Icon icon="fa-solid fa-pen" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteServer(server)}
                                                className="text-gray-400 hover:text-red-600 bg-gray-500/10 hover:bg-gray-500/20 px-3 py-1 rounded-md transition-colors"
                                                title="删除"
                                            >
                                                <Icon icon="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {servers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <Icon icon="fa-solid fa-server" className="text-5xl text-gray-300 mb-3" />
                                            <p className="text-lg font-medium">暂无服务器</p>
                                            <p className="text-sm text-gray-500 mt-1">点击 "添加服务器" 按钮来添加您的第一台服务器。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Group Settings Modal */}
            {showGroupSettings && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowGroupSettings(false)}>
                    <div className="bg-[var(--card-bg)] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in text-[var(--theme-text)]" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-gray-500/5">
                            <h3 className="text-lg font-bold">分组管理</h3>
                            <button onClick={() => setShowGroupSettings(false)} className="text-gray-400 hover:text-[var(--theme-text)]">
                                <Icon icon="fa-solid fa-times" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {/* Add Group Input */}
                                {isAddingGroup ? (
                                    <div className="flex items-center gap-2 mb-4 p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)]">
                                        <input
                                            type="text"
                                            placeholder="输入新分组名称..."
                                            className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                                            autoFocus
                                        />
                                        <button onClick={handleAddGroup} className="text-blue-600 hover:text-blue-700 px-2 font-medium text-sm">确定</button>
                                        <button onClick={() => setIsAddingGroup(false)} className="text-gray-400 hover:text-gray-600 px-2">
                                            <Icon icon="fa-solid fa-times" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setIsAddingGroup(true); setNewGroupName(''); }}
                                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors text-sm font-medium mb-4"
                                    >
                                        <Icon icon="fa-solid fa-plus" className="mr-2" /> 新增分组
                                    </button>
                                )}

                                <div className="space-y-2">
                                    {groups.map(group => (
                                        <div key={group.id} className="flex items-center justify-between p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)] group">
                                            {editingGroup?.id === group.id ? (
                                                <div className="flex-1 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newGroupName}
                                                        onChange={e => setNewGroupName(e.target.value)}
                                                        className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleRenameGroup(group, newGroupName)}
                                                        className="text-green-600 hover:text-green-700 px-2"
                                                    >
                                                        <Icon icon="fa-solid fa-check" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingGroup(null)}
                                                        className="text-gray-400 hover:text-gray-600 px-2"
                                                    >
                                                        <Icon icon="fa-solid fa-times" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-medium">{group.name}</span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingGroup(group);
                                                                setNewGroupName(group.name);
                                                            }}
                                                            className="text-gray-400 hover:text-blue-600 p-1"
                                                            title="重命名"
                                                        >
                                                            <Icon icon="fa-solid fa-pen" />
                                                        </button>
                                                        <button
                                                            onClick={() => setGroupToDelete(group.id)}
                                                            className="text-gray-400 hover:text-red-600 p-1"
                                                            title="删除"
                                                        >
                                                            <Icon icon="fa-solid fa-trash" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {groups.length === 0 && !isAddingGroup && (
                                    <div className="text-center text-gray-400 text-sm py-4">
                                        暂无分组
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!groupToDelete}
                onClose={() => setGroupToDelete(null)}
                onConfirm={() => groupToDelete && handleDeleteGroup(groupToDelete)}
                title="删除分组"
                message="确定要删除此分组吗？组内服务器将变为未分组状态。"
            />
        </div>
    );
}
