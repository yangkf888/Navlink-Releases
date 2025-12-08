const { getDatabase, promisifyDb } = require('../database');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('../utils/crypto');

// --- Groups ---

exports.getGroups = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    return await all('SELECT * FROM groups ORDER BY sort_order ASC, created_at DESC');
};

exports.createGroup = async (group) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)',
        [id, group.name, group.description || '', group.sort_order || 0]
    );
    return { id, ...group };
};

exports.updateGroup = async (id, group) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE groups SET name = ?, description = ?, sort_order = ? WHERE id = ?',
        [group.name, group.description, group.sort_order, id]
    );
    return { id, ...group };
};

exports.deleteGroup = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM groups WHERE id = ?', [id]);
    return { id };
};

// --- Servers ---

exports.getServers = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    const servers = await all('SELECT * FROM servers ORDER BY created_at DESC');

    return servers.map(server => {
        const { password, private_key, ...rest } = server;
        return {
            ...rest,
            has_password: !!password,
            has_private_key: !!private_key
        };
    });
};

exports.getServerById = async (id, includeSecrets = false) => {
    const db = getDatabase();
    const { get } = promisifyDb(db);
    const server = await get('SELECT * FROM servers WHERE id = ?', [id]);

    if (!server) return null;

    if (includeSecrets) {
        if (server.password) server.password = decrypt(server.password);
        if (server.private_key) server.private_key = decrypt(server.private_key);
        return server;
    }

    const { password, private_key, ...rest } = server;
    return {
        ...rest,
        has_password: !!password,
        has_private_key: !!private_key
    };
};

exports.createServer = async (server) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();

    const encryptedPassword = server.password ? encrypt(server.password) : null;
    const encryptedKey = server.private_key ? encrypt(server.private_key) : null;

    await run(
        `INSERT INTO servers (
            id, group_id, name, description, host, port, username, password, private_key, auth_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, server.group_id || null, server.name, server.description || '',
            server.host, server.port || 22, server.username,
            encryptedPassword, encryptedKey, server.auth_type || 'password'
        ]
    );

    return { id, ...server, password: null, private_key: null };
};

exports.updateServer = async (id, server) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);

    const updates = [];
    const params = [];

    const fields = [
        'name', 'description', 'host', 'port', 'username', 'auth_type',
        'os_info', 'cpu_info', 'mem_info', 'disk_info', 'status', 'latency', 'last_check_time'
    ];

    fields.forEach(field => {
        if (server[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(server[field]);
        }
    });

    if (server.group_id !== undefined) {
        updates.push('group_id = ?');
        params.push(server.group_id || null);
    }

    if (server.password) {
        updates.push('password = ?');
        params.push(encrypt(server.password));
    }
    if (server.private_key) {
        updates.push('private_key = ?');
        params.push(encrypt(server.private_key));
    }

    if (updates.length === 0) return { id };

    const sql = `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await run(sql, params);
    return { id, ...server, password: null, private_key: null };
};

exports.deleteServer = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM servers WHERE id = ?', [id]);
    return { id };
};

exports.checkServerConnectivity = async (id) => {
    const server = await exports.getServerById(id, true); // 获取解密后的凭证
    if (!server) throw new Error('Server not found');

    return new Promise((resolve) => {
        const start = Date.now();
        const socket = net.createConnection(server.port || 22, server.host);

        const cleanup = () => {
            socket.destroy();
        };

        socket.setTimeout(5000);

        socket.on('connect', async () => {
            const latency = Date.now() - start;
            cleanup();

            // TCP连接成功，尝试SSH获取系统信息
            let systemInfo = {};
            try {
                const { NodeSSH } = require('node-ssh');
                const { getSystemInfo } = require('../utils/sshMonitor');

                const ssh = new NodeSSH();
                const sshConfig = {
                    host: server.host,
                    port: server.port || 22,
                    username: server.username,
                    readyTimeout: 10000,
                    keepaliveInterval: 10000
                };

                // 根据认证类型设置凭证
                if (server.auth_type === 'password' && server.password) {
                    sshConfig.password = server.password;
                } else if (server.auth_type === 'key' && server.private_key) {
                    sshConfig.privateKey = server.private_key;
                }

                console.log(`[VPS Check] Connecting SSH to ${server.host}:${server.port}...`);
                await ssh.connect(sshConfig);
                console.log(`[VPS Check] SSH connected, getting system info...`);

                systemInfo = await getSystemInfo(ssh);
                ssh.dispose();

                if (systemInfo) {
                    console.log(`[VPS Check] System info retrieved for ${server.host}`);
                }
            } catch (sshError) {
                console.error(`[VPS Check] SSH failed for ${server.host}:`, sshError.message);
                // SSH失败不影响在线状态，只是没有系统信息
            }

            // 更新数据库
            await exports.updateServer(id, {
                status: 'online',
                latency: latency,
                last_check_time: new Date().toISOString(),
                ...systemInfo // 包含 os_info, cpu_info, mem_info, disk_info
            });

            resolve({
                id,
                status: 'online',
                latency,
                ...systemInfo
            });
        });

        socket.on('error', async (err) => {
            cleanup();
            console.error(`[VPS Check] Error connecting to ${server.host}:`, err.message);

            await exports.updateServer(id, {
                status: 'offline',
                latency: null,
                last_check_time: new Date().toISOString()
            });

            resolve({ id, status: 'offline', latency: null, error: err.message });
        });

        socket.on('timeout', async () => {
            cleanup();
            await exports.updateServer(id, {
                status: 'offline',
                latency: null,
                last_check_time: new Date().toISOString()
            });
            resolve({ id, status: 'offline', latency: null, error: 'Timeout' });
        });
    });
};

// --- Snippets ---

exports.getSnippets = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    return await all('SELECT * FROM snippets ORDER BY category ASC, title ASC');
};

exports.createSnippet = async (snippet) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO snippets (id, category, title, command, description) VALUES (?, ?, ?, ?, ?)',
        [id, snippet.category, snippet.title, snippet.command, snippet.description || '']
    );
    return { id, ...snippet };
};

exports.updateSnippet = async (id, snippet) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE snippets SET category = ?, title = ?, command = ?, description = ? WHERE id = ?',
        [snippet.category, snippet.title, snippet.command, snippet.description, id]
    );
    return { id, ...snippet };
};

exports.deleteSnippet = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM snippets WHERE id = ?', [id]);
    return { id };
};

// --- Categories ---

exports.getSnippetCategories = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    return await all('SELECT * FROM snippet_categories ORDER BY sort_order ASC, created_at DESC');
};

exports.createSnippetCategory = async (category) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO snippet_categories (id, name, sort_order) VALUES (?, ?, ?)',
        [id, category.name, category.sort_order || 0]
    );
    return { id, ...category };
};

exports.updateSnippetCategory = async (id, category) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE snippet_categories SET name = ?, sort_order = ? WHERE id = ?',
        [category.name, category.sort_order, id]
    );
    return { id, ...category };
};

exports.deleteSnippetCategory = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM snippet_categories WHERE id = ?', [id]);
    return { id };
};
