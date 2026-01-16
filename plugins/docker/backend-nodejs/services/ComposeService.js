/**
 * Docker Compose 编排服务
 * 通过 SSH 执行 docker compose 命令实现堆栈管理
 */

import { DockerServerDAO } from '../database/dao/DockerServerDAO.js';
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 默认 compose 目录 - 根据环境决定
const getDefaultComposeDir = (server) => {
    if (server.connection_type === 'local') {
        const orbstackPath = path.join(os.homedir(), 'OrbStack', 'docker', 'volumes');
        if (fs.existsSync(orbstackPath)) return orbstackPath;
        return path.join(os.homedir(), 'docker');
    }
    return '/opt/docker';
};

const getScanRoots = (server) => {
    const roots = [getDefaultComposeDir(server)];
    if (server.connection_type !== 'local') {
        roots.push('/root');
        roots.push('/home');
        roots.push('/mnt');
    }
    return [...new Set(roots)];
};

/**
 * Compose Stack 服务
 */
export class ComposeService {

    /**
     * 执行 SSH 命令
     */
    static async execSSHCommand(serverId, command, onProgress = null) {
        const server = await DockerServerDAO.getById(serverId);
        if (!server) throw new Error('Server not found');

        // 本地服务器直接执行
        if (server.connection_type === 'local') {
            return this.execLocalCommand(command, onProgress);
        }

        // SSH 远程执行
        return new Promise((resolve, reject) => {
            const ssh = new Client();
            let output = '';
            let errorOutput = '';

            ssh.on('ready', () => {
                ssh.exec(command, (err, stream) => {
                    if (err) {
                        ssh.end();
                        return reject(err);
                    }

                    stream.on('data', (data) => {
                        const chunk = data.toString();
                        output += chunk;
                        if (onProgress) onProgress(chunk);
                    });

                    stream.stderr.on('data', (data) => {
                        const chunk = data.toString();
                        errorOutput += chunk;
                        if (onProgress) onProgress(chunk);
                    });

                    stream.on('close', (code) => {
                        ssh.end();
                        if (code !== 0 && errorOutput) {
                            reject(new Error(errorOutput));
                        } else {
                            resolve(output);
                        }
                    });
                });
            });

            ssh.on('error', (err) => {
                reject(new Error(`SSH connection failed: ${err.message}`));
            });

            // 连接配置
            const connectConfig = {
                host: server.host,
                port: server.ssh_port || 22,
                username: server.ssh_user || 'root',
                readyTimeout: 10000
            };

            if (server.ssh_private_key) {
                connectConfig.privateKey = Buffer.from(server.ssh_private_key, 'base64');
            } else if (server.ssh_password) {
                connectConfig.password = server.ssh_password;
            }

            ssh.connect(connectConfig);
        });
    }

    /**
     * 本地命令执行
     */
    static async execLocalCommand(command, onProgress = null) {
        const { exec } = await import('child_process');
        return new Promise((resolve, reject) => {
            const child = exec(command, { maxBuffer: 10 * 1024 * 1024 });
            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data;
                if (onProgress) onProgress(data);
            });

            child.stderr.on('data', (data) => {
                errorOutput += data;
                if (onProgress) onProgress(data);
            });

            child.on('close', (code) => {
                if (code !== 0 && errorOutput) {
                    reject(new Error(errorOutput));
                } else {
                    resolve(output);
                }
            });

            child.on('error', reject);
        });
    }

    /**
     * 列出所有 Compose Stacks
     */
    static async listStacks(serverId) {
        try {
            const server = await DockerServerDAO.getById(serverId);
            if (!server) throw new Error('Server not found');

            // 1. 获取正在运行的项目 (docker compose ls)
            let runningStacks = [];
            try {
                const output = await this.execSSHCommand(
                    serverId,
                    'docker compose ls --format json 2>/dev/null || echo "[]"'
                );
                const lines = output.trim().split('\n').filter(l => l.trim());
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (Array.isArray(data)) runningStacks.push(...data);
                        else runningStacks.push(data);
                    } catch (e) { }
                }
            } catch (e) {
                console.warn('[ComposeService] docker compose ls failed:', e.message);
            }

            // 2. 扫描常用目录发现未运行的项目
            const scanRoots = getScanRoots(server);
            let discoveredPaths = [];

            for (const root of scanRoots) {
                try {
                    const findCmd = `find "${root}" -maxdepth 3 -name "docker-compose.yml" -o -name "compose.yaml" 2>/dev/null`;
                    const findOutput = await this.execSSHCommand(serverId, findCmd);
                    const paths = findOutput.trim().split('\n').filter(p => p.trim());
                    discoveredPaths.push(...paths);
                } catch (e) {
                    console.warn(`[ComposeService] scanning ${root} failed:`, e.message);
                }
            }
            discoveredPaths = [...new Set(discoveredPaths)];

            // 合并结果
            const allStacksMap = new Map();

            // 先放运行中的
            for (const s of runningStacks) {
                allStacksMap.set(s.Name, {
                    name: s.Name,
                    status: s.Status,
                    configFiles: s.ConfigFiles,
                    source: 'running'
                });
            }

            // 再放发现的文件（如果不在运行中）
            for (const p of discoveredPaths) {
                const name = path.basename(path.dirname(p));
                if (!allStacksMap.has(name)) {
                    allStacksMap.set(name, {
                        name: name,
                        status: 'exited',
                        configFiles: p,
                        source: 'disk'
                    });
                }
            }

            // 获取每个 stack 的详细信息
            const detailedStacks = await Promise.all(Array.from(allStacksMap.values()).map(async (stack) => {
                try {
                    const servicesOutput = await this.execSSHCommand(
                        serverId,
                        `docker compose -p "${stack.name}" ps --format json 2>/dev/null || echo "[]"`
                    );

                    let services = [];
                    const serviceLines = servicesOutput.trim().split('\n').filter(l => l.trim());
                    for (const line of serviceLines) {
                        try {
                            const svc = JSON.parse(line);
                            if (Array.isArray(svc)) services.push(...svc);
                            else services.push(svc);
                        } catch (e) { }
                    }

                    const runningCount = services.filter(s =>
                        s.State === 'running' || s.Status?.includes('Up')
                    ).length;

                    return {
                        name: stack.name,
                        status: stack.status,
                        configFiles: stack.configFiles,
                        servicesCount: services.length || (stack.source === 'disk' ? 0 : 0), // disk 模式下无法简单获取服务数，除非解析 YAML
                        runningCount,
                        services
                    };
                } catch (e) {
                    return {
                        name: stack.name,
                        status: stack.status,
                        configFiles: stack.configFiles,
                        servicesCount: 0,
                        runningCount: 0,
                        error: e.message
                    };
                }
            }));

            console.log(`[ComposeService] Found ${detailedStacks.length} stacks for server ${serverId}`);
            detailedStacks.forEach(s => {
                console.log(` - Stack: ${s.name}, Status: ${s.status}, Running: ${s.runningCount}/${s.servicesCount}`);
            });

            return detailedStacks;
        } catch (error) {
            console.error('[ComposeService] listStacks error:', error);
            throw new Error(`Failed to list stacks: ${error.message}`);
        }
    }

    /**
     * 获取 Stack 详情（包括 YAML 和 ENV 内容）
     */
    static async getStack(serverId, stackName, forcedPath = null) {
        try {
            let configPath = null;
            let stackDir = forcedPath;

            if (forcedPath) {
                console.log(`[ComposeService] Using forced path for ${stackName}: ${forcedPath}`);
                if (forcedPath.endsWith('.yml') || forcedPath.endsWith('.yaml')) {
                    configPath = forcedPath;
                    stackDir = path.dirname(forcedPath);
                } else {
                    // 如果是目录，尝试寻找常见的名字
                    const ymlPath = path.join(forcedPath, 'docker-compose.yml');
                    const yamlPath = path.join(forcedPath, 'compose.yaml');
                    const checkCmd = `ls "${ymlPath}" 2>/dev/null || ls "${yamlPath}" 2>/dev/null || echo ""`;
                    const checkResult = await this.execSSHCommand(serverId, checkCmd);
                    configPath = checkResult.trim().split('\n')[0];
                    if (!configPath) {
                        configPath = ymlPath; // Default fallback
                    }
                }
            } else {
                // 如果没有提供路径，尝试通过 ls 获取
                const lsOutput = await this.execSSHCommand(
                    serverId,
                    `docker compose ls --format json 2>/dev/null || echo "[]"`
                );

                try {
                    const data = JSON.parse(lsOutput.trim());
                    const stacks = Array.isArray(data) ? data : [data].filter(s => s && s.Name);
                    const found = stacks.find(s => s.Name === stackName);
                    if (found && found.ConfigFiles) {
                        configPath = found.ConfigFiles.split(',')[0].trim();
                        stackDir = path.dirname(configPath);
                    }
                } catch (e) {
                    console.warn(`[ComposeService] Failed to parse docker compose ls for ${stackName}:`, e.message);
                }
            }

            let yamlContent = '';
            let envContent = '';

            if (configPath && configPath !== '') {
                if (!stackDir) stackDir = path.dirname(configPath);

                console.log(`[ComposeService] Found config path for ${stackName}: ${configPath}`);

                // 读取 docker-compose.yml
                try {
                    yamlContent = await this.execSSHCommand(
                        serverId,
                        `cat "${configPath}" 2>/dev/null || echo ""`
                    );
                } catch (e) { }

                // 读取 .env 文件
                try {
                    envContent = await this.execSSHCommand(
                        serverId,
                        `cat "${stackDir}/.env" 2>/dev/null || echo ""`
                    );
                } catch (e) { }
            } else {
                // 如果还是找不到，尝试几种默认可能的路径
                const server = await DockerServerDAO.getById(serverId);
                const scanRoots = getScanRoots(server);

                for (const root of scanRoots) {
                    const testDir = `${root}/${stackName}`;
                    try {
                        yamlContent = await this.execSSHCommand(
                            serverId,
                            `cat "${testDir}/docker-compose.yml" 2>/dev/null || cat "${testDir}/compose.yaml" 2>/dev/null || echo ""`
                        );
                        if (yamlContent && yamlContent.trim()) {
                            stackDir = testDir;
                            configPath = yamlContent.includes('docker-compose.yml')
                                ? `${testDir}/docker-compose.yml`
                                : `${testDir}/compose.yaml`;

                            envContent = await this.execSSHCommand(
                                serverId,
                                `cat "${testDir}/.env" 2>/dev/null || echo ""`
                            );
                            // console.log(`[ComposeService] Found content after deep scan in: ${testDir}`);
                            break;
                        }
                    } catch (e) { }
                }
            }

            // 获取服务状态
            const servicesOutput = await this.execSSHCommand(
                serverId,
                `docker compose -p "${stackName}" ps --format json 2>/dev/null || echo "[]"`
            );

            let services = [];
            const serviceLines = servicesOutput.trim().split('\n').filter(l => l.trim());
            for (const line of serviceLines) {
                try {
                    const svc = JSON.parse(line);
                    if (Array.isArray(svc)) {
                        services.push(...svc);
                    } else {
                        services.push(svc);
                    }
                } catch (e) { }
            }

            return {
                name: stackName,
                path: stackDir,
                configFile: configPath,
                yamlContent,
                envContent,
                services,
                servicesCount: services.length,
                runningCount: services.filter(s => s.State === 'running' || s.Status?.includes('Up')).length
            };
        } catch (error) {
            throw new Error(`Failed to get stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 创建/更新 Stack
     */
    static async saveStack(serverId, stackName, yamlContent, envContent = '', targetDir = null) {
        try {
            const server = await DockerServerDAO.getById(serverId);
            if (!server) throw new Error('Server not found');

            const defaultDir = getDefaultComposeDir(server);
            const dir = targetDir || `${defaultDir}/${stackName}`;

            // console.log(`[ComposeService] Saving stack ${stackName} to: ${dir}`);

            // 创建目录
            await this.execSSHCommand(serverId, `mkdir -p "${dir}"`);

            // 写入 docker-compose.yml
            const escapedYaml = yamlContent.replace(/'/g, "'\\''");
            await this.execSSHCommand(
                serverId,
                `echo '${escapedYaml}' > "${dir}/docker-compose.yml"`
            );

            // 写入 .env 文件（如果有内容）
            if (envContent && envContent.trim()) {
                const escapedEnv = envContent.replace(/'/g, "'\\''");
                await this.execSSHCommand(
                    serverId,
                    `echo '${escapedEnv}' > "${dir}/.env"`
                );
            }

            return { success: true, path: dir };
        } catch (error) {
            throw new Error(`Failed to save stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 部署 Stack (docker compose up -d)
     */
    static async up(serverId, stackName, onProgress = null, targetDir = null) {
        try {
            const server = await DockerServerDAO.getById(serverId);
            if (!server) throw new Error('Server not found');

            // 优先使用传入的路径，其次查询此 stack 的路径
            let dir = targetDir;
            if (!dir) {
                const stack = await this.getStack(serverId, stackName);
                const defaultDir = getDefaultComposeDir(server);
                dir = stack.path && stack.path !== '.' ? stack.path : `${defaultDir}/${stackName}`;
            }

            // console.log(`[ComposeService] Deploying stack ${stackName} from: ${dir}`);

            const result = await this.execSSHCommand(
                serverId,
                `cd "${dir}" && docker compose up -d --remove-orphans 2>&1`,
                onProgress
            );

            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);
            return { success: true, output: result };
        } catch (error) {
            throw new Error(`Failed to deploy stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 停止并删除 Stack (docker compose down)
     */
    static async down(serverId, stackName, onProgress = null, targetDir = null) {
        try {
            const server = await DockerServerDAO.getById(serverId);
            if (!server) throw new Error('Server not found');

            // 优先使用传入的路径
            let dir = targetDir;
            if (!dir) {
                const stack = await this.getStack(serverId, stackName);
                const defaultDir = getDefaultComposeDir(server);
                dir = stack.path && stack.path !== '.' ? stack.path : `${defaultDir}/${stackName}`;
            }

            // console.log(`[ComposeService] Stopping stack ${stackName} at: ${dir}`);

            const result = await this.execSSHCommand(
                serverId,
                `cd "${dir}" && docker compose down 2>&1`,
                onProgress
            );

            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);
            return { success: true, output: result };
        } catch (error) {
            throw new Error(`Failed to stop stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 启动 Stack (docker compose start)
     */
    static async start(serverId, stackName) {
        try {
            const result = await this.execSSHCommand(
                serverId,
                `docker compose -p "${stackName}" start 2>&1`
            );
            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);
            return { success: true, output: result };
        } catch (error) {
            throw new Error(`Failed to start stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 停止 Stack (docker compose stop)
     */
    static async stop(serverId, stackName) {
        try {
            const result = await this.execSSHCommand(
                serverId,
                `docker compose -p "${stackName}" stop 2>&1`
            );
            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);
            return { success: true, output: result };
        } catch (error) {
            throw new Error(`Failed to stop stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 重启 Stack (docker compose restart)
     */
    static async restart(serverId, stackName) {
        try {
            const result = await this.execSSHCommand(
                serverId,
                `docker compose -p "${stackName}" restart 2>&1`
            );
            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);
            return { success: true, output: result };
        } catch (error) {
            throw new Error(`Failed to restart stack ${stackName}: ${error.message}`);
        }
    }

    /**
     * 删除 Stack（包括文件）
     */
    static async remove(serverId, stackName, removeFiles = false) {
        try {
            const server = await DockerServerDAO.getById(serverId);
            if (!server) throw new Error('Server not found');

            // 1. 先尝试执行 down (停止容器并删除网络/容器)
            // 对于仅保存未运行的 Stack，down 可能会报错，这里我们捕获并记录但继续执行
            try {
                await this.down(serverId, stackName);
            } catch (downErr) {
                console.warn(`[ComposeService] Down failed during removal of ${stackName} (this is normal if stack was never started):`, downErr.message);
            }

            // 2. 如果需要删除文件
            if (removeFiles) {
                // getStack 会根据多种路径深度扫描
                const stack = await this.getStack(serverId, stackName);
                const defaultDir = getDefaultComposeDir(server);
                const dir = stack.path && stack.path !== '.' ? stack.path : `${defaultDir}/${stackName}`;

                console.log(`[ComposeService] Removing stack files for ${stackName} at: ${dir}`);

                // 验证目录是否存在再执行删除，避免 rm -rf "/" 这种极端情况
                if (dir && dir !== '/' && dir !== '/opt' && dir !== '/root' && dir !== '/home') {
                    await this.execSSHCommand(
                        serverId,
                        `rm -rf "${dir}"`
                    );
                } else {
                    console.warn(`[ComposeService] Skip removing files: directory "${dir}" seems unsafe or empty.`);
                }
            }

            // 删除后，使容器列表缓存失效
            const { DockerService } = await import('./dockerService.js');
            DockerService.invalidateAllContainerCaches(serverId);

            return { success: true };
        } catch (error) {
            throw new Error(`Failed to remove stack ${stackName}: ${error.message}`);
        }
    }
}
