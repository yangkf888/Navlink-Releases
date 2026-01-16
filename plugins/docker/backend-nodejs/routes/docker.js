import express from 'express';
import { v4 as uuidv4 } from 'uuid';
// import { authenticateToken } from '../middleware/auth.js';
import { DockerServerDAO } from '../database/dao/DockerServerDAO.js';
import { AuditLogDAO } from '../database/dao/AuditLogDAO.js';
import { DockerService } from '../services/dockerService.js';
import { ComposeService } from '../services/ComposeService.js';

const router = express.Router();

// 所有Docker API都需要认证
// router.use(authenticateToken);

// ==================== 服务器管理 ====================

/**
 * 获取所有服务器
 */
router.get('/servers', async (req, res) => {
    try {
        const servers = await DockerServerDAO.getAll();
        res.json(servers);
    } catch (error) {
        console.error('Get servers error:', error);
        res.status(500).json({ error: 'Failed to get servers' });
    }
});

/**
 * 获取单个服务器
 */
router.get('/servers/:id', async (req, res) => {
    try {
        const server = await DockerServerDAO.getById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
    } catch (error) {
        console.error('Get server error:', error);
        res.status(500).json({ error: 'Failed to get server' });
    }
});

/**
 * 创建服务器
 */
router.post('/servers', async (req, res) => {
    try {
        const { name, description, connection_type, host, port, ca_cert, client_cert, client_key, ssh_user, ssh_password, ssh_port, is_default, tags } = req.body;

        // 调试日志：查看接收到的数据
        console.log('[Docker] 创建服务器请求体:', {
            name,
            connection_type,
            host,
            ssh_user,
            ssh_password: ssh_password ? '***' : 'null',
            ssh_port
        });

        if (!name || !connection_type) {
            return res.status(400).json({ error: 'Name and connection_type are required' });
        }

        if (connection_type !== 'local' && !host) {
            return res.status(400).json({ error: 'Host is required for remote connections' });
        }

        if (connection_type === 'ssh' && !ssh_user) {
            return res.status(400).json({ error: 'SSH user is required for SSH tunnel connections' });
        }

        const server = {
            id: uuidv4(),
            name,
            description: description || '',
            connection_type,
            host: host || null,
            port: port || (connection_type === 'tls' ? 2376 : 2375),
            ca_cert: ca_cert || null,
            client_cert: client_cert || null,
            client_key: client_key || null,
            ssh_user: ssh_user || null,
            ssh_password: ssh_password || null,
            ssh_port: ssh_port || 22,
            is_default: is_default || 0,
            tags: tags || ''
        };

        await DockerServerDAO.create(server);

        // 测试连接
        const testResult = await DockerService.testConnection(server.id);

        res.json({ success: true, server, connectionTest: testResult });
    } catch (error) {
        console.error('Create server error:', error);
        res.status(500).json({ error: error.message || 'Failed to create server' });
    }
});

/**
 * 更新服务器
 */
router.put('/servers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        await DockerServerDAO.update(id, updates);

        // 清除缓存
        DockerService.clearClientCache(id);

        res.json({ success: true, message: 'Server updated' });
    } catch (error) {
        console.error('Update server error:', error);
        res.status(500).json({ error: 'Failed to update server' });
    }
});

/**
 * 删除服务器
 */
router.delete('/servers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await DockerServerDAO.delete(id);
        DockerService.clearClientCache(id);

        res.json({ success: true, message: 'Server deleted' });
    } catch (error) {
        console.error('Delete server error:', error);
        res.status(500).json({ error: 'Failed to delete server' });
    }
});

/**
 * 设置默认服务器
 */
router.post('/servers/:id/set-default', async (req, res) => {
    try {
        await DockerServerDAO.setDefault(req.params.id);
        res.json({ success: true, message: 'Default server updated' });
    } catch (error) {
        console.error('Set default server error:', error);
        res.status(500).json({ error: 'Failed to set default server' });
    }
});

/**
 * 测试服务器连接
 */
router.post('/servers/:id/test', async (req, res) => {
    console.log(`[Route] Received test connection request for ${req.params.id}`);
    try {
        const result = await DockerService.testConnection(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取服务器系统信息
 */
router.get('/servers/:id/info', async (req, res) => {
    try {
        const info = await DockerService.getSystemInfo(req.params.id);
        res.json(info);
    } catch (error) {
        console.error('Get system info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 容器操作 ====================

/**
 * 列出容器
 */
router.get('/servers/:serverId/containers', async (req, res) => {
    try {
        const all = req.query.all !== 'false';

        // 先获取客户端（确保SSH连接已建立）
        const client = await DockerService.getClient(req.params.serverId);

        // 只测量Docker API调用时间，不包括SSH连接建立时间
        const startTime = Date.now();
        const containers = await DockerService.listContainers(req.params.serverId, all);
        const latency = Date.now() - startTime;

        // 成功获取容器，更新服务器状态为在线
        await DockerServerDAO.updateStatus(req.params.serverId, 'online', latency, null);

        res.json(containers);
    } catch (error) {
        console.error('List containers error:', error);
        // 失败时更新为离线
        await DockerServerDAO.updateStatus(req.params.serverId, 'offline', 0, error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取容器详情
 */
router.get('/servers/:serverId/containers/:containerId', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const container = await DockerService.inspectContainer(serverId, containerId);
        res.json(container);
    } catch (error) {
        console.error('Inspect container error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/servers/:id/containers', async (req, res) => {
    try {
        const result = await DockerService.createContainer(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Create container error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 启动容器
 */
router.post('/servers/:serverId/containers/:containerId/start', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const result = await DockerService.startContainer(serverId, containerId);
        res.json(result);
    } catch (error) {
        console.error('Start container error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 停止容器
 */
router.post('/servers/:serverId/containers/:containerId/stop', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const timeout = parseInt(req.body.timeout) || 10;
        const result = await DockerService.stopContainer(serverId, containerId, timeout);
        res.json(result);
    } catch (error) {
        console.error('Stop container error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 重启容器
 */
router.post('/servers/:serverId/containers/:containerId/restart', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const timeout = parseInt(req.body.timeout) || 10;
        const result = await DockerService.restartContainer(serverId, containerId, timeout);
        res.json(result);
    } catch (error) {
        console.error('Restart container error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 删除容器
 */
router.delete('/servers/:serverId/containers/:containerId', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const force = req.query.force === 'true';
        const result = await DockerService.removeContainer(serverId, containerId, force);
        res.json(result);
    } catch (error) {
        console.error('Remove container error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取容器日志
 */
router.get('/servers/:serverId/containers/:containerId/logs', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const tail = parseInt(req.query.tail) || 100;
        const result = await DockerService.getContainerLogs(serverId, containerId, tail);
        res.json(result);
    } catch (error) {
        console.error('Get container logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取容器统计信息
 */
router.get('/servers/:serverId/containers/:containerId/stats', async (req, res) => {
    try {
        const { serverId, containerId } = req.params;
        const stats = await DockerService.getContainerStats(serverId, containerId);
        res.json(stats);
    } catch (error) {
        console.error('Get container stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 镜像操作 ====================

/**
 * 列出镜像
 */
router.get('/servers/:serverId/images', async (req, res) => {
    try {
        const { serverId } = req.params;
        const images = await DockerService.listImages(serverId);
        // 调试日志：确认镜像的核心标识
        // console.log(`[Docker Debug] Server ${serverId} images:`, images.map(i => ({ id: i.id, tags: i.tags })));
        res.json(images);
    } catch (error) {
        console.error('List images error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 删除镜像
 */
router.delete('/servers/:serverId/images/:imageId', async (req, res) => {
    try {
        const { serverId, imageId } = req.params;
        const force = req.query.force === 'true';
        const result = await DockerService.removeImage(serverId, imageId, force);
        res.json(result);
    } catch (error) {
        console.error('Remove image error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 拉取镜像
 */
router.post('/servers/:serverId/images/pull', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { imageName } = req.body;

        if (!imageName) {
            return res.status(400).json({ error: 'Image name is required' });
        }

        const result = await DockerService.pullImage(serverId, imageName);
        res.json(result);
    } catch (error) {
        console.error('Pull image error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 实时拉取镜像流 (SSE)
 */
router.get('/servers/:serverId/images/pull/stream', async (req, res) => {
    const { serverId } = req.params;
    const { imageName } = req.query;

    if (!imageName) {
        return res.status(400).json({ error: 'Image name is required' });
    }

    // 跟踪客户端连接状态
    let clientDisconnected = false;

    // 监听客户端断开连接
    req.on('close', () => {
        clientDisconnected = true;
        console.log(`[SSE] Client disconnected during pull of ${imageName}`);
    });

    // 安全写入函数，处理 EPIPE 错误
    const safeWrite = (data) => {
        if (clientDisconnected) return false;
        try {
            res.write(data);
            return true;
        } catch (err) {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                clientDisconnected = true;
                console.log(`[SSE] Write failed (client disconnected): ${err.code}`);
                return false;
            }
            throw err;
        }
    };

    // 设置 SSE Header - 禁用各种缓冲
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
    res.flushHeaders(); // 立即发送 headers，禁用 Express 缓冲

    // 发送初始心跳，确认连接建立
    safeWrite(`data: ${JSON.stringify({ status: 'connecting', message: '正在连接到 Docker 服务...' })}\n\n`);

    try {
        await DockerService.pullImage(serverId, imageName, (chunk) => {
            if (clientDisconnected) return; // 客户端已断开，跳过处理
            const lines = chunk.toString().split('\n').filter(l => l.trim());
            for (const line of lines) {
                if (!safeWrite(`data: ${line}\n\n`)) break;
            }
        });

        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'success', progress: '100%', message: 'Pull completed' })}\n\n`);
        }
    } catch (error) {
        console.error('Pull stream error:', error);
        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`);
        }
    } finally {
        if (!res.writableEnded) {
            res.end();
        }
    }
});



/**
 * 检查单个镜像更新
 */
router.get('/check-update', async (req, res) => {
    try {
        const { serverId, imageName } = req.query;
        if (!serverId || !imageName) return res.status(400).json({ error: 'serverId and imageName required' });
        const result = await DockerService.checkImageUpdate(serverId, imageName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取所有已保存的镜像更新状态
 */
router.get('/update-statuses', async (req, res) => {
    try {
        const { DockerImageUpdateDAO } = await import('../database/dao/DockerImageUpdateDAO.js');
        const statuses = await DockerImageUpdateDAO.getAll();
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 清理未使用的镜像
 */
router.post('/servers/:serverId/images/prune', async (req, res) => {
    try {
        const result = await DockerService.pruneImages(req.params.serverId);
        res.json(result);
    } catch (error) {
        console.error('Prune images error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 网络操作 ====================

/**
 * 列出网络
 */
router.get('/servers/:serverId/networks', async (req, res) => {
    try {
        const networks = await DockerService.listNetworks(req.params.serverId);
        res.json(networks);
    } catch (error) {
        console.error('List networks error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 删除网络
 */
router.delete('/servers/:serverId/networks/:networkId', async (req, res) => {
    try {
        const { serverId, networkId } = req.params;
        const result = await DockerService.removeNetwork(serverId, networkId);
        res.json(result);
    } catch (error) {
        console.error('Remove network error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 卷操作 ====================

/**
 * 列出卷
 */
router.get('/servers/:serverId/volumes', async (req, res) => {
    try {
        const volumes = await DockerService.listVolumes(req.params.serverId);
        res.json(volumes);
    } catch (error) {
        console.error('List volumes error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 删除卷
 */
router.delete('/servers/:serverId/volumes/:volumeName', async (req, res) => {
    try {
        const { serverId, volumeName } = req.params;
        const force = req.query.force === 'true';
        const result = await DockerService.removeVolume(serverId, volumeName, force);
        res.json(result);
    } catch (error) {
        console.error('Remove volume error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 清理未使用的卷
 */
router.post('/servers/:serverId/volumes/prune', async (req, res) => {
    try {
        const result = await DockerService.pruneVolumes(req.params.serverId);
        res.json(result);
    } catch (error) {
        console.error('Prune volumes error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 审计日志 ====================

/**
 * 获取审计日志
 */
router.get('/servers/:serverId/logs', async (req, res) => {
    try {
        const { serverId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const logs = await AuditLogDAO.getByServer(serverId, limit);
        res.json(logs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

/**
 * 获取所有审计日志
 */
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await AuditLogDAO.getAll(limit);
        res.json(logs);
    } catch (error) {
        console.error('Get all audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// ==================== Compose Stack 管理 ====================

/**
 * 获取所有 Stacks
 */
router.get('/servers/:serverId/stacks', async (req, res) => {
    try {
        const { serverId } = req.params;
        const stacks = await ComposeService.listStacks(serverId);
        res.json(stacks);
    } catch (error) {
        console.error('List stacks error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取单个 Stack 详情
 */
router.get('/servers/:serverId/stacks/:name', async (req, res) => {
    const { serverId, name } = req.params;
    const { path: forcedPath } = req.query;
    try {
        const stack = await ComposeService.getStack(serverId, name, forcedPath);
        res.json(stack);
    } catch (error) {
        console.error('Get stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 创建/更新 Stack
 */
router.post('/servers/:serverId/stacks', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { name, yamlContent, envContent, targetDir } = req.body;

        if (!name || !yamlContent) {
            return res.status(400).json({ error: 'name and yamlContent are required' });
        }

        const result = await ComposeService.saveStack(serverId, name, yamlContent, envContent, targetDir);
        res.json(result);
    } catch (error) {
        console.error('Create stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 更新 Stack
 */
router.put('/servers/:serverId/stacks/:name', async (req, res) => {
    try {
        const { serverId, name } = req.params;
        const { yamlContent, envContent, targetDir } = req.body;

        if (!yamlContent) {
            return res.status(400).json({ error: 'yamlContent is required' });
        }

        const result = await ComposeService.saveStack(serverId, name, yamlContent, envContent, targetDir);
        res.json(result);
    } catch (error) {
        console.error('Update stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 删除 Stack
 */
router.delete('/servers/:serverId/stacks/:name', async (req, res) => {
    try {
        const { serverId, name } = req.params;
        const { removeFiles } = req.query;

        const result = await ComposeService.remove(serverId, name, removeFiles === 'true');
        res.json(result);
    } catch (error) {
        console.error('Delete stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 部署 Stack (SSE 流)
 */
router.get('/servers/:serverId/stacks/:name/up/stream', async (req, res) => {
    const { serverId, name } = req.params;
    const { path: customPath } = req.query;
    console.log(`[Docker Plugin] SSE Up Stream for stack: ${name}, customPath: ${customPath}`);

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    const safeWrite = (data) => {
        if (clientDisconnected) return false;
        try {
            res.write(data);
            return true;
        } catch (err) {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                clientDisconnected = true;
                return false;
            }
            throw err;
        }
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    safeWrite(`data: ${JSON.stringify({ status: 'starting', message: '正在部署 Stack...' })}\n\n`);

    try {
        await ComposeService.up(serverId, name, (chunk) => {
            if (!clientDisconnected) {
                safeWrite(`data: ${JSON.stringify({ status: 'progress', message: chunk })}\n\n`);
            }
        }, customPath);

        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'success', message: 'Stack 部署成功' })}\n\n`);
        }
    } catch (error) {
        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`);
        }
    } finally {
        if (!res.writableEnded) res.end();
    }
});

/**
 * 停止并删除 Stack (SSE 流)
 */
router.get('/servers/:serverId/stacks/:name/down/stream', async (req, res) => {
    const { serverId, name } = req.params;
    const { path: customPath } = req.query;

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    const safeWrite = (data) => {
        if (clientDisconnected) return false;
        try {
            res.write(data);
            return true;
        } catch (err) {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                clientDisconnected = true;
                return false;
            }
            throw err;
        }
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    safeWrite(`data: ${JSON.stringify({ status: 'starting', message: '正在停止 Stack...' })}\n\n`);

    try {
        await ComposeService.down(serverId, name, (chunk) => {
            if (!clientDisconnected) {
                safeWrite(`data: ${JSON.stringify({ status: 'progress', message: chunk })}\n\n`);
            }
        }, customPath);

        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'success', message: 'Stack 已停止' })}\n\n`);
        }
    } catch (error) {
        if (!clientDisconnected) {
            safeWrite(`data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`);
        }
    } finally {
        if (!res.writableEnded) res.end();
    }
});

/**
 * 启动 Stack
 */
router.post('/servers/:serverId/stacks/:name/start', async (req, res) => {
    try {
        const { serverId, name } = req.params;
        const result = await ComposeService.start(serverId, name);
        res.json(result);
    } catch (error) {
        console.error('Start stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 停止 Stack
 */
router.post('/servers/:serverId/stacks/:name/stop', async (req, res) => {
    try {
        const { serverId, name } = req.params;
        const result = await ComposeService.stop(serverId, name);
        res.json(result);
    } catch (error) {
        console.error('Stop stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 重启 Stack
 */
router.post('/servers/:serverId/stacks/:name/restart', async (req, res) => {
    try {
        const { serverId, name } = req.params;
        const result = await ComposeService.restart(serverId, name);
        res.json(result);
    } catch (error) {
        console.error('Restart stack error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
