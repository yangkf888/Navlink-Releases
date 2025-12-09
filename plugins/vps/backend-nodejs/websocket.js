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
            // Add compatibility options for SSH connections
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            algorithms: {
                kex: [
                    'diffie-hellman-group14-sha256',
                    'diffie-hellman-group14-sha1',
                    'diffie-hellman-group-exchange-sha256',
                    'diffie-hellman-group-exchange-sha1',
                    'diffie-hellman-group1-sha1'
                ],
                cipher: [
                    'aes128-ctr',
                    'aes192-ctr',
                    'aes256-ctr',
                    'aes128-gcm',
                    'aes128-gcm@openssh.com',
                    'aes256-gcm',
                    'aes256-gcm@openssh.com',
                    'aes256-cbc',
                    'aes192-cbc',
                    'aes128-cbc'
                ],
                serverHostKey: [
                    'ssh-rsa',
                    'rsa-sha2-512',
                    'rsa-sha2-256',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521',
                    'ssh-ed25519'
                ],
                hmac: [
                    'hmac-sha2-256',
                    'hmac-sha2-512',
                    'hmac-sha1'
                ]
            },
            debug: (msg) => console.log('[SSH Debug]', msg)
        };

        if (server.auth_type === 'password') {
            // Password should already be decrypted by getServerById(serverId, true)
            // But we keep decrypt logic for backward compatibility
            try {
                config.password = cryptoUtils.decrypt(server.password);
                console.log(`[VPS WS] Password decrypted successfully, length: ${config.password ? config.password.length : 0}`);
            } catch (e) {
                // If decrypt fails, it might already be decrypted
                console.log('[VPS WS] Password decrypt failed (might already be decrypted):', e.message);
                config.password = server.password;
            }
            console.log(`[VPS WS] Password ready: ${config.password ? '✓ (length: ' + config.password.length + ')' : '✗ NULL'}`);
        } else if (server.auth_type === 'key') {
            try {
                config.privateKey = cryptoUtils.decrypt(server.private_key);
            } catch (e) {
                config.privateKey = server.private_key;
            }
            if (server.passphrase) {
                config.passphrase = server.passphrase; // Might need decrypt too
            }
        }

        console.log(`[VPS WS] Connecting SSH to ${server.host}:${server.port}...`);

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
                    console.log('[VPS WS] keyboard-interactive triggered');
                    if (prompts.length > 0 && config.password) {
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
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    readyTimeout: 20000,
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
            // Use NodeSSH for both monitoring and SFTP
            console.log('[VPS WS] Control: Connecting NodeSSH...');
            const ssh = new NodeSSH();
            await ssh.connect(config);
            console.log('[VPS WS] Control: NodeSSH connected successfully');

            // Try to get SFTP from NodeSSH connection
            let sftpWrapper = null;
            try {
                console.log('[VPS WS] Control: Requesting SFTP subsystem...');
                sftpWrapper = await ssh.requestSFTP();
                console.log('[VPS WS] Control: SFTP subsystem available');
            } catch (err) {
                console.error('[VPS WS] Control: SFTP subsystem unavailable:', err.message);
            }

            // Notify frontend that control connection is ready
            ws.send(JSON.stringify({ type: 'control:ready' }));

            ws.on('message', async (message) => {
                try {
                    const msg = JSON.parse(message);

                    // --- Monitoring ---
                    if (msg.type === 'monitor:start') {
                        if (monitorInterval) clearInterval(monitorInterval);

                        // Store previous network stats for speed calculation
                        let prevNetStats = null;
                        let prevNetTime = Date.now();

                        monitorInterval = setInterval(async () => {
                            try {
                                const cpuResult = await ssh.execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'"); // Simple CPU usage
                                const memResult = await ssh.execCommand("free -m | grep Mem | awk '{print $3,$2}'"); // Used Total
                                const diskResult = await ssh.execCommand("df -h / | tail -1 | awk '{print $5}'"); // Disk usage percentage

                                // Get network stats - try eth0 first, then other interfaces
                                let netResult = await ssh.execCommand("cat /proc/net/dev | grep -E '(eth0|ens|enp)' | head -1");

                                // Simplified stats parsing
                                const cpuUsage = parseFloat(cpuResult.stdout) || 0;
                                const memParts = memResult.stdout.trim().split(' ');
                                const memUsed = parseInt(memParts[0]) || 0;
                                const memTotal = parseInt(memParts[1]) || 0;

                                // Parse disk usage (remove % sign)
                                const diskUsage = parseInt(diskResult.stdout.replace('%', '')) || 0;

                                // Parse network stats
                                let netUp = 0;
                                let netDown = 0;

                                if (netResult.stdout) {
                                    // Format: interface: rxBytes rxPackets ... txBytes txPackets ...
                                    const parts = netResult.stdout.trim().split(/\s+/);
                                    if (parts.length >= 10) {
                                        const rxBytes = parseInt(parts[1]) || 0;  // Received bytes
                                        const txBytes = parseInt(parts[9]) || 0;  // Transmitted bytes

                                        // Calculate speed if we have previous data
                                        if (prevNetStats) {
                                            const now = Date.now();
                                            const timeDiff = (now - prevNetTime) / 1000; // seconds

                                            if (timeDiff > 0) {
                                                netDown = Math.max(0, (rxBytes - prevNetStats.rx) / timeDiff); // bytes/sec
                                                netUp = Math.max(0, (txBytes - prevNetStats.tx) / timeDiff); // bytes/sec
                                            }
                                        }

                                        // Update previous stats
                                        prevNetStats = { rx: rxBytes, tx: txBytes };
                                        prevNetTime = Date.now();
                                    }
                                }

                                // console.log('[VPS WS] Monitor data - CPU:', cpuUsage.toFixed(1) + '%', 'MEM:', memUsed + '/' + memTotal + 'MB', 'DISK:', diskUsage + '%', 'NET:', 'Down=' + netDown.toFixed(0) + 'B/s', 'Up=' + netUp.toFixed(0) + 'B/s');
                                ws.send(JSON.stringify({
                                    type: 'monitor:data',
                                    data: {
                                        cpu: cpuUsage,  // Changed: direct number instead of {usage: number}
                                        mem: { used: memUsed, total: memTotal },
                                        disk: diskUsage,  // Added: disk usage
                                        net: { up: netUp, down: netDown } // bytes/sec
                                    }
                                }));
                            } catch (e) {
                                console.error('Monitor error:', e);
                            }
                        }, 2000);
                        console.log('[VPS WS] Monitoring started (interval: 2000ms)');
                    } else if (msg.type === 'monitor:stop') {
                        // console.log('[VPS WS] Stopping monitoring...');
                        if (monitorInterval) {
                            clearInterval(monitorInterval);
                            monitorInterval = null;
                        }
                    }

                    // --- SFTP ---
                    if (msg.type && msg.type.startsWith('sftp:')) {
                        console.log('[VPS WS] SFTP command:', msg.type, 'payload:', msg.payload ? Object.keys(msg.payload) : 'none');
                        await handleSftpCommand(sftpWrapper, ws, msg, ssh); // Pass ssh instance
                    }

                } catch (e) {
                    console.error('[VPS WS] Control WS Message Error:', e);
                }
            });

            ws.on('close', () => {
                if (monitorInterval) clearInterval(monitorInterval);
                if (sftpWrapper) {
                    try {
                        sftpWrapper.end();
                    } catch (e) {
                        console.error('[VPS WS] Error closing SFTP:', e);
                    }
                }
                ssh.dispose();
            });
        }

    } catch (err) {
        console.error('[VPS WS] Connection error:', err);
        ws.close(1011, 'Connection failed: ' + err.message);
    }
});

async function handleSftpCommand(sftpWrapper, ws, msg, ssh) {
    console.log('[handleSftpCommand] Type:', msg.type, 'Path:', msg.path || msg.payload?.path);

    if (!sftpWrapper) {
        console.error('[handleSftpCommand] SFTP wrapper not available!');
        ws.send(JSON.stringify({ type: msg.type + ':response', error: 'SFTP not available' }));
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
                        // Use rm -rf for directories to ensure recursive delete
                        const safePath = deletePath.replace(/"/g, '\\"');
                        ssh.execCommand(`rm -rf "${safePath}"`).then((result) => {
                            if (result.code !== 0) {
                                console.error('[VPS WS] Recursive delete failed:', result.stderr);
                                ws.send(JSON.stringify({ type: 'sftp:error', error: result.stderr || 'Failed to delete directory' }));
                            } else {
                                ws.send(JSON.stringify({ type: 'sftp:delete:response', path: deletePath }));
                            }
                        }).catch(e => {
                            console.error('[VPS WS] Recursive delete exception:', e);
                            ws.send(JSON.stringify({ type: 'sftp:error', error: e.message }));
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
