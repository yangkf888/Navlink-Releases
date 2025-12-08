import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Icon } from './common/Icon';

interface WebTerminalProps {
    serverId: string;
    serverName: string;
    onClose: () => void;
    contained?: boolean;
}

export interface WebTerminalRef {
    send: (data: string) => void;
}

const WebTerminal = forwardRef<WebTerminalRef, WebTerminalProps>(
    ({ serverId, serverName, onClose, contained = false }, ref) => {
        const terminalRef = useRef<HTMLDivElement>(null);
        const wsRef = useRef<WebSocket | null>(null);
        const xtermRef = useRef<Terminal | null>(null);
        const fitAddonRef = useRef<FitAddon | null>(null);
        const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');


        // Expose send method to parent
        useImperativeHandle(ref, () => ({
            send: (data: string) => {
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const encoder = new TextEncoder();
                    ws.send(encoder.encode(data));
                }
            }
        }));

        useEffect(() => {
            if (!terminalRef.current) return;

            let isMounted = true;
            let fitTimeout: NodeJS.Timeout;

            // Initialize xterm.js matching old UI style
            const term = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#ffffff',
                },
                allowProposedApi: true
            });

            const fitAddon = new FitAddon();
            const webLinksAddon = new WebLinksAddon();

            term.loadAddon(fitAddon);
            term.loadAddon(webLinksAddon);

            // Wait for container to have dimensions before opening terminal
            // This prevents "Cannot read properties of undefined (reading 'dimensions')" error
            const openTerminal = () => {
                if (!isMounted) return;

                const el = terminalRef.current;
                if (el && el.clientWidth > 0) {
                    try {
                        term.open(el);
                        // Initial fit after open
                        fitTimeout = setTimeout(() => {
                            if (!isMounted || !xtermRef.current) return;
                            try {
                                fitAddon.fit();
                                // Send resize to backend
                                const dims = fitAddon.proposeDimensions();
                                if (dims && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                    // FIXME: Backend blindly pipes all input to SSH stdin, causing this JSON to be echoed as garbage.
                                    // Disabled until backend is rebuilt with proper message type handling.
                                    /*
                                    wsRef.current.send(JSON.stringify({
                                        type: 'resize',
                                        cols: dims.cols,
                                        rows: dims.rows
                                    }));
                                    */
                                }
                            } catch (e) {
                                console.warn('Fit error:', e);
                            }
                        }, 100);
                    } catch (e) {
                        console.error('Terminal open error:', e);
                    }
                } else {
                    // Retry in next frame
                    requestAnimationFrame(openTerminal);
                }
            };

            requestAnimationFrame(openTerminal);

            // Initial fit handled in openTerminal

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            term.writeln('Connecting to server...');

            // Resize Observer to handle container size changes (window resize or sidebar toggle)
            const resizeObserver = new ResizeObserver(() => {
                if (fitAddonRef.current && wsRef.current) {
                    try {
                        fitAddonRef.current.fit();
                        const dims = fitAddonRef.current.proposeDimensions();
                        if (dims && wsRef.current.readyState === WebSocket.OPEN) {
                            // FIXME: Backend blindly pipes all input to SSH stdin, causing this JSON to be echoed as garbage.
                            // Disabled until backend is rebuilt with proper message type handling.
                            /*
                            wsRef.current.send(JSON.stringify({
                                type: 'resize',
                                cols: dims.cols,
                                rows: dims.rows
                            }));
                            */
                        }
                    } catch (e) {
                        console.warn('Fit error:', e);
                    }
                }
            });

            if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
            }

            // Connect WebSocket
            // Connect through Vite proxy to gateway
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const token = localStorage.getItem('auth_token') || '';
            const wsUrl = `${protocol}//${window.location.host}/api/plugins/vps/ws?type=terminal&serverId=${serverId}&token=${encodeURIComponent(token)}`;

            console.log('Connecting to Terminal WS:', wsUrl.replace(token, '***'));
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMounted) {
                    ws.close();
                    return;
                }
                console.log('WS Connected');
                setStatus('connected');
                term.writeln('\r\nConnected.\r\n');
                term.focus();
                // Fit again on connect
                if (fitAddonRef.current) {
                    fitAddonRef.current.fit();
                    const dims = fitAddonRef.current.proposeDimensions();
                    if (dims) {
                        // FIXME: Backend blindly pipes all input to SSH stdin, causing this JSON to be echoed as garbage.
                        // Disabled until backend is rebuilt with proper message type handling.
                        /*
                        ws.send(JSON.stringify({
                            type: 'resize',
                            cols: dims.cols,
                            rows: dims.rows
                        }));
                        */
                    }
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                // Handle incoming data (ArrayBuffer or String)
                if (typeof event.data === 'string') {
                    term.write(event.data);
                } else {
                    // ArrayBuffer
                    term.write(new Uint8Array(event.data as ArrayBuffer));
                }
            };

            ws.onclose = (event) => {
                if (!isMounted) return;
                console.log('WS Closed', event);
                setStatus('disconnected');
                if (event.code !== 1000) { // 1000 is normal closure
                    term.writeln(`\r\n\x1b[31mConnection closed unexpectedly (Code: ${event.code}).\x1b[0m`);
                } else {
                    term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
                }
            };

            ws.onerror = (event) => {
                if (!isMounted) return;
                console.error('WS Error', event);
                setStatus('error');
                term.writeln('\r\n\x1b[31mConnection error.\x1b[0m');
            };

            // Handle Terminal Input
            const disposable = term.onData((data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    // Send as Binary Frame to avoid UTF-8 validation issues
                    const encoder = new TextEncoder();
                    ws.send(encoder.encode(data));
                }
            });

            // Handle Resize
            const handleResize = () => {
                if (!isMounted || !fitAddonRef.current) return;
                try {
                    fitAddonRef.current.fit();
                } catch (e) {
                    console.warn('Resize fit error:', e);
                }
            };
            window.addEventListener('resize', handleResize);

            return () => {
                isMounted = false;
                clearTimeout(fitTimeout);
                window.removeEventListener('resize', handleResize);
                disposable.dispose(); // Dispose xterm listener

                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }

                // Dispose terminal last
                try {
                    term.dispose();
                } catch (e) {
                    console.warn('Terminal dispose error:', e);
                }

                xtermRef.current = null;
                fitAddonRef.current = null;
                wsRef.current = null;
            };
        }, [serverId]);

        const containerClasses = contained
            ? "w-full h-full flex flex-col bg-[#1e1e1e]"
            : "fixed inset-0 bg-black z-50 flex flex-col animate-fade-in";

        return (
            <div className={containerClasses}>
                <style>{`
                    .xterm-viewport::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {/* Toolbar */}
                <div className="bg-[#2d2d2d] px-4 py-2 flex justify-between items-center border-b border-[#3d3d3d] flex-none">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-gray-300 text-sm font-mono">{serverName} - SSH Terminal</span>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <Icon icon="fa-solid fa-times" />
                        </button>
                    )}
                </div>

                {/* Terminal Container */}
                <div className={`flex-1 overflow-hidden px-2 pt-2 pb-8 transition-opacity duration-200 ${status === 'connecting' ? 'opacity-0' : 'opacity-100'}`} ref={terminalRef} />
            </div>
        );
    }
);

WebTerminal.displayName = 'WebTerminal';

export default WebTerminal;
