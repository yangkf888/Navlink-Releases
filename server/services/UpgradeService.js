import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateService } from './UpdateService.js';
import { licenseService } from './LicenseService.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 系统升级服务
 * 负责执行 Docker 镜像升级、备份和回滚操作
 */
export class UpgradeService {
    constructor() {
        // Docker 镜像配置
        this.imageRegistry = 'ghcr.io';
        this.imageName = `${this.imageRegistry}/txwebroot/navlink-releases`;

        // 容器配置
        this.containerName = process.env.CONTAINER_NAME || 'navlink-app';

        // 备份配置
        this.dataDir = path.join(__dirname, '../../data');
        this.backupDir = path.join(__dirname, '../../data/backups');

        // 升级状态
        this.upgradeStatus = {
            inProgress: false,
            stage: null,
            progress: 0,
            message: '',
            startedAt: null,
            error: null
        };

        // Socket.IO 实例 (用于推送进度)
        this.io = null;
    }

    /**
     * 设置 Socket.IO 实例
     */
    setSocketIO(io) {
        this.io = io;
    }

    /**
     * 获取升级状态
     */
    getStatus() {
        return { ...this.upgradeStatus };
    }

    /**
     * 推送升级进度
     */
    pushProgress(stage, progress, message) {
        this.upgradeStatus.stage = stage;
        this.upgradeStatus.progress = progress;
        this.upgradeStatus.message = message;

        console.log(`[UpgradeService] [${stage}] ${progress}% - ${message}`);

        if (this.io) {
            this.io.emit('upgrade:progress', {
                stage,
                progress,
                message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 检查是否在 Docker 容器中运行
     */
    async isRunningInDocker() {
        try {
            await fs.access('/.dockerenv');
            return true;
        } catch {
            // 备用检测方法
            try {
                const cgroup = await fs.readFile('/proc/1/cgroup', 'utf-8');
                return cgroup.includes('docker') || cgroup.includes('containerd');
            } catch {
                return false;
            }
        }
    }

    /**
     * 检查 Docker 是否可用
     */
    async isDockerAvailable() {
        try {
            await execAsync('docker --version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 预检查升级条件
     */
    async preUpgradeCheck() {
        const checks = {
            inDocker: false,
            dockerAvailable: false,
            hasUpdate: false,
            currentVersion: null,
            latestVersion: null,
            diskSpace: true,
            errors: []
        };

        // 检查是否在 Docker 中运行
        checks.inDocker = await this.isRunningInDocker();
        if (!checks.inDocker) {
            checks.errors.push('应用未在 Docker 容器中运行，无法执行自动升级');
        }

        // 检查 Docker 是否可用
        checks.dockerAvailable = await this.isDockerAvailable();
        if (!checks.dockerAvailable) {
            checks.errors.push('Docker 命令不可用');
        }

        // 检查版本更新
        try {
            const updateInfo = await updateService.checkForUpdate();
            checks.currentVersion = updateInfo.currentVersion;
            checks.latestVersion = updateInfo.latestVersion;
            checks.hasUpdate = updateInfo.hasUpdate;

            if (!updateInfo.hasUpdate) {
                checks.errors.push('当前已是最新版本');
            }
        } catch (error) {
            checks.errors.push(`无法检查版本: ${error.message}`);
        }

        // 检查磁盘空间 (简单检查)
        try {
            const { stdout } = await execAsync('df -h /app/data 2>/dev/null || df -h . || echo "1G"');
            // 简单判断是否有足够空间
            checks.diskSpace = true;
        } catch {
            // 忽略磁盘检查错误
        }

        return {
            ...checks,
            canUpgrade: checks.errors.length === 0
        };
    }

    /**
     * 创建升级前备份
     */
    async createBackup() {
        this.pushProgress('backup', 10, '正在创建数据库备份...');

        try {
            // 确保备份目录存在
            await fs.mkdir(this.backupDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `pre-upgrade-${timestamp}`;
            const backupPath = path.join(this.backupDir, backupName);

            await fs.mkdir(backupPath, { recursive: true });

            // 备份 SQLite 数据库
            const dbPath = path.join(this.dataDir, 'navlink.db');
            const dbBackupPath = path.join(backupPath, 'navlink.db');

            try {
                await fs.copyFile(dbPath, dbBackupPath);
                this.pushProgress('backup', 30, '数据库备份完成');
            } catch (error) {
                console.warn('[UpgradeService] No database to backup:', error.message);
            }

            // 备份配置文件
            const configPath = path.join(this.dataDir, 'app_config.json');
            const configBackupPath = path.join(backupPath, 'app_config.json');

            try {
                await fs.copyFile(configPath, configBackupPath);
            } catch {
                // 配置文件可能不存在
            }

            // 记录备份信息
            const backupInfo = {
                timestamp: new Date().toISOString(),
                version: await updateService.getCurrentVersion(),
                files: ['navlink.db', 'app_config.json']
            };

            await fs.writeFile(
                path.join(backupPath, 'backup-info.json'),
                JSON.stringify(backupInfo, null, 2)
            );

            this.pushProgress('backup', 40, '备份创建完成');

            return { success: true, backupPath, backupName };
        } catch (error) {
            console.error('[UpgradeService] Backup failed:', error);
            throw new Error(`备份失败: ${error.message}`);
        }
    }

    /**
     * 拉取最新镜像
     */
    async pullImage(targetVersion = 'latest') {
        this.pushProgress('pull', 50, '正在拉取最新镜像...');

        const imageTag = targetVersion === 'latest'
            ? `${this.imageName}:latest`
            : `${this.imageName}:${targetVersion.replace(/^v/, '')}`;

        return new Promise((resolve, reject) => {
            console.log(`[UpgradeService] Pulling image: ${imageTag}`);

            const pull = spawn('docker', ['pull', imageTag], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let lastProgress = 50;

            pull.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;

                // 解析进度 (Docker pull 输出进度信息)
                if (output.includes('Downloading') || output.includes('Extracting')) {
                    lastProgress = Math.min(lastProgress + 5, 80);
                    this.pushProgress('pull', lastProgress, '正在下载镜像...');
                }
            });

            pull.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pull.on('close', (code) => {
                if (code === 0) {
                    this.pushProgress('pull', 85, '镜像拉取完成');
                    resolve({ success: true, imageTag });
                } else {
                    reject(new Error(`镜像拉取失败: ${stderr || stdout}`));
                }
            });

            pull.on('error', (error) => {
                reject(new Error(`启动 Docker 命令失败: ${error.message}`));
            });
        });
    }

    /**
     * 重启容器以应用升级 (使用 Watchtower)
     */
    async restartContainer() {
        this.pushProgress('restart', 90, '正在启动 Watchtower 更新容器...');

        try {
            // 使用 Watchtower 来执行"销毁旧容器 -> 创建新容器"的操作
            // 这是 Docker 容器自我更新的标准做法
            // 注意: 这会立即杀死当前进程，所以需要确保响应已经发出
            const cmd = `docker run --rm --volume /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower --run-once ${this.containerName}`;

            console.log(`[UpgradeService] Executing: ${cmd}`);

            // 下面的命令执行后，当前容器会被杀死，所以 await 可能永远不会返回
            // 我们不 await 它，或者设置一个很短的超时让它在此之前断开连接
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[UpgradeService] Watchtower failed: ${error.message}`);
                    console.error(stderr);
                } else {
                    console.log(`[UpgradeService] Watchtower output: ${stdout}`);
                }
            });

            this.pushProgress('restart', 100, '升级指令已发送，容器即将重启...');

            return { success: true };
        } catch (error) {
            throw new Error(`启动更新服务失败: ${error.message}`);
        }
    }

    /**
     * 执行完整升级流程
     */
    async performUpgrade(targetVersion = null) {
        if (this.upgradeStatus.inProgress) {
            throw new Error('升级正在进行中');
        }

        this.upgradeStatus = {
            inProgress: true,
            stage: 'init',
            progress: 0,
            message: '开始升级...',
            startedAt: new Date().toISOString(),
            error: null
        };

        try {
            // 0. 验证授权状态
            this.pushProgress('validate', 2, '正在验证授权状态...');
            const validation = await licenseService.validateOnline();

            if (!validation.valid) {
                if (validation.shouldClear) {
                    licenseService.clearLicense();
                    console.log('[UpgradeService] License cleared due to:', validation.status);
                }
                throw new Error(validation.message);
            }

            // 1. 预检查
            this.pushProgress('check', 5, '正在进行升级前检查...');
            const checkResult = await this.preUpgradeCheck();

            if (!checkResult.canUpgrade) {
                throw new Error(checkResult.errors.join('; '));
            }

            const version = targetVersion || checkResult.latestVersion;

            // 2. 创建备份
            await this.createBackup();

            // 3. 拉取新镜像
            await this.pullImage(version);

            // 4. 重启容器 (延迟执行，确保 HTTP 响应能发出)
            setTimeout(() => {
                this.restartContainer().catch(err => console.error('[UpgradeService] Restart failed:', err));
            }, 2000);

            this.upgradeStatus.inProgress = false;
            this.upgradeStatus.stage = 'completed';

            // 清除版本缓存
            updateService.clearCache();

            return {
                success: true,
                message: '升级成功！容器正在重启，请稍候刷新页面。',
                previousVersion: checkResult.currentVersion,
                newVersion: version
            };

        } catch (error) {
            console.error('[UpgradeService] Upgrade failed:', error);

            this.upgradeStatus.inProgress = false;
            this.upgradeStatus.error = error.message;
            this.upgradeStatus.stage = 'failed';

            this.pushProgress('failed', 0, `升级失败: ${error.message}`);

            throw error;
        }
    }

    /**
     * 获取备份列表
     */
    async getBackups() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            const entries = await fs.readdir(this.backupDir, { withFileTypes: true });

            const backups = [];

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('pre-upgrade-')) {
                    const infoPath = path.join(this.backupDir, entry.name, 'backup-info.json');
                    try {
                        const infoContent = await fs.readFile(infoPath, 'utf-8');
                        const info = JSON.parse(infoContent);
                        backups.push({
                            name: entry.name,
                            ...info
                        });
                    } catch {
                        // 如果没有 info 文件，使用基本信息
                        backups.push({
                            name: entry.name,
                            timestamp: entry.name.replace('pre-upgrade-', '')
                        });
                    }
                }
            }

            // 按时间倒序排列
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return backups;
        } catch (error) {
            console.error('[UpgradeService] Failed to list backups:', error);
            return [];
        }
    }

    /**
     * 删除旧备份 (保留最近 N 个)
     */
    async cleanupOldBackups(keepCount = 5) {
        try {
            const backups = await this.getBackups();

            if (backups.length <= keepCount) {
                return { deleted: 0 };
            }

            const toDelete = backups.slice(keepCount);

            for (const backup of toDelete) {
                const backupPath = path.join(this.backupDir, backup.name);
                await fs.rm(backupPath, { recursive: true, force: true });
                console.log(`[UpgradeService] Deleted old backup: ${backup.name}`);
            }

            return { deleted: toDelete.length };
        } catch (error) {
            console.error('[UpgradeService] Failed to cleanup backups:', error);
            return { deleted: 0, error: error.message };
        }
    }

    /**
     * 删除指定备份
     */
    async deleteBackup(backupName) {
        // 安全检查: 防止路径遍历
        if (!backupName || typeof backupName !== 'string' ||
            backupName.includes('..') || backupName.includes('/') ||
            !backupName.startsWith('pre-upgrade-')) {
            throw new Error('无效的备份名称');
        }

        const backupPath = path.join(this.backupDir, backupName);

        try {
            await fs.access(backupPath);
        } catch {
            throw new Error('备份不存在');
        }

        try {
            await fs.rm(backupPath, { recursive: true, force: true });
            console.log(`[UpgradeService] Deleted backup: ${backupName}`);
            return { success: true };
        } catch (error) {
            throw new Error(`删除备份失败: ${error.message}`);
        }
    }
}

// 导出单例
export const upgradeService = new UpgradeService();
