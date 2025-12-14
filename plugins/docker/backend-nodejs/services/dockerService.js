import Docker from 'dockerode';
import { Client } from 'ssh2';
import http from 'http';
import { DockerServerDAO } from '../database/dao/DockerServerDAO.js';
import { AuditLogDAO } from '../database/dao/AuditLogDAO.js';

import fs from 'fs';
import path from 'path';

const DEBUG_LOG = path.join(process.cwd(), 'debug_root.log');

function logDebug(message) {
    const time = new Date().toISOString();
    const logMsg = `[${time}] ${message}\n`;
    try {
        fs.appendFileSync(DEBUG_LOG, logMsg);
    } catch (e) {
        console.error('Failed to write to debug log:', e);
    }
}

/**
 * Docker 客户端缓存
 */
const dockerClients = new Map();
const sshConnections = new Map(); // SSH连接缓存 { ssh: Client, socatPid: number }

/**
 * 数据缓存系统
 */
const dataCache = new Map(); // 格式: key -> { data, timestamp }
const CACHE_TTL = 10000; // 10秒缓存有效期
const pendingRefreshes = new Map(); // Key: serverId:type

function getCacheKey(serverId, type) {
    return `${serverId}:${type}`;
}

function getCache(serverId, type, allowStale = false) {
    const key = getCacheKey(serverId, type);
    const cached = dataCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const isStale = age > CACHE_TTL;

    if (isStale) {
        if (allowStale) {
            return { data: cached.data, isStale: true };
        } else {
            dataCache.delete(key);
            return null;
        }
    }

    return { data: cached.data, isStale: false };
}

function setCache(serverId, type, data) {
    const key = getCacheKey(serverId, type);
    dataCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function invalidateCache(serverId, type = null) {
    if (type) {
        // 清除特定类型的缓存
        const key = getCacheKey(serverId, type);
        dataCache.delete(key);
    } else {
        // 清除该服务器的所有缓存
        for (const key of dataCache.keys()) {
            if (key.startsWith(`${serverId}:`)) {
                dataCache.delete(key);
            }
        }
    }
}


/**
 * Docker Service - 核心服务层
 */
export class DockerService {
    /**
     * 获取 Docker 客户端
     */
    static async getClient(serverId) {
        logDebug(`getClient called for ${serverId}`);
        // 从缓存获取
        if (dockerClients.has(serverId)) {
            logDebug(`Returning cached client for ${serverId}`);
            return dockerClients.get(serverId);
        }

        // 从数据库获取配置
        const server = await DockerServerDAO.getById(serverId);
        if (!server) {
            throw new Error('Server not found');
        }

        let client;
        try {
            if (server.connection_type === 'local') {
                client = new Docker({ socketPath: '/var/run/docker.sock' });
            } else if (server.connection_type === 'tcp') {
                client = new Docker({
                    host: server.host,
                    port: server.port || 2375,
                    protocol: 'http'
                });
            } else if (server.connection_type === 'tls') {
                // TLS 连接（预留）
                const options = {
                    host: server.host,
                    port: server.port || 2376,
                    protocol: 'https'
                };

                if (server.ca_cert) {
                    options.ca = Buffer.from(server.ca_cert, 'base64');
                }
                if (server.client_cert) {
                    options.cert = Buffer.from(server.client_cert, 'base64');
                }
                if (server.client_key) {
                    options.key = Buffer.from(server.client_key, 'base64');
                }

                client = new Docker(options);
            } else if (server.connection_type === 'ssh') {
                // SSH 隧道连接
                client = await this.createSSHTunnelClient(serverId, server);
            }

            // 缓存客户端
            dockerClients.set(serverId, client);
            return client;
        } catch (error) {
            throw new Error(`Failed to create Docker client: ${error.message}`);
        }
    }

    /**
     * 创建SSH隧道Docker客户端（改进版：自动启动远程 socat）
     */
    static createSSHTunnelClient(serverId, server) {
        return new Promise((resolve, reject) => {
            const ssh = new Client();
            let socatPid = null; // 存储 socat 进程 PID
            let cleanupDone = false; // 防止重复清理

            // 清理函数
            const cleanup = async () => {
                if (cleanupDone) return;
                cleanupDone = true;

                logDebug(`[SSH] 开始清理资源: ${server.host} (${serverId})`);

                // 清理 socat 进程
                if (socatPid && ssh) {
                    try {
                        await new Promise((resolve) => {
                            ssh.exec(`kill ${socatPid} 2>/dev/null || true`, (err, stream) => {
                                if (err) {
                                    logDebug(`[SSH] 清理 socat 进程失败: ${err.message}`);
                                } else {
                                    stream.on('close', () => {
                                        logDebug(`[SSH] socat 进程已清理: PID ${socatPid}`);
                                        resolve();
                                    });
                                }
                            });
                            // 超时保护
                            setTimeout(resolve, 2000);
                        });
                    } catch (e) {
                        logDebug(`[SSH] 清理过程出错: ${e.message}`);
                    }
                }

                // 清除缓存
                DockerService.clearClientCache(serverId);
            };

            ssh.on('ready', () => {
                logDebug(`[SSH] 连接成功: ${server.host} (${serverId})`);
                console.log(`[SSH] 连接成功: ${server.host}`);

                // 1. 先检查远程是否已安装 socat
                ssh.exec('command -v socat', (err, stream) => {
                    let socatAvailable = false;

                    stream.on('data', () => {
                        socatAvailable = true;
                    });

                    stream.on('close', (code) => {
                        if (!socatAvailable) {
                            logDebug(`[SSH] 远程服务器未安装 socat，尝试直接连接 2375 端口`);
                            console.log(`[SSH] ⚠️ 远程未安装 socat，将尝试直接连接 Docker TCP 端口`);

                            // 降级：直接尝试连接 2375（假设已配置）
                            initDockerClient(ssh, serverId, server, null, resolve);
                        } else {
                            // 2. 启动 socat 转发 Docker Socket
                            const socatCmd = `socat TCP-LISTEN:2375,bind=127.0.0.1,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock 2>/dev/null & echo $!`;

                            logDebug(`[SSH] 启动 socat 转发: ${socatCmd}`);
                            console.log(`[SSH] 正在启动 Docker Socket 转发...`);

                            ssh.exec(socatCmd, (err, stream) => {
                                if (err) {
                                    logDebug(`[SSH] 启动 socat 失败: ${err.message}`);
                                    reject(new Error(`启动 socat 失败: ${err.message}`));
                                    return;
                                }

                                let pidOutput = '';
                                stream.on('data', (data) => {
                                    pidOutput += data.toString();
                                });

                                stream.stderr.on('data', (data) => {
                                    logDebug(`[SSH] socat stderr: ${data}`);
                                });

                                stream.on('close', (code) => {
                                    socatPid = parseInt(pidOutput.trim());
                                    if (!isNaN(socatPid)) {
                                        logDebug(`[SSH] socat 已启动，PID: ${socatPid}`);
                                        console.log(`[SSH] ✅ Docker Socket 转发已启动 (PID: ${socatPid})`);

                                        // 等待 socat 就绪（500ms）
                                        setTimeout(() => {
                                            initDockerClient(ssh, serverId, server, socatPid, resolve);
                                        }, 500);
                                    } else {
                                        logDebug(`[SSH] 无法获取 socat PID: ${pidOutput}`);
                                        reject(new Error('无法启动 socat 进程'));
                                    }
                                });
                            });
                        }
                    });
                });

                // 初始化 Docker 客户端的辅助函数
                function initDockerClient(ssh, serverId, server, pid, resolve) {
                    socatPid = pid;

                    const dockerOptions = {
                        protocol: 'http',
                        socketPath: undefined,
                        Promise: Promise
                    };

                    // 创建自定义的HTTP代理，通过SSH隧道转发请求
                    const agent = new http.Agent();

                    agent.createConnection = function (options, callback) {
                        ssh.forwardOut(
                            '127.0.0.1',
                            0,
                            '127.0.0.1',
                            2375,
                            (err, stream) => {
                                if (err) {
                                    logDebug(`[SSH] 转发失败: ${err.message}`);
                                    callback(err);
                                } else {
                                    callback(null, stream);
                                }
                            }
                        );
                    };

                    dockerOptions.agent = agent;
                    dockerOptions.host = 'localhost';
                    dockerOptions.port = 2375;

                    const client = new Docker(dockerOptions);

                    // 缓存SSH连接和 socat PID
                    sshConnections.set(serverId, { ssh, socatPid });

                    // 监听连接关闭事件，自动清除缓存和 socat
                    ssh.on('close', () => {
                        logDebug(`[SSH] 连接关闭: ${server.host} (${serverId})`);
                        console.log(`[SSH] 连接关闭: ${server.host}`);
                        cleanup();
                    });

                    ssh.on('end', () => {
                        logDebug(`[SSH] 连接结束: ${server.host} (${serverId})`);
                        console.log(`[SSH] 连接结束: ${server.host}`);
                        cleanup();
                    });

                    ssh.on('error', (err) => {
                        logDebug(`[SSH] 连接错误: ${server.host} (${serverId}) - ${err.message}`);
                        console.error(`[SSH] 连接错误:`, err.message);
                    });

                    resolve(client);
                }
            });

            ssh.on('error', (err) => {
                console.error(`[SSH] 连接错误:`, err.message);
                reject(new Error(`SSH连接失败: ${err.message}`));
            });

            // 连接到远程服务器
            const sshConfig = {
                host: server.host,
                port: server.ssh_port || 22,
                username: server.ssh_user || 'root'
            };

            // 根据认证方式选择配置
            if (server.ssh_private_key) {
                // 优先使用提供的私钥认证
                sshConfig.privateKey = server.ssh_private_key;
                console.log(`[SSH] 尝试连接（私钥认证）: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}`);
            } else if (server.ssh_password) {
                // 使用密码认证
                sshConfig.password = server.ssh_password;
                console.log(`[SSH] 尝试连接（密码认证）: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}`);
            } else {
                // 使用SSH Agent进行认证（支持免密登录）
                sshConfig.agent = process.env.SSH_AUTH_SOCK;
                sshConfig.agentForward = true;
                console.log(`[SSH] 尝试连接（Agent认证）: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}`);
            }

            ssh.connect(sshConfig);
        });
    }

    /**
     * 清除客户端缓存
     */
    static clearClientCache(serverId) {
        logDebug(`clearClientCache called for ${serverId || 'ALL'}`);
        if (serverId) {
            dockerClients.delete(serverId);
            // 关闭SSH连接
            const sshConnection = sshConnections.get(serverId);
            if (sshConnection) {
                console.log(`[Docker] Clearing cache for server ${serverId}`);
                const { ssh, socatPid } = sshConnection;

                // 清理 socat 进程
                if (socatPid && ssh) {
                    ssh.exec(`kill ${socatPid} 2>/dev/null || true`, (err) => {
                        if (err) {
                            logDebug(`[Docker] 清理 socat 进程失败: ${err.message}`);
                        } else {
                            logDebug(`[Docker] socat 进程已清理: PID ${socatPid}`);
                        }
                    });
                }

                // 关闭 SSH 连接
                if (ssh) {
                    ssh.destroy(); // 使用 destroy 强制关闭
                }
                sshConnections.delete(serverId);
            }
        } else {
            dockerClients.clear();
            // 关闭所有SSH连接
            sshConnections.forEach(({ ssh, socatPid }) => {
                if (socatPid && ssh) {
                    ssh.exec(`kill ${socatPid} 2>/dev/null || true`);
                }
                if (ssh) {
                    ssh.end();
                }
            });
            sshConnections.clear();
        }
    }

    /**
     * 测试连接
     */
    static async testConnection(serverId) {
        logDebug(`testConnection called for ${serverId}`);
        const startTime = Date.now();
        try {
            const client = await this.getClient(serverId);
            logDebug(`Pinging server ${serverId}...`);
            await client.ping();
            logDebug(`Ping success for ${serverId}`);
            const latency = Date.now() - startTime;

            // 更新状态
            await DockerServerDAO.updateStatus(serverId, 'online', latency, null);

            return { success: true, latency, status: 'online' };
        } catch (error) {
            logDebug(`Ping failed for ${serverId}: ${error.message}`);
            // 连接失败，清除缓存以强制下次重连
            this.clearClientCache(serverId);

            await DockerServerDAO.updateStatus(serverId, 'offline', 0, error.message);
            return { success: false, error: error.message, status: 'offline' };
        }
    }

    /**
     * 获取系统信息
     */
    static async getSystemInfo(serverId) {
        try {
            const client = await this.getClient(serverId);
            const info = await client.info();
            const version = await client.version();

            return {
                success: true,
                info,
                version,
                summary: {
                    containers: info.Containers,
                    containersRunning: info.ContainersRunning,
                    containersPaused: info.ContainersPaused,
                    containersStopped: info.ContainersStopped,
                    images: info.Images,
                    dockerVersion: version.Version,
                    apiVersion: version.ApiVersion,
                    os: version.Os,
                    arch: version.Arch,
                    cpus: info.NCPU,
                    memory: info.MemTotal,
                    serverTime: info.SystemTime
                }
            };
        } catch (error) {
            // 获取信息失败，清除缓存
            this.clearClientCache(serverId);
            throw new Error(`Failed to get system info: ${error.message}`);
        }
    }

    // ==================== 容器操作 ====================

    /**
     * 创建容器
     */
    static async createContainer(serverId, options) {
        try {
            console.log('[DockerService] createContainer options:', JSON.stringify(options, null, 2));
            const client = await this.getClient(serverId);
            const container = await client.createContainer(options);

            // 使容器缓存失效
            invalidateCache(serverId, 'containers_all=true');
            invalidateCache(serverId, 'containers_all=false');

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'create_container',
                resource_type: 'container',
                resource_id: container.id,
                resource_name: options.name || options.Image,
                status: 'success'
            });

            return { success: true, id: container.id, warnings: container.warnings };
        } catch (error) {
            await AuditLogDAO.create({
                server_id: serverId,
                action: 'create_container',
                resource_type: 'container',
                resource_name: options.name || options.Image,
                status: 'failed',
                error_message: error.message
            });
            throw new Error(`Failed to create container: ${error.message}`);
        }
    }

    /**
     * 列出所有容器 (SWR Enabled)
     */
    static async listContainers(serverId, all = true) {
        const cacheKey = `containers_all=${all}`;
        const refreshKey = `${serverId}:${cacheKey}`;

        // 1. 尝试获取缓存 (允许过期)
        const cached = getCache(serverId, cacheKey, true);

        // 定义实际的获取函数
        const fetchContainers = async () => {
            try {
                logDebug(`Fetching fresh containers for ${serverId}`);
                const client = await this.getClient(serverId);
                const containers = await client.listContainers({ all });

                const mappedContainers = containers.map(c => ({
                    id: c.Id,
                    name: c.Names[0]?.replace('/', ''),
                    image: c.Image,
                    imageId: c.ImageID,
                    command: c.Command,
                    created: c.Created,
                    state: c.State,
                    status: c.Status,
                    ports: c.Ports,
                    labels: c.Labels,
                    mounts: c.Mounts,
                    networks: Object.keys(c.NetworkSettings?.Networks || {})
                }));

                // 更新缓存
                setCache(serverId, cacheKey, mappedContainers);
                logDebug(`Cache updated for ${serverId}`);
                return mappedContainers;
            } catch (error) {
                console.error(`Failed to fetch containers for ${serverId}:`, error);
                // 如果是连接错误，可能需要清除客户端缓存
                if (error.message.includes('connect') || error.message.includes('socket')) {
                    this.clearClientCache(serverId);
                }
                throw error;
            } finally {
                pendingRefreshes.delete(refreshKey);
            }
        };

        // 2. 如果有缓存
        if (cached) {
            if (cached.isStale) {
                // 数据过期：返回旧数据，但触发后台刷新
                logDebug(`Returning STALE containers for ${serverId}, triggering background refresh`);

                // 避免重复刷新
                if (!pendingRefreshes.has(refreshKey)) {
                    pendingRefreshes.set(refreshKey, fetchContainers().catch(err => {
                        console.error(`Background refresh failed for ${serverId}:`, err);
                    }));
                }
            } else {
                logDebug(`Returning FRESH containers for ${serverId}`);
            }
            return cached.data;
        }

        // 3. 如果没有缓存 (首次加载)，必须等待
        logDebug(`No cache for ${serverId}, awaiting fetch`);
        // 避免并发请求
        if (pendingRefreshes.has(refreshKey)) {
            return pendingRefreshes.get(refreshKey);
        }

        const promise = fetchContainers();
        pendingRefreshes.set(refreshKey, promise);
        return promise;
    }

    /**
     * 获取容器详情
     */
    static async inspectContainer(serverId, containerId) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);
            const data = await container.inspect();

            return {
                id: data.Id,
                name: data.Name,
                created: data.Created,
                path: data.Path,
                args: data.Args,
                state: data.State,
                image: data.Image,
                config: data.Config,
                networkSettings: data.NetworkSettings,
                mounts: data.Mounts,
                hostConfig: data.HostConfig
            };
        } catch (error) {
            throw new Error(`Failed to inspect container: ${error.message}`);
        }
    }

    /**
     * 启动容器
     */
    static async startContainer(serverId, containerId) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);
            const info = await container.inspect();

            await container.start();

            // 使容器缓存失效
            invalidateCache(serverId, 'containers_all=true');
            invalidateCache(serverId, 'containers_all=false');

            // 记录日志
            await AuditLogDAO.create({
                server_id: serverId,
                action: 'start_container',
                resource_type: 'container',
                resource_id: containerId,
                resource_name: info.Name,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            await AuditLogDAO.create({
                server_id: serverId,
                action: 'start_container',
                resource_type: 'container',
                resource_id: containerId,
                status: 'failed',
                error_message: error.message
            });
            throw new Error(`Failed to start container: ${error.message}`);
        }
    }

    /**
     * 停止容器
     */
    static async stopContainer(serverId, containerId, timeout = 10) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);
            const info = await container.inspect();

            await container.stop({ t: timeout });

            // 使容器缓存失效
            invalidateCache(serverId, 'containers_all=true');
            invalidateCache(serverId, 'containers_all=false');

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'stop_container',
                resource_type: 'container',
                resource_id: containerId,
                resource_name: info.Name,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            await AuditLogDAO.create({
                server_id: serverId,
                action: 'stop_container',
                resource_type: 'container',
                resource_id: containerId,
                status: 'failed',
                error_message: error.message
            });
            throw new Error(`Failed to stop container: ${error.message}`);
        }
    }

    /**
     * 重启容器
     */
    static async restartContainer(serverId, containerId, timeout = 10) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);
            const info = await container.inspect();

            await container.restart({ t: timeout });

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'restart_container',
                resource_type: 'container',
                resource_id: containerId,
                resource_name: info.Name,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to restart container: ${error.message}`);
        }
    }

    /**
     * 删除容器
     */
    static async removeContainer(serverId, containerId, force = false) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);
            const info = await container.inspect();

            await container.remove({ force });

            // 使容器缓存失效
            invalidateCache(serverId, 'containers_all=true');
            invalidateCache(serverId, 'containers_all=false');

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'remove_container',
                resource_type: 'container',
                resource_id: containerId,
                resource_name: info.Name,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to remove container: ${error.message}`);
        }
    }

    /**
     * 获取容器日志
     */
    static async getContainerLogs(serverId, containerId, tail = 100) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);

            const logs = await container.logs({
                stdout: true,
                stderr: true,
                tail,
                timestamps: true
            });

            return { success: true, logs: logs.toString('utf-8') };
        } catch (error) {
            throw new Error(`Failed to get container logs: ${error.message}`);
        }
    }

    /**
     * 获取容器统计信息
     */
    static async getContainerStats(serverId, containerId) {
        try {
            const client = await this.getClient(serverId);
            const container = client.getContainer(containerId);

            const stats = await container.stats({ stream: false });

            return {
                cpu: this.calculateCPUPercent(stats),
                memory: {
                    usage: stats.memory_stats.usage,
                    limit: stats.memory_stats.limit,
                    percent: (stats.memory_stats.usage / stats.memory_stats.limit * 100).toFixed(2)
                },
                network: stats.networks,
                blockIO: stats.blkio_stats
            };
        } catch (error) {
            throw new Error(`Failed to get container stats: ${error.message}`);
        }
    }

    /**
     * 计算CPU使用率
     */
    static calculateCPUPercent(stats) {
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuCount = stats.cpu_stats.online_cpus || 1;

        if (systemDelta > 0 && cpuDelta > 0) {
            return ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2);
        }
        return 0;
    }

    // ==================== 镜像操作 ====================

    /**
     * 列出镜像 (SWR Enabled)
     */
    static async listImages(serverId) {
        const cacheKey = 'images';
        const refreshKey = `${serverId}:${cacheKey}`;

        // 1. 尝试获取缓存 (允许过期)
        const cached = getCache(serverId, cacheKey, true);

        // 定义实际的获取函数
        const fetchImages = async () => {
            try {
                logDebug(`Fetching fresh images for ${serverId}`);
                const client = await this.getClient(serverId);
                const images = await client.listImages();
                const mappedImages = images.map(img => ({
                    id: img.Id,
                    tags: img.RepoTags || [],
                    digests: img.RepoDigests || [],
                    created: img.Created,
                    size: img.Size,
                    virtualSize: img.VirtualSize
                }));

                // 缓存结果
                setCache(serverId, cacheKey, mappedImages);
                return mappedImages;
            } catch (error) {
                console.error(`Failed to fetch images for ${serverId}:`, error);
                throw new Error(`Failed to list images: ${error.message}`);
            } finally {
                pendingRefreshes.delete(refreshKey);
            }
        };

        // 2. 如果有缓存
        if (cached) {
            if (cached.isStale) {
                // 数据过期：返回旧数据，但触发后台刷新
                logDebug(`Returning STALE images for ${serverId}, triggering background refresh`);

                if (!pendingRefreshes.has(refreshKey)) {
                    pendingRefreshes.set(refreshKey, fetchImages().catch(err => {
                        console.error(`Background refresh failed for ${serverId}:`, err);
                    }));
                }
            }
            return cached.data;
        }

        // 3. 如果没有缓存 (首次加载)，必须等待
        if (pendingRefreshes.has(refreshKey)) {
            return pendingRefreshes.get(refreshKey);
        }

        const promise = fetchImages();
        pendingRefreshes.set(refreshKey, promise);
        return promise;
    }

    /**
     * 删除镜像
     */
    static async removeImage(serverId, imageId, force = false) {
        try {
            const client = await this.getClient(serverId);
            const image = client.getImage(imageId);

            await image.remove({ force });

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'remove_image',
                resource_type: 'image',
                resource_id: imageId,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to remove image: ${error.message}`);
        }
    }

    /**
     * 拉取镜像
     */
    static async pullImage(serverId, imageName) {
        try {
            const client = await this.getClient(serverId);

            return new Promise((resolve, reject) => {
                client.pull(imageName, (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const chunks = [];
                    stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', async () => {
                        await AuditLogDAO.create({
                            server_id: serverId,
                            action: 'pull_image',
                            resource_type: 'image',
                            resource_name: imageName,
                            status: 'success'
                        });
                        resolve({ success: true, output: chunks.join('') });
                    });
                    stream.on('error', reject);
                });
            });
        } catch (error) {
            throw new Error(`Failed to pull image: ${error.message}`);
        }
    }

    /**
     * 清理未使用的镜像
     */
    static async pruneImages(serverId) {
        try {
            const client = await this.getClient(serverId);
            const result = await client.pruneImages({ filters: { dangling: { true: true } } });

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'prune_images',
                resource_type: 'system',
                status: 'success'
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to prune images: ${error.message}`);
        }
    }

    // ==================== 网络操作 ====================

    /**
     * 列出网络
     */
    static async listNetworks(serverId) {
        try {
            const client = await this.getClient(serverId);
            const networks = await client.listNetworks();
            return networks.map(n => ({
                id: n.Id,
                name: n.Name,
                driver: n.Driver,
                scope: n.Scope,
                internal: n.Internal,
                attachable: n.Attachable,
                ipam: n.IPAM
            }));
        } catch (error) {
            throw new Error(`Failed to list networks: ${error.message}`);
        }
    }

    /**
     * 删除网络
     */
    static async removeNetwork(serverId, networkId) {
        try {
            const client = await this.getClient(serverId);
            const network = client.getNetwork(networkId);

            // 获取网络信息用于日志
            let networkInfo = {};
            try {
                networkInfo = await network.inspect();
            } catch (e) {
                // 忽略错误
            }

            await network.remove();

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'remove_network',
                resource_type: 'network',
                resource_id: networkId,
                resource_name: networkInfo.Name,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to remove network: ${error.message}`);
        }
    }

    // ==================== 卷操作 ====================

    /**
     * 列出卷
     */
    static async listVolumes(serverId) {
        try {
            const client = await this.getClient(serverId);
            const result = await client.listVolumes();
            return result.Volumes.map(v => ({
                name: v.Name,
                driver: v.Driver,
                mountpoint: v.Mountpoint,
                created: v.CreatedAt,
                labels: v.Labels
            }));
        } catch (error) {
            throw new Error(`Failed to list volumes: ${error.message}`);
        }
    }

    /**
     * 删除卷
     */
    static async removeVolume(serverId, volumeName, force = false) {
        try {
            const client = await this.getClient(serverId);
            const volume = client.getVolume(volumeName);

            await volume.remove({ force });

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'remove_volume',
                resource_type: 'volume',
                resource_name: volumeName,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to remove volume: ${error.message}`);
        }
    }

    /**
     * 清理未使用的卷
     */
    static async pruneVolumes(serverId) {
        try {
            const client = await this.getClient(serverId);
            const result = await client.pruneVolumes();

            await AuditLogDAO.create({
                server_id: serverId,
                action: 'prune_volumes',
                resource_type: 'system',
                status: 'success'
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to prune volumes: ${error.message}`);
        }
    }
}
