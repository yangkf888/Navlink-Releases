import React, { useState, useEffect, useCallback } from 'react';
import GlobalDashboard from './components/GlobalDashboard';
import ServerList from './components/ServerList';
import SnippetLibrary from './components/SnippetLibrary';
import ServerTerminalView from './components/ServerTerminalView';
import ServerFormModal from './components/ServerFormModal';
import { useConfig } from '@/shared/context/ConfigContext';
import { VpsServer, VpsGroup } from './types';
import { createServer, updateServer } from './api';
import { Icon } from '@/shared/components/common/Icon';
import { ConfigProvider } from '@/shared/context/ConfigContext';
// @ts-ignore
import LoginDialog from '@/shared/components/common/LoginDialog';

// iframe模式: 从URL获取token
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
    localStorage.setItem('auth_token', urlToken);
    console.log('[VPS] Token received from iframe parent');
}

// View type definition
type VPSView = 'dashboard' | 'servers' | 'snippets' | 'terminal' | 'files';

interface Session {
    id: string;
    serverId: string;
    serverName: string;
}

function VPSAppContent() {
    const { config } = useConfig();
    const [servers, setServers] = useState<VpsServer[]>([]);
    const [groups, setGroups] = useState<VpsGroup[]>([]);

    const [activeView, setActiveView] = useState<VPSView>('dashboard');
    const [showLogin, setShowLogin] = useState(false);

    // Determine if we should use fixed layout (for terminal) or window scroll (for others)
    const isFixedLayout = activeView === 'terminal';

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<VpsServer | null>(null);

    // Session Management
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // 发送 Sidebar 配置到主应用
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        // 构建动态侧边栏结构
        // 构建动态侧边栏结构
        // 构建动态侧边栏结构
        // 构建动态侧边栏结构
        const sidebarItems = [
            { id: 'dashboard', label: '总览', icon: 'fas fa-chart-line' },
            { id: 'snippets', label: '脚本库', icon: 'fas fa-code' },
            // Section Header (Standalone)
            {
                id: 'server-list-header',
                label: '服务器列表',
                isLabel: true,
                icon: 'fas fa-server' // Add icon back
            },
            // Dynamic Groups (Top Level Siblings)
            ...groups.map(group => ({
                id: `group:${group.id}`,
                label: group.name,
                icon: '', // No icon for groups
                isOpen: true, // Auto expand groups
                isCategory: true, // Mark as category (smaller font)
                children: servers
                    .filter(s => s.group_id === group.id)
                    .map(s => ({
                        id: `server:${s.id}`,
                        label: s.name,
                        statusColor: '#10b981', // Green for valid
                    }))
            })),
            // Uncategorized (Top Level Sibling)
            ...(servers.filter(s => !s.group_id).length > 0 ? [{
                id: 'group:uncategorized',
                label: '未分组',
                icon: '', // Remove icon as requested
                isOpen: true,
                isCategory: true, // Mark as category
                children: servers.filter(s => !s.group_id).map(s => ({
                    id: `server:${s.id}`,
                    label: s.name,
                    statusColor: '#10b981'
                }))
            }] : [])
        ];

        // determine active ID
        let currentActiveId: string = activeView;
        if (activeView === 'terminal' && activeSessionId) {
            currentActiveId = `server:${activeSessionId}`; // 只是为了高亮当前会话对应的服务器（如果需要）
            // 或者保持 terminal 高亮？侧边栏里没有专门的 terminal 入口了，而是点击服务器直接进终端
        }

        const sidebarConfig = {
            title: 'VPS管理',
            items: sidebarItems,
            activeId: currentActiveId
        };

        window.parent.postMessage({
            type: 'PLUGIN_SET_SIDEBAR',
            payload: sidebarConfig
        }, '*');

    }, [activeView, servers, groups, activeSessionId]);

    // 初始化配置 (Removed simplified initial setup to avoid flash of wrong content, 
    // relying on the main effect which runs on mount too bc activeView is set)

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SIDEBAR_ITEM_CLICKED') {
                const itemId = event.data.payload.itemId;

                if (itemId.startsWith('server:')) {
                    const serverId = itemId.split(':')[1];
                    handleConnect(serverId);
                } else if (!itemId.startsWith('group:') && itemId !== 'server-list-header') {
                    // Ignore clicks on group headers if they handled by layout (which they are)
                    setActiveView(itemId as VPSView);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [servers, sessions]); // Add dependencies for handleConnect access if defined inside scope, 
    // but handleConnect uses state. Better to use ref or ensure handleMessage has access to latest.
    // Actually handleConnect is stable? No, it uses 'servers' and 'sessions' state.
    // So we need to re-bind listener or use functional state updates.
    // Re-binding listener on state change is expensive but safe.

    const fetchData = useCallback(async () => {
        try {
            const [serversRes, groupsRes] = await Promise.all([
                fetch(`/apps/vps/api/servers?_t=${Date.now()}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                }),
                fetch(`/apps/vps/api/groups?_t=${Date.now()}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                })
            ]);

            if (!serversRes.ok || !groupsRes.ok) throw new Error('Failed to fetch data');

            const serversData = await serversRes.json();
            const groupsData = await groupsRes.json();

            setServers(serversData);
            setGroups(groupsData);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Poll for status updates
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleConnect = (serverId: string) => {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;

        // Check if session already exists
        const existingSession = sessions.find(s => s.serverId === serverId);
        if (existingSession) {
            setActiveSessionId(existingSession.id);
            setActiveView('terminal');
        } else {
            // Create new session
            const newSession: Session = {
                id: serverId, // Simple 1:1 mapping
                serverId: serverId,
                serverName: server.name
            };
            setSessions(prev => [...prev, newSession]);
            setActiveSessionId(newSession.id);
            setActiveView('terminal');
        }
    };

    const handleCloseSession = (sessionId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();

        // Remove from state
        setSessions(prev => prev.filter(s => s.id !== sessionId));

        // If closing active session, switch to another or dashboard
        if (activeSessionId === sessionId) {
            const remaining = sessions.filter(s => s.id !== sessionId);
            if (remaining.length > 0) {
                setActiveSessionId(remaining[remaining.length - 1].id);
            } else {
                setActiveSessionId(null);
                setActiveView('dashboard');
            }
        }
    };

    const handleSaveServer = async (data: Partial<VpsServer>) => {
        try {
            if (editingServer) {
                await updateServer(editingServer.id, data);
            } else {
                await createServer(data);
            }

            await fetchData();
            setIsAddModalOpen(false);
            setEditingServer(null);
        } catch (err) {
            console.error('Failed to save server:', err);
            alert('Failed to save server');
        }
    };

    const handleDeleteServer = async (serverOrId: VpsServer | string) => {
        const server = typeof serverOrId === 'string'
            ? servers.find(s => s.id === serverOrId)
            : serverOrId;

        if (!server) return;

        if (!confirm(`Are you sure you want to delete ${server.name}?`)) return;

        try {
            const res = await fetch(`/apps/vps/api/servers/${server.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!res.ok) throw new Error('Failed to delete server');

            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to delete server');
        }
    };

    // Construct dynamic theme styles based on config
    const themeStyles = `
    :root {
        --theme-primary: ${config.theme?.primaryColor || '#f1404b'};
        --theme-bg: ${config.theme?.backgroundColor || '#f1f2f3'};
        --theme-text: ${config.theme?.textColor || '#444444'};
    }
    `;

    return (
        <div className={`min-h-screen bg-gray-50 flex flex-col ${isFixedLayout ? 'h-screen overflow-hidden' : ''}`}>
            <style>{themeStyles}</style>


            {/* Login Dialog */}
            {showLogin && (
                <LoginDialog
                    onClose={() => setShowLogin(false)}
                    onLogin={() => setShowLogin(false)}
                />
            )}

            <div className={`flex-1 flex relative ${isFixedLayout ? 'overflow-hidden' : ''}`}>
                {/* Main Content */}
                <div className={`flex-1 flex flex-col ${isFixedLayout ? 'overflow-x-hidden' : 'min-w-0'}`}>
                    {/* Tab Bar (Visible only when sessions exist) */}
                    {sessions.length > 0 && (
                        <div className="bg-white border-b border-gray-200 flex items-center px-2 pt-2 gap-2 overflow-x-auto flex-shrink-0">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => {
                                        setActiveSessionId(session.id);
                                        setActiveView('terminal');
                                    }}
                                    className={`
                                        group flex items-center gap-2 px-6 py-2 rounded-t-lg text-xs font-medium cursor-pointer transition-colors border-t border-l border-r min-w-[120px] justify-center
                                        ${activeSessionId === session.id
                                            ? 'bg-[var(--theme-primary)] border-[var(--theme-primary)] text-white relative -mb-px pb-2.5 z-10 shadow-sm'
                                            : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                        }
                                    `}
                                >
                                    <div className={`w-2 h-2 rounded-full bg-green-400 ${activeSessionId === session.id ? 'ring-2 ring-white/30' : ''}`}></div>
                                    <span className="max-w-[150px] truncate">{session.serverName}</span>
                                    <button
                                        onClick={(e) => handleCloseSession(session.id, e)}
                                        className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors opacity-0 group-hover:opacity-100 ${activeSessionId === session.id
                                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                                            : 'hover:bg-gray-200 text-gray-400 hover:text-red-500'
                                            }`}
                                    >
                                        <Icon icon="fa-solid fa-times" className="text-xs" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
                    <div className={`flex-1 relative ${isFixedLayout ? 'overflow-hidden' : ''}`}>
                        {/* dashboard */}
                        {activeView === 'dashboard' && (
                            <div className="p-6 lg:p-8">
                                <GlobalDashboard
                                    servers={servers}
                                    groups={groups}
                                    onConnect={handleConnect}
                                    onAddServer={() => {
                                        setEditingServer(null);
                                        setIsAddModalOpen(true);
                                    }}
                                    onEditServer={(server) => {
                                        setEditingServer(server);
                                        setIsAddModalOpen(true);
                                    }}
                                    onDeleteServer={(server) => handleDeleteServer(server)}
                                    onRefresh={fetchData}
                                />
                            </div>
                        )}

                        {/* servers */}
                        {activeView === 'servers' && (
                            <div className="p-6 lg:p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Servers</h1>
                                        <p className="text-gray-500 text-sm mt-1">Manage your VPS instances</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingServer(null);
                                            setIsAddModalOpen(true);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        <Icon icon="fa-solid fa-plus" />
                                        <span>Add Server</span>
                                    </button>
                                </div>
                                <ServerList
                                    servers={servers}
                                    groups={groups}
                                    onConnect={handleConnect}
                                    onEdit={(server) => {
                                        setEditingServer(server);
                                        setIsAddModalOpen(true);
                                    }}
                                    onDelete={handleDeleteServer}
                                />
                            </div>
                        )}


                        {/* Snippet Library */}
                        {activeView === 'snippets' && (
                            <div className="h-full flex flex-col p-6 lg:p-8">
                                <div className="mb-6 max-w-[1600px] mx-auto w-full">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">指令库</h1>
                                    <p className="text-gray-500 text-sm mt-1">管理和运行常用脚本</p>
                                </div>
                                <div className="flex-1 max-w-[1600px] mx-auto w-full">
                                    <SnippetLibrary />
                                </div>
                            </div>
                        )}

                        {/* Files */}
                        {activeView === 'files' && (
                            <div className="h-full flex flex-col p-6 lg:p-8">
                                {/* FileManager placeholder */}
                                <div className="text-center text-gray-500 mt-10">
                                    <h2 className="text-xl font-bold">文件管理功能升级中</h2>
                                    <p>请稍候...</p>
                                </div>
                            </div>
                        )}

                        {/* Server Sessions (Terminals) */}
                        {sessions.map(session => {
                            const server = servers.find(s => s.id === session.serverId);
                            if (!server) return null;

                            const isActive = activeView === 'terminal' && activeSessionId === session.id;

                            return (
                                <div
                                    key={session.id}
                                    className={`h-full w-full flex-1 bg-white ${isActive ? 'block' : 'hidden'}`}
                                >
                                    <ServerTerminalView
                                        serverId={session.serverId}
                                        serverName={session.serverName}
                                        onClose={() => handleCloseSession(session.id)}
                                        server={server}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Modals */}
                {isAddModalOpen && (
                    <ServerFormModal
                        isOpen={isAddModalOpen}
                        onClose={() => {
                            setIsAddModalOpen(false);
                            setEditingServer(null);
                        }}
                        onSave={handleSaveServer}
                        initialData={editingServer || undefined}
                        groups={groups}
                    />
                )}
            </div>
        </div>
    );
}

export default function App() {
    return (
        <ConfigProvider>
            <VPSAppContent />
        </ConfigProvider>
    );
}
