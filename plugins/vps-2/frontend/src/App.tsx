import { useState, useEffect, useCallback } from 'react';
import { VpsServer, VpsGroup } from './types';
import GlobalDashboard from './components/GlobalDashboard';
import ServerTerminalView from './components/ServerTerminalView';
import ServerFormModal from './components/ServerFormModal';
import VPSSidebar, { VPSView } from './components/VPSSidebar';
import SnippetLibrary from './components/SnippetLibrary';
import { Icon } from '../../../../src/shared/components/common/Icon';
import { ConfigProvider, useConfig } from '../../../../src/shared/context/ConfigContext';
import TopNavbar from '../../../../src/shared/components/layout/TopNavbar';
// @ts-ignore - LoginDialog is JS file
import LoginDialog from '../../../../src/shared/components/common/LoginDialog';

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
    const { config, isAuthenticated, logout } = useConfig();
    const [servers, setServers] = useState<VpsServer[]>([]);
    const [groups, setGroups] = useState<VpsGroup[]>([]);

    // Layout State
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [activeView, setActiveView] = useState<VPSView>('overview');
    const [showLogin, setShowLogin] = useState(false);

    // Determine if we should use fixed layout (for terminal) or window scroll (for others)
    const isFixedLayout = activeView === 'terminal';

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<VpsServer | null>(null);

    // Session Management
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [serversRes, groupsRes] = await Promise.all([
                fetch(`./api/servers?_t=${Date.now()}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                }),
                fetch(`./api/groups?_t=${Date.now()}`, {
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
    }, []);

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

        // If closing active session, switch to another or overview
        if (activeSessionId === sessionId) {
            const remaining = sessions.filter(s => s.id !== sessionId);
            if (remaining.length > 0) {
                setActiveSessionId(remaining[remaining.length - 1].id);
            } else {
                setActiveSessionId(null);
                setActiveView('overview');
            }
        }
    };

    const handleSaveServer = async (data: Partial<VpsServer>) => {
        try {
            const url = editingServer
                ? `/api/servers/${editingServer.id}`
                : '/api/servers';

            const method = editingServer ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) throw new Error('Failed to save server');

            await fetchData();
            setIsAddModalOpen(false);
            setEditingServer(null);
        } catch (err) {
            alert('Failed to save server');
        }
    };

    const handleDeleteServer = async (server: VpsServer) => {
        if (!confirm(`Are you sure you want to delete ${server.name}?`)) return;

        try {
            const res = await fetch(`./api/servers/${server.id}`, {
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

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            // Manage account or show status
        } else {
            setShowLogin(true);
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

            {/* Shared Top Navbar */}
            <div className="relative z-50">
                <TopNavbar
                    config={config}
                    toggleSidebar={() => setMobileOpen(!mobileOpen)}
                    mobileOpen={mobileOpen}
                    onUserClick={handleUserIconClick}
                    onLogout={logout}
                    isAuthenticated={isAuthenticated}
                    onSearchClick={() => { }}
                    forceDarkText={true}
                />
            </div>

            {/* Login Dialog */}
            {showLogin && (
                <LoginDialog
                    onClose={() => setShowLogin(false)}
                    onLogin={() => setShowLogin(false)}
                />
            )}

            <div className={`flex-1 flex relative pt-16 ${isFixedLayout ? 'overflow-hidden' : ''}`}>
                {/* Sidebar - Always Visible */}
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
                    activeServerId={activeSessionId ? sessions.find(s => s.id === activeSessionId)?.serverId || null : null}
                />

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
                                    <div className={`w-2 h-2 rounded-full bg-green-400 ${activeSessionId === session.id ? 'ring-2 ring-white/30' : ''} `}></div>
                                    <span className="max-w-[150px] truncate">{session.serverName}</span>
                                    <button
                                        onClick={(e) => handleCloseSession(session.id, e)}
                                        className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors opacity-0 group-hover:opacity-100 ${activeSessionId === session.id
                                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                                            : 'hover:bg-gray-200 text-gray-400 hover:text-red-500'
                                            } `}
                                    >
                                        <Icon icon="fa-solid fa-times" className="text-xs" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
                    <div className={`flex-1 relative ${isFixedLayout ? 'overflow-hidden' : ''}`}>
                        {/* Overview */}
                        {activeView === 'overview' && (
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

                        {/* Snippet Library */}
                        {activeView === 'snippets' && (
                            <div className="h-full flex flex-col p-6 lg:p-8">
                                <div className="mb-6 max-w-[1600px] mx-auto w-full">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">脚本库</h1>
                                    <p className="text-gray-500 text-sm mt-1">管理和运行常用脚本</p>
                                </div>
                                <div className="flex-1 max-w-[1600px] mx-auto w-full">
                                    <SnippetLibrary />
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
    // Cast to any to avoid React version mismatch type errors
    const ConfigProviderAny = ConfigProvider as any;

    return (
        <ConfigProviderAny>
            <VPSAppContent />
        </ConfigProviderAny>
    );
}
