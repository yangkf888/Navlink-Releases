const WebSocket = require('ws');
const { Client } = require('ssh2');
const { NodeSSH } = require('node-ssh'); // For control connection (monitoring + sftp)
const SftpClient = require('ssh2-sftp-client');
const vpsService = require('./services/vpsService');
const url = require('url');
const cryptoUtils = require('./utils/crypto');

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', async (ws, req) => {
    console.log('[VPS WS] =====  NEW CONNECTION =====');
    console.log('[VPS WS] Request URL:', req.url);

    const parameters = url.parse(req.url, true);
    const query = parameters.query;
    const type = query.type; // 'terminal' or 'control'
    const serverId = query.serverId;

    console.log('[VPS WS] Parsed params - type:', type, 'serverId:', serverId);

    if (!serverId) {
        console.log('[VPS WS] ERROR: No serverId provided');
        ws.close(1008, 'Server ID required');
        return;
    }

    console.log(`[VPS WS] New connection type=${type} serverId=${serverId}`);

    let sftp = new SftpClient();
    let monitorInterval = null;

    try {
        // CRITICAL: Pass includeSecrets=true to get decrypted password/privateKey
        const server = await vpsService.getServerById(serverId, true);
        if (!server) {
            console.log('[VPS WS] Server not found:', serverId);
            ws.close(1008, 'Server not found');
            return;
        }

        // Decrypt password/key
        // Note: vpsService.getServerById returns decrypted password if we modify it or we use cryptoUtils here.
        // vpsService.getServerById usually returns raw rows. vpsService.js logic suggests it returns row.
        // We need to decrypt if it's encrypted.
        // Let's check vpsService.js... assume it returns raw DB row.
        // Actually vpsService.js methods usually don't decrypt automatically on get, only verifyPassword does.
        // We will maintain simple logic: try to use the password/key directly or decrypt.
        // Looking at vpsService.js (from viewed files), it imports cryptoUtils.
        // Ideally we should have a helper to get credentials.

        let config = {
            host: server.host,
            port: server.port || 22,
            username: server.username,
            // 提高稳定性与兼容性
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            debug: (msg) => console.log(`[SSH Debug ${serverId}]`, msg)
        };


        if (server.auth_type === 'password') {
            try {
                config.password = cryptoUtils.decrypt(server.password);
            } catch (e) {
                config.password = server.password;
            }
        } else if (server.auth_type === 'key') {
            try {
                config.privateKey = cryptoUtils.decrypt(server.private_key);
            } catch (e) {
                config.privateKey = server.private_key;
            }
        }

        if (type === 'terminal') {
            let sshClient = null;
            let isRetry = false;

            const setupClientListeners = () => {
                sshClient.on('ready', () => {
                    console.log('[VPS WS] SSH Client ready');

                    // Request shell
                    sshClient.shell({
                        term: 'xterm-256color',
                        cols: 80,
                        rows: 24
                    }, (err, stream) => {
                        if (err) {
                            console.error('[VPS WS] Shell error:', err);
                            ws.close(1011, 'Shell error: ' + err.message);
                            return;
                        }

                        console.log('[VPS WS] Shell established');

                        // Pipe data from shell to WebSocket
                        stream.on('data', (data) => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(data.toString('utf-8'));
                            }
                        });

                        stream.on('close', () => {
                            console.log('[VPS WS] Shell closed');
                            ws.close();
                            sshClient.end();
                        });

                        // Pipe data from WebSocket to shell
                        ws.on('message', (data) => {
                            if (stream.writable) {
                                stream.write(data);
                            }
                        });
                    });
                });

                sshClient.on('error', (err) => {
                    console.error('[VPS WS] SSH Connection Error:', err.message);

                    // Retry with keyboard-interactive only if first attempt failed
                    if (err.message.includes('All configured authentication methods failed') && !isRetry && config.password) {
                        console.log('[VPS WS] Auth failed, retrying with keyboard-interactive only...');
                        isRetry = true;
                        connectSSH(true);
                        return;
                    }

                    ws.close(1011, 'Connection error: ' + err.message);
                });

                sshClient.on('close', () => {
                    console.log('[VPS WS] SSH connection closed');
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                });

                sshClient.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                    console.log(`[VPS WS] keyboard-interactive triggered. Name: ${name}, Prompts: ${prompts.length}`);
                    if (prompts.length > 0 && config.password) {
                        // 某些 PAM 配置下 prompt 可能包含 'password' 关键字以外的提示
                        console.log(`[VPS WS] Responding to prompt: ${prompts[0].prompt}`);
                        finish([config.password]);
                    } else {
                        finish([]);
                    }
                });
            };

            const connectSSH = (forceKeyboardInteractive = false) => {
                // Clean up previous client if exists
                if (sshClient) {
                    sshClient.removeAllListeners();
                    sshClient.end();
                }

                sshClient = new Client();
                setupClientListeners();

                const connectionConfig = {
                    ...config, // 包含 algorithms, readyTimeout, keepaliveInterval 等
                    tryKeyboard: true,
                };

                if (server.auth_type === 'password' && config.password && !forceKeyboardInteractive) {
                    connectionConfig.password = config.password;
                } else if (server.auth_type === 'key' && config.privateKey) {
                    connectionConfig.privateKey = config.privateKey;
                }

                console.log(`[VPS WS] Connecting... (Force Keyboard: ${forceKeyboardInteractive})`);
                sshClient.connect(connectionConfig);
            };

            // Initial connection
            connectSSH(false);

            ws.on('close', () => {
                console.log('[VPS WS] WebSocket closed');
                if (sshClient) {
                    sshClient.end();
                }
            });

        } else if (type === 'control') {
            console.log(`[VPS WS] Control: Initiating heavy-duty stable connection for ${serverId}`);
            const sshClient = new Client();

            // 资源锁定上下文：管理所有异步资源的生命周期
            const controlCtx = {
                sftp: null,
                monitor: null,
                isClosing: false,
                serverId: serverId
            };

            // 统一资源清理函数
            const cleanup = () => {
                if (controlCtx.isClosing) return;
                controlCtx.isClosing = true;
                console.log(`[VPS WS] Control: Deep cleaning resources for ${serverId}`);
                if (controlCtx.monitor) clearInterval(controlCtx.monitor);
                if (controlCtx.sftp) try { controlCtx.sftp.end(); } catch (e) { }
                try { sshClient.end(); } catch (e) { }
            };

            sshClient.on('ready', () => {
                console.log(`[VPS WS] Control: SSH Ready for ${serverId}. Parallelizing subsystems...`);

                // 1. 预热 SFTP (并行 A)
                sshClient.sftp((err, sftp) => {
                    if (err) {
                        console.error('[VPS WS] SFTP heating failed:', err.message);
                    } else {
                        controlCtx.sftp = sftp;
                        console.log('[VPS WS] SFTP engine warmed up');
                    }
                });

                // 2. 默认就绪信号 (并行 B)
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'control:ready' }));
                }

                // 3. 监控延时自启动 (并行 C) - 给 SFTP 留出握手空间
                setTimeout(async () => {
                    if (controlCtx.isClosing || ws.readyState !== WebSocket.OPEN) return;

                    const { getSystemInfo } = require('./utils/sshMonitor');
                    let prevNetStats = null;
                    let prevNetTime = Date.now();

                    controlCtx.monitor = setInterval(async () => {
                        if (controlCtx.isClosing || ws.readyState !== WebSocket.OPEN) return;

                        try {
                            const execPromise = (cmd) => new Promise((resolve) => {
                                if (controlCtx.isClosing) return resolve({ stdout: '', stderr: 'Closing' });
                                sshClient.exec(cmd, (err, stream) => {
                                    if (err) return resolve({ stdout: '', stderr: err.message });
                                    let stdout = '';
                                    stream.on('data', (d) => { stdout += d.toString(); });
                                    stream.stderr.on('data', () => { }); // 消耗 stderr 防止阻塞
                                    stream.on('close', () => resolve({ stdout: stdout.trim() }));
                                    // 容错：防止 stream 挂死
                                    setTimeout(() => { try { stream.destroy(); } catch (e) { } }, 5000);
                                });
                            });

                            // 获取秒级 CPU 和网速
                            const [cpuRes, netRes] = await Promise.all([
                                execPromise("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'"),
                                execPromise("cat /proc/net/dev | grep -E '(eth0|ens|enp|eno|eth1)' | head -1")
                            ]);

                            const systemInfo = await getSystemInfo({ execCommand: execPromise });
                            if (!systemInfo || controlCtx.isClosing) return;

                            const mem = JSON.parse(systemInfo.mem_info || '{}');
                            const disk = JSON.parse(systemInfo.disk_info || '{}');

                            let netUp = 0, netDown = 0;
                            if (netRes.stdout) {
                                const parts = netRes.stdout.trim().split(/\s+/);
                                if (parts.length >= 10) {
                                    const rx = parseInt(parts[1]) || 0;
                                    const tx = parseInt(parts[9]) || 0;
                                    if (prevNetStats) {
                                        const dt = (Date.now() - prevNetTime) / 1000;
                                        if (dt > 0) {
                                            netDown = (rx - prevNetStats.rx) / dt;
                                            netUp = (tx - prevNetStats.tx) / dt;
                                        }
                                    }
                                    prevNetStats = { rx, tx };
                                    prevNetTime = Date.now();
                                }
                            }

                            // 🚨 严格对齐 Git 历史稳定版 (0c716fb) 的协议结构
                            const formattedData = {
                                cpu: parseFloat(cpuRes.stdout) || 0, // 稳定版是直接数字，不是对象！
                                mem: {
                                    used: mem.used || 0,
                                    total: mem.total || 0
                                },
                                disk: disk.usedPercentage || 0,     // 稳定版是直接数字！
                                net: {
                                    up: netUp || 0,
                                    down: netDown || 0
                                }
                            };

                            if (ws.readyState === WebSocket.OPEN) {
                                try {
                                    ws.send(JSON.stringify({ type: 'monitor:data', data: formattedData }));
                                } catch (e) { }
                            }
                        } catch (e) {
                            console.error('[VPS WS] Monitor logic error:', e.message);
                        }
                    }, 2000);
                }, 1500); // 延时 1.5 秒启动监控
            });

            sshClient.on('error', (err) => {
                console.error(`[VPS WS] SSH Master Error [${serverId}]:`, err.message);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'control:error', message: err.message }));
                }
                cleanup();
            });

            sshClient.on('close', cleanup);
            ws.on('close', cleanup);

            // 连接参数
            const connectionConfig = { ...config, tryKeyboard: true };
            if (server.auth_type === 'password' && config.password) {
                connectionConfig.password = config.password;
            } else if (server.auth_type === 'key' && config.privateKey) {
                connectionConfig.privateKey = config.privateKey;
            }

            sshClient.connect(connectionConfig);

            ws.on('message', async (message) => {
                try {
                    const msg = JSON.parse(message);

                    // SFTP 指令动态路由与重试
                    if (msg.type && msg.type.startsWith('sftp:')) {
                        // 如果 SFTP 还没热启动完成，等待一下
                        if (!controlCtx.sftp) {
                            let waitRetries = 10; // 5秒
                            while (!controlCtx.sftp && waitRetries > 0 && !controlCtx.isClosing) {
                                await new Promise(r => setTimeout(r, 500));
                                waitRetries--;
                            }
                        }

                        if (!controlCtx.sftp) {
                            ws.send(JSON.stringify({ type: 'sftp:error', error: 'SFTP subsystem timeout' }));
                            return;
                        }

                        await handleSftpCommand(controlCtx.sftp, ws, msg, sshClient);
                    } else if (msg.type === 'monitor:stop') {
                        if (controlCtx.monitor) {
                            clearInterval(controlCtx.monitor);
                            controlCtx.monitor = null;
                        }
                    }
                } catch (e) {
                    console.error('[VPS WS] Message routing error:', e);
                }
            });
        }
    } catch (err) {
        console.error('[VPS WS] Connection error:', err);
        ws.close(1011, 'Connection failed: ' + err.message);
    }
});

async function handleSftpCommand(sftpWrapper, ws, msg, sshClient) {
    if (!sftpWrapper) {
        ws.send(JSON.stringify({ type: msg.type + ':response', error: 'SFTP subsystem disconnected' }));
        return;
    }

    try {
        switch (msg.type) {
            case 'sftp:list':
                const path = msg.path || msg.payload?.path || '/';

                sftpWrapper.readdir(path, (err, list) => {
                    if (err) {
                        console.error('[VPS WS] SFTP list error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:list:response', error: err.message }));
                        return;
                    }

                    const items = list.map(item => ({
                        name: item.filename,
                        size: item.attrs.size,
                        isDir: (item.attrs.mode & 0o040000) !== 0,
                        modifyTime: item.attrs.mtime * 1000,
                        mode: item.attrs.mode
                    }));

                    console.log('[VPS WS] Sending sftp:list:response with', items.length, 'items');
                    ws.send(JSON.stringify({ type: 'sftp:list:response', data: items }));
                });
                break;

            case 'sftp:read':
                const readPath = msg.path || msg.payload?.path;
                sftpWrapper.readFile(readPath, 'utf8', (err, content) => {
                    if (err) {
                        console.error('[VPS WS] SFTP read error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }
                    ws.send(JSON.stringify({
                        type: 'sftp:read:response',
                        path: readPath,
                        data: content
                    }));
                });
                break;

            case 'sftp:write':
                const writePath = msg.path || msg.payload?.path;
                sftpWrapper.writeFile(writePath, Buffer.from(msg.content || msg.payload?.content || ''), (err) => {
                    if (err) {
                        console.error('[VPS WS] SFTP write error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'sftp:write:response', path: writePath }));
                });
                break;

            case 'sftp:download':
                const downloadPath = msg.path || msg.payload?.path;
                console.log('[handleSftpCommand] Downloading:', downloadPath);
                sftpWrapper.readFile(downloadPath, (err, content) => {
                    if (err) {
                        console.error('[VPS WS] SFTP download error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }
                    const filename = downloadPath.split('/').pop();
                    ws.send(JSON.stringify({
                        type: 'sftp:download:response',
                        path: downloadPath,
                        filename: filename,
                        data: Buffer.from(content).toString('base64') // Ensure content is buffer
                    }));
                });
                break;

            case 'sftp:delete':
                const deletePath = msg.path || msg.payload?.path;
                sftpWrapper.stat(deletePath, (err, stats) => {
                    if (err) {
                        console.error('[VPS WS] SFTP stat error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }

                    const isDirectory = (stats.mode & 0o040000) !== 0;

                    if (isDirectory) {
                        // Use rm -rf for directories
                        const safePath = deletePath.replace(/"/g, '\\"');
                        const cmd = `rm -rf "${safePath}"`;
                        sshClient.exec(cmd, (err, stream) => {
                            if (err) {
                                ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                                return;
                            }
                            stream.on('close', (code) => {
                                if (code !== 0) {
                                    ws.send(JSON.stringify({ type: 'sftp:error', error: 'Process exited with code ' + code }));
                                } else {
                                    ws.send(JSON.stringify({ type: 'sftp:delete:response', path: deletePath }));
                                }
                            });
                        });
                    } else {
                        sftpWrapper.unlink(deletePath, (err) => {
                            if (err) {
                                console.error('[VPS WS] SFTP delete error:', err);
                                ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                                return;
                            }
                            ws.send(JSON.stringify({ type: 'sftp:delete:response', path: deletePath }));
                        });
                    }
                });
                break;

            case 'sftp:rename':
                const oldPath = msg.oldPath || msg.payload?.oldPath;
                const newPath = msg.newPath || msg.payload?.newPath;
                sftpWrapper.rename(oldPath, newPath, (err) => {
                    if (err) {
                        console.error('[VPS WS] SFTP rename error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'sftp:rename:response', oldPath, newPath }));
                });
                break;

            case 'sftp:upload:chunk':
                const uploadPath = msg.payload?.path || msg.path;
                const base64Content = msg.payload?.content || msg.content;
                const position = msg.payload?.position || 0;
                const isLast = msg.payload?.isLast || false;

                console.log('[handleSftpCommand] Upload chunk:', uploadPath, 'pos:', position, 'isLast:', isLast);

                try {
                    const buffer = Buffer.from(base64Content, 'base64');
                    console.log('[handleSftpCommand] Decoded buffer size:', buffer.length);

                    // Open file for writing
                    sftpWrapper.open(uploadPath, 'a', (err, handle) => {
                        if (err) {
                            console.error('[handleSftpCommand] Upload open error:', err);
                            ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                            return;
                        }

                        console.log('[handleSftpCommand] File opened, writing...');
                        // Write chunk
                        sftpWrapper.write(handle, buffer, 0, buffer.length, position, (err) => {
                            sftpWrapper.close(handle, () => { }); // Close handle

                            if (err) {
                                console.error('[handleSftpCommand] Upload write error:', err);
                                ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                                return;
                            }

                            console.log('[handleSftpCommand] Chunk written successfully');
                            if (isLast) {
                                ws.send(JSON.stringify({ type: 'sftp:write:response', path: uploadPath }));
                            } else {
                                ws.send(JSON.stringify({ type: 'sftp:upload:chunk:ack' }));
                            }
                        });
                    });
                } catch (e) {
                    console.error('[handleSftpCommand] Upload decode error:', e);
                    ws.send(JSON.stringify({ type: 'sftp:error', error: 'Failed to decode upload data: ' + e.message }));
                }
                break;

            case 'sftp:mkdir':
                const mkdirPath = msg.payload?.path || msg.path;
                sftpWrapper.mkdir(mkdirPath, (err) => {
                    if (err) {
                        console.error('[VPS WS] mkdir error:', err);
                        ws.send(JSON.stringify({ type: 'sftp:error', error: err.message }));
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'sftp:mkdir:response', path: mkdirPath }));
                });
                break;

            default:
                ws.send(JSON.stringify({ type: 'sftp:error', error: 'Unknown command: ' + msg.type }));
        }
    } catch (e) {
        console.error('[VPS WS] handleSftpCommand error:', e);
        ws.send(JSON.stringify({ type: 'sftp:error', error: e.message }));
    }
}

module.exports = {
    handleUpgrade: (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
};
