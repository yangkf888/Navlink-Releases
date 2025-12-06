import { spawn, exec } from 'child_process';
import net from 'net';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * ProcessManager
 * Responsible for spawning, monitoring, and killing child processes.
 */
export class ProcessManager {
    constructor() {
        this.processes = new Map(); // pluginId -> { process, port, startTime }
        this.basePort = 10000;
        this.portRange = 1000; // 10000 - 11000
    }

    /**
     * Start a plugin process
     * @param {string} pluginId - Unique ID of the plugin
     * @param {string} entryPoint - Path to the entry file (e.g., index.js or binary)
     * @param {string} type - 'node', 'python', or 'binary'
     * @param {string} cwd - Working directory for the plugin
     * @returns {Promise<number>} - The port the plugin is listening on
     */
    async startPlugin(pluginId, entryPoint, type, cwd, preferredPort) {
        if (this.processes.has(pluginId)) {
            console.log(`Plugin ${pluginId} is already running.`);
            return this.processes.get(pluginId).port;
        }

        let port;
        if (preferredPort) {
            // 检查并清理占用的端口
            if (await this.isPortAvailable(preferredPort)) {
                port = preferredPort;
            } else {
                console.warn(`[ProcessManager] Preferred port ${preferredPort} for ${pluginId} is busy, attempting to kill occupying process...`);
                const killed = await this.killProcessOnPort(preferredPort);
                if (killed && await this.isPortAvailable(preferredPort)) {
                    console.log(`[ProcessManager] ✓ Port ${preferredPort} is now available for ${pluginId}`);
                    port = preferredPort;
                } else {
                    console.warn(`[ProcessManager] Could not free port ${preferredPort}, finding random port...`);
                    port = await this.findAvailablePort();
                }
            }
        } else {
            port = await this.findAvailablePort();
        }

        console.log(`Starting plugin ${pluginId} on port ${port}...`);

        const env = { ...process.env, PORT: port.toString(), PLUGIN_ID: pluginId };
        let child;

        try {
            if (type === 'node') {
                child = spawn('node', [entryPoint], { cwd, env });
            } else if (type === 'python') {
                child = spawn('python3', [entryPoint], { cwd, env });
            } else if (type === 'binary') {
                console.log(`[ProcessManager] Spawning binary: ${entryPoint}`);
                console.log(`[ProcessManager] CWD: ${cwd}`);
                child = spawn(entryPoint, [], { cwd, env });
            } else if (type === 'docker') {
                // Docker Plugin Logic
                const imageName = `navlink-plugin-${pluginId}`;

                // 1. Build Image
                console.log(`Building Docker image for ${pluginId}...`);
                await new Promise((resolve, reject) => {
                    const build = spawn('docker', ['build', '-t', imageName, '.'], { cwd });
                    build.on('close', code => code === 0 ? resolve() : reject(new Error(`Docker build failed with code ${code}`)));
                });

                // 2. Run Container
                // Map a random host port to container port 8080 (assuming Go listens on 8080 inside)
                // We use -P to publish all exposed ports, or -p 0:8080
                console.log(`Running Docker container for ${pluginId}...`);
                // We need to find a free port on host to map to
                const hostPort = await this.findAvailablePort();

                // Note: We pass PORT=8080 to env inside container so Go knows where to listen (if it uses env),
                // but usually inside docker we fix it to 8080.
                child = spawn('docker', [
                    'run', '--rm',
                    '-p', `${hostPort}:8080`,
                    '-e', 'PORT=8080',
                    '--name', `navlink-plugin-${pluginId}-${Date.now()}`,
                    imageName
                ]);

                // For Docker, 'child' is the docker client process. 
                // If we kill it, the container might stay running if we didn't use --rm or handle signals.
                // But --rm helps.

                // We return the HOST port so the gateway can proxy to localhost:hostPort
                port = hostPort;
            } else {
                throw new Error(`Unknown plugin type: ${type}`);
            }

            this.setupChildListeners(pluginId, child);

            this.processes.set(pluginId, {
                process: child,
                port: port,
                startTime: Date.now(),
                type
            });

            // Wait a bit for the process to start listening (simple heuristic for POC)
            // In production, we should poll the port or wait for a 'ready' signal from stdout
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for Docker

            return port;

        } catch (error) {
            console.error(`Failed to start plugin ${pluginId}:`, error);
        }
    }

    /**
     * Stop a plugin process
     */
    async stopPlugin(pluginId) {
        const info = this.processes.get(pluginId);
        if (!info) return;

        console.log(`Stopping plugin ${pluginId}...`);

        try {
            // 先尝试优雅关闭
            info.process.kill('SIGTERM');

            // 等待 2 秒看进程是否退出
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 检查端口是否释放
            if (!await this.isPortAvailable(info.port)) {
                console.warn(`[ProcessManager] Port ${info.port} still occupied, force killing...`);
                await this.killProcessOnPort(info.port);
            }
        } catch (error) {
            console.error(`[ProcessManager] Error stopping plugin ${pluginId}:`, error);
        } finally {
            this.processes.delete(pluginId);
        }
    }

    /**
     * Stop all plugins
     */
    async stopAll() {
        for (const pluginId of this.processes.keys()) {
            await this.stopPlugin(pluginId);
        }
    }

    /**
     * Find an available port
     */
    async findAvailablePort() {
        for (let i = 0; i < this.portRange; i++) {
            const port = this.basePort + i;
            if (await this.isPortAvailable(port)) {
                return port;
            }
        }
        throw new Error('No available ports found in range');
    }

    isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    }

    /**
     * 杀死占用指定端口的进程
     * @param {number} port - 端口号
     * @returns {Promise<boolean>} - 是否成功杀死进程
     */
    async killProcessOnPort(port) {
        try {
            // macOS/Linux: 使用 lsof 查找占用端口的进程
            const { stdout } = await execAsync(`lsof -ti :${port}`);
            const pids = stdout.trim().split('\n').filter(pid => pid);

            if (pids.length === 0) {
                return false;
            }

            console.log(`[ProcessManager] Found ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);

            // 杀死所有占用该端口的进程
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid}`);
                    console.log(`[ProcessManager] Killed process ${pid}`);
                } catch (err) {
                    console.warn(`[ProcessManager] Failed to kill process ${pid}:`, err.message);
                }
            }

            // 等待端口释放
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        } catch (error) {
            // lsof 没有找到进程（端口未被占用）或其他错误
            if (!error.message.includes('Command failed')) {
                console.warn(`[ProcessManager] Error checking port ${port}:`, error.message);
            }
            return false;
        }
    }

    setupChildListeners(pluginId, child) {
        child.stdout.on('data', (data) => {
            console.log(`[${pluginId}] ${data.toString().trim()}`);
        });

        child.on('error', (err) => {
            console.error(`[${pluginId}] Process error:`, err);
        });

        child.stderr.on('data', (data) => {
            console.error(`[${pluginId}] ERROR: ${data.toString().trim()}`);
        });

        child.on('close', (code) => {
            console.log(`[${pluginId}] Process exited with code ${code}`);
            this.processes.delete(pluginId);
        });
    }
}
