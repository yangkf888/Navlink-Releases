const { getDatabase, promisifyDb } = require('../database');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('../utils/crypto');

// --- Groups ---

exports.getGroups = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    return await all('SELECT * FROM vps_groups ORDER BY sort_order ASC, created_at DESC');
};

exports.createGroup = async (group) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO vps_groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)',
        [id, group.name, group.description || '', group.sort_order || 0]
    );
    return { id, ...group };
};

exports.updateGroup = async (id, group) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE vps_groups SET name = ?, description = ?, sort_order = ? WHERE id = ?',
        [group.name, group.description, group.sort_order, id]
    );
    return { id, ...group };
};

exports.deleteGroup = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM vps_groups WHERE id = ?', [id]);
    return { id };
};

// --- Servers ---

exports.getServers = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    const servers = await all('SELECT * FROM vps_servers ORDER BY created_at DESC');

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
    const server = await get('SELECT * FROM vps_servers WHERE id = ?', [id]);

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
        `INSERT INTO vps_servers (
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

    const sql = `UPDATE vps_servers SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await run(sql, params);
    return { id, ...server, password: null, private_key: null };
};

exports.deleteServer = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM vps_servers WHERE id = ?', [id]);
    return { id };
};

exports.checkServerConnectivity = async (id) => {
    const server = await exports.getServerById(id);
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

            await exports.updateServer(id, {
                status: 'online',
                latency: latency,
                last_check_time: new Date().toISOString()
            });

            resolve({ id, status: 'online', latency });
        });

        socket.on('error', async (err) => {
            cleanup();
            console.error(`[Ping] Error connecting to ${server.host}:`, err.message);

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
    return await all('SELECT * FROM vps_snippets ORDER BY category ASC, title ASC');
};

exports.createSnippet = async (snippet) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO vps_snippets (id, category, title, command, description) VALUES (?, ?, ?, ?, ?)',
        [id, snippet.category, snippet.title, snippet.command, snippet.description || '']
    );
    return { id, ...snippet };
};

exports.updateSnippet = async (id, snippet) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE vps_snippets SET category = ?, title = ?, command = ?, description = ? WHERE id = ?',
        [snippet.category, snippet.title, snippet.command, snippet.description, id]
    );
    return { id, ...snippet };
};

exports.deleteSnippet = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM vps_snippets WHERE id = ?', [id]);
    return { id };
};

// --- Categories ---

exports.getSnippetCategories = async () => {
    const db = getDatabase();
    const { all } = promisifyDb(db);
    return await all('SELECT * FROM vps_snippet_categories ORDER BY sort_order ASC, created_at DESC');
};

exports.createSnippetCategory = async (category) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    const id = uuidv4();
    await run(
        'INSERT INTO vps_snippet_categories (id, name, sort_order) VALUES (?, ?, ?)',
        [id, category.name, category.sort_order || 0]
    );
    return { id, ...category };
};

exports.updateSnippetCategory = async (id, category) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run(
        'UPDATE vps_snippet_categories SET name = ?, sort_order = ? WHERE id = ?',
        [category.name, category.sort_order, id]
    );
    return { id, ...category };
};

exports.deleteSnippetCategory = async (id) => {
    const db = getDatabase();
    const { run } = promisifyDb(db);
    await run('DELETE FROM vps_snippet_categories WHERE id = ?', [id]);
    return { id };
};
