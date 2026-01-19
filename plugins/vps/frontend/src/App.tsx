import React, { useState, useEffect, useCallback } from 'react';
import GlobalDashboard from './components/GlobalDashboard';
import ServerList from './components/ServerList';
import SnippetLibrary from './components/SnippetLibrary';
import ServerTerminalView from './components/ServerTerminalView';
import ServerFormModal from './components/ServerFormModal';
import VPSSidebar, { VPSView } from './components/VPSSidebar';
import { useConfig } from '@/shared/context/ConfigContext';
import { VpsServer, VpsGroup } from './types';
import { createServer, updateServer, getServers, getGroups, deleteServer } from './api';
import { Icon } from '@/shared/components/common/Icon';
import { ConfigProvider } from '@/shared/context/ConfigContext';
// @ts-ignore
import LoginDialog from '@/shared/components/common/LoginDialog';
import { ConfirmModal } from './components/common/ConfirmModal';

// iframe模式: 从URL获取token
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
    localStorage.setItem('auth_token', urlToken);
    console.log('[VPS] Token received from iframe parent');
}

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
    const [serverToDelete, setServerToDelete] = useState<VpsServer | null>(null);

    // Session Management
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // 侧边栏状态
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    // 主题管理
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('vps_theme') as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('vps_theme', theme);

        // 同步主题到主应用
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'PLUGIN_THEME_CHANGED',
                payload: { theme }
            }, '*');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // 发送空 Sidebar 配置到主应用（使用插件内部侧边栏）
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        let count = 0;
        const maxAttempts = 5; // 尝试 5 次

        const sendMessage = () => {
            // 发送空侧边栏配置
            window.parent.postMessage({
                type: 'PLUGIN_SET_SIDEBAR',
                payload: {
                    title: 'VPS管理',
                    subtitle: '服务器管理与终端',
                    items: [],
                    activeId: ''
                }
            }, '*');

            // 请求隐藏 Header（默认仅移动端隐藏，桌面端保持显示）
            window.parent.postMessage({
                type: 'PLUGIN_REQUEST_HIDE_HEADER',
                payload: { hideHeader: false }
            }, '*');

            count++;
            if (count < maxAttempts) {
                setTimeout(sendMessage, 500);
            }
        };

        sendMessage();
    }, []);

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
            const [serversData, groupsData] = await Promise.all([
                getServers(),
                getGroups()
            ]);

            // 防御性检查：确保数据是数组
            setServers(Array.isArray(serversData) ? serversData : []);
            setGroups(Array.isArray(groupsData) ? groupsData : []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            // 发生错误时设置为空数组，避免组件崩溃
            setServers([]);
            setGroups([]);
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

        try {
            await deleteServer(server.id);
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
    }
    `;

    return (
        <div className={`h-screen bg-[var(--theme-bg)] flex overflow-hidden text-[var(--theme-text)] transition-colors duration-300`}>
            <style>{themeStyles}</style>

            {/* VPS 内部侧边栏 */}
            <VPSSidebar
                activeView={activeView}
                onViewChange={setActiveView}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
                collapsed={collapsed}
                toggleCollapsed={() => setCollapsed(!collapsed)}
                servers={servers}
                groups={groups}
                onConnect={handleConnect}
                activeServerId={activeSessionId}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            {/* Login Dialog */}
            {showLogin && (
                <LoginDialog
                    onClose={() => setShowLogin(false)}
                    onLogin={() => setShowLogin(false)}
                />
            )}

            {/* 主内容区域 */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* 移动端顶部栏 */}
                <div className="lg:hidden sticky top-0 z-20 bg-[var(--sidebar-bg)] border-b border-[var(--border-color)] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="p-2 text-gray-400 hover:text-[var(--theme-text)] hover:bg-gray-500/10 rounded-lg transition-colors"
                            >
                                <Icon icon="fa-solid fa-bars" className="text-lg" />
                            </button>
                            <h1 className="text-lg font-bold text-[var(--theme-text)]">VPS管理</h1>
                        </div>
                        {activeSessionId && (
                            <span className="flex items-center gap-1.5 text-sm text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="max-w-[100px] truncate">
                                    {sessions.find(s => s.id === activeSessionId)?.serverName}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 内容区域 */}
                <div className={`flex-1 flex flex-col ${isFixedLayout ? 'overflow-hidden' : 'overflow-y-auto'} bg-[var(--theme-bg)]`}>
                    {/* Tab Bar (Visible only when sessions exist) */}
                    {sessions.length > 0 && (
                        <div className="bg-[var(--sidebar-bg)] border-b border-[var(--border-color)] flex items-center px-2 pt-2 gap-2 overflow-x-auto flex-shrink-0">
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
                                            : 'bg-[var(--sidebar-bg)] border-[var(--border-color)] text-gray-400 hover:bg-gray-500/5 hover:text-[var(--theme-text)]'
                                        }
                                    `}
                                >
                                    <div className={`w-2 h-2 rounded-full bg-green-400 ${activeSessionId === session.id ? 'ring-2 ring-white/30' : ''}`}></div>
                                    <span className="max-w-[150px] truncate">{session.serverName}</span>
                                    <button
                                        onClick={(e) => handleCloseSession(session.id, e)}
                                        className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors opacity-0 group-hover:opacity-100 ${activeSessionId === session.id
                                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                                            : 'hover:bg-gray-500/10 text-gray-400 hover:text-red-500'
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
                                    onDeleteServer={(server) => setServerToDelete(server)}
                                    onRefresh={fetchData}
                                />
                            </div>
                        )}

                        {/* servers */}
                        {activeView === 'servers' && (
                            <div className="p-6 lg:p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-bold">Servers</h1>
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
                                    onDelete={(serverId) => {
                                        const server = servers.find(s => s.id === serverId);
                                        if (server) setServerToDelete(server);
                                    }}
                                />
                            </div>
                        )}


                        {/* Snippet Library */}
                        {activeView === 'snippets' && (
                            <div className="h-full flex flex-col p-6 lg:p-8">
                                <div className="mb-6 max-w-[1600px] mx-auto w-full">
                                    <h1 className="text-2xl sm:text-3xl font-bold">指令库</h1>
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
                                    className={`h-full w-full flex-1 ${isActive ? 'block' : 'hidden'}`}
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

                <ConfirmModal
                    isOpen={!!serverToDelete}
                    onClose={() => setServerToDelete(null)}
                    onConfirm={() => serverToDelete && handleDeleteServer(serverToDelete)}
                    title="删除服务器"
                    message={`确定要删除服务器 ${serverToDelete?.name} 吗？此操作无法撤销。`}
                />
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
