import { useState, useEffect, useRef } from 'react';
import WebTerminal, { WebTerminalRef } from './WebTerminal';
import Dashboard from './Dashboard';
import FileManager from './FileManager';
import SnippetLibrary from './SnippetLibrary';
import { Icon } from './common/Icon';
import { VpsServer } from '../types';

interface ServerTerminalViewProps {
    serverId: string;
    serverName: string;
    onClose: () => void;
    server: VpsServer;
}

export default function ServerTerminalView({ serverId, serverName, onClose, server }: ServerTerminalViewProps) {
    const terminalRef = useRef<WebTerminalRef>(null);

    // Panel Visibility State
    const [showFileManager, setShowFileManager] = useState(true);
    const [showSnippets, setShowSnippets] = useState(true);
    const [showMonitoring, setShowMonitoring] = useState(true);

    // Monitoring & Control WebSocket
    const [stats, setStats] = useState<any>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Establish Control Connection for Monitoring & SFTP
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('auth_token') || '';
        const wsUrl = `${protocol}//${window.location.host}/api/apps/vps/ws?type=control&serverId=${serverId}&token=${encodeURIComponent(token)}`;

        console.log('Connecting to Control WS:', wsUrl.replace(token, '***'));
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Control WS Connected');
            setIsConnected(true);
            setWs(socket);
            // Start monitoring
            socket.send(JSON.stringify({ type: 'monitor:start' }));
        };

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'monitor:data') {
                    setStats(msg.data);
                }
            } catch (e) {
                console.error('Failed to parse control message:', e);
            }
        };

        socket.onclose = () => {
            console.log('Control WS Closed');
            setIsConnected(false);
            setWs(null);
        };

        socket.onerror = (err) => {
            console.error('Control WS Error:', err);
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'monitor:stop' }));
                socket.close();
            }
        };
    }, [serverId]);

    const leftColWidth = showFileManager ? 'clamp(250px, 20%, 400px)' : '40px';
    const rightColWidth = showSnippets ? 'clamp(250px, 20%, 400px)' : '40px';

    return (
        <div
            className="h-full w-full grid bg-gray-100 overflow-hidden"
            style={{ gridTemplateColumns: `${leftColWidth} 1fr ${rightColWidth}` }}
        >
            {/* Left Column: File Manager */}
            <div className="flex flex-col border-r border-gray-200 bg-white h-full overflow-hidden">
                <div className={`border-b border-gray-100 bg-gray-50 flex items-center ${showFileManager ? 'justify-between px-3 py-2' : 'justify-center py-2'}`}>
                    {showFileManager ? (
                        <>
                            <span className="font-bold text-gray-700 text-sm">文件管理</span>
                            <button
                                onClick={() => setShowFileManager(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200"
                                title="收起"
                            >
                                <Icon icon="fa-solid fa-chevron-left" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowFileManager(true)}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
                            title="展开"
                        >
                            <Icon icon="fa-solid fa-folder" />
                        </button>
                    )}
                </div>

                {showFileManager ? (
                    <div className="flex-1 overflow-hidden">
                        <FileManager ws={ws} isConnected={isConnected} />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center pt-4 gap-4">
                        <button
                            onClick={() => setShowFileManager(true)}
                            className="vertical-rl text-xs text-gray-400 hover:text-blue-600 font-medium tracking-widest cursor-pointer"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            文件管理
                        </button>
                    </div>
                )}
            </div>

            {/* Center Column: Terminal + Monitoring */}
            <div className="flex flex-col min-w-0 h-full overflow-hidden">
                {/* Top: Terminal */}
                <div
                    className={`relative bg-[#1e1e1e] overflow-hidden ${showMonitoring ? '' : 'flex-1'}`}
                    style={showMonitoring ? { flex: 8 } : {}}
                >
                    <WebTerminal
                        ref={terminalRef}
                        serverId={serverId}
                        serverName={serverName}
                        onClose={onClose}
                        contained={true}
                    />
                </div>

                {/* Bottom: Monitoring */}
                <div
                    className={`bg-white border-t border-gray-200 overflow-hidden flex flex-col ${showMonitoring ? '' : 'h-9 flex-none'}`}
                    style={showMonitoring ? { flex: 2 } : {}}
                >
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center h-9 flex-none">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 text-sm">实时监控</span>
                            {!showMonitoring && stats && (
                                <span className="text-xs font-mono text-gray-400 ml-2">
                                    CPU: {stats.cpu?.usage}% | RAM: {stats.mem?.usedPercentage}%
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {showMonitoring && stats && (
                                <span className="text-xs font-mono text-gray-500 mr-2">
                                    Up: {(stats.net?.up / 1024).toFixed(1)} KB/s | Down: {(stats.net?.down / 1024).toFixed(1)} KB/s
                                </span>
                            )}
                            <button
                                onClick={() => setShowMonitoring(!showMonitoring)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200"
                                title={showMonitoring ? "收起" : "展开"}
                            >
                                <Icon icon={showMonitoring ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up"} />
                            </button>
                        </div>
                    </div>
                    {showMonitoring && (
                        <div className="flex-1 p-4 overflow-y-auto">
                            <Dashboard stats={stats} server={server} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Snippets */}
            <div className="flex flex-col bg-white border-l border-gray-200 h-full overflow-hidden">
                <div className={`border-b border-gray-100 bg-gray-50 flex items-center ${showSnippets ? 'justify-between px-3 py-2' : 'justify-center py-2'}`}>
                    {showSnippets ? (
                        <>
                            <span className="font-bold text-gray-700 text-sm">快捷指令</span>
                            <button
                                onClick={() => setShowSnippets(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200"
                                title="收起"
                            >
                                <Icon icon="fa-solid fa-chevron-right" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowSnippets(true)}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
                            title="展开"
                        >
                            <Icon icon="fa-solid fa-terminal" />
                        </button>
                    )}
                </div>

                {showSnippets ? (
                    <div className="flex-1 overflow-hidden">
                        <SnippetLibrary
                            variant="sidebar"
                            onRun={(cmd) => terminalRef.current?.send(cmd + '\n')}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center pt-4 gap-4">
                        <button
                            onClick={() => setShowSnippets(true)}
                            className="vertical-rl text-xs text-gray-400 hover:text-blue-600 font-medium tracking-widest cursor-pointer"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            快捷指令
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
