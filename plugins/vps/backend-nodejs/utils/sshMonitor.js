/**
 * SSH监控工具模块
 * 提供服务器系统信息采集功能
 */

/**
 * 获取完整系统信息
 * @param {NodeSSH} ssh - 已连接的SSH实例
 * @returns {Promise<Object>} 系统信息对象
 */
async function getSystemInfo(ssh) {
    try {
        // 并行执行所有命令以提高性能
        const [osRelease, kernel, cpuModel, cpuCores, memory, disk] = await Promise.all([
            ssh.execCommand('cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || echo "NAME=Unknown"'),
            ssh.execCommand('uname -r'),
            ssh.execCommand('lscpu | grep "Model name" | cut -d: -f2 | xargs || echo "Unknown"'),
            ssh.execCommand('nproc'),
            ssh.execCommand('free -m | grep Mem'),
            ssh.execCommand('df -h / | tail -1')
        ]);

        return {
            os_info: parseOSInfo(osRelease.stdout, kernel.stdout),
            cpu_info: parseCPUInfo(cpuModel.stdout, cpuCores.stdout),
            mem_info: parseMemoryInfo(memory.stdout),
            disk_info: parseDiskInfo(disk.stdout)
        };
    } catch (error) {
        console.error('[SSH Monitor] Error getting system info:', error.message);
        return null;
    }
}

/**
 * 解析操作系统信息
 * @param {string} osRelease - /etc/os-release输出
 * @param {string} kernel - uname -r输出
 * @returns {string} JSON格式的OS信息
 */
function parseOSInfo(osRelease, kernel) {
    const info = {};

    // 解析os-release文件
    osRelease.split('\n').forEach(line => {
        const match = line.match(/^(\w+)=(.+)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].replace(/^["']|["']$/g, '').trim();
            info[key] = value;
        }
    });

    return JSON.stringify({
        name: info.PRETTY_NAME || info.NAME || 'Unknown',
        version: info.VERSION || info.VERSION_ID || '',
        id: info.ID || '',
        kernel: kernel.trim() || 'Unknown'
    });
}

/**
 * 解析CPU信息
 * @param {string} model - CPU型号
 * @param {string} cores - CPU核心数
 * @returns {string} JSON格式的CPU信息
 */
function parseCPUInfo(model, cores) {
    return JSON.stringify({
        model: model.trim() || 'Unknown',
        cores: parseInt(cores) || 0
    });
}

/**
 * 解析内存信息
 * @param {string} memLine - free -m命令输出的Mem行
 * @returns {string} JSON格式的内存信息
 */
function parseMemoryInfo(memLine) {
    // 示例输出: Mem:   total   used   free  shared  buff/cache  available
    //          Mem:    7822   2156   3245     254        2420        5090
    const parts = memLine.trim().split(/\s+/);

    if (parts.length < 7) {
        return JSON.stringify({ total: 0, used: 0, usedPercentage: 0 });
    }

    // free -m 输出的单位是MB，但有些系统可能输出KB
    // 检查数值大小判断单位
    let total = parseInt(parts[1]) || 0;
    let used = parseInt(parts[2]) || 0;
    let available = parseInt(parts[6]) || 0;

    // 如果total > 100000，很可能是KB单位，转换为MB
    if (total > 100000) {
        total = Math.round(total / 1024);
        used = Math.round(used / 1024);
        available = Math.round(available / 1024);
    }

    const usedPercentage = total > 0 ? Math.round((used / total) * 100) : 0;

    return JSON.stringify({
        total: total,
        used: used,
        usedPercentage: usedPercentage
    });
}

/**
 * 解析硬盘信息
 * @param {string} diskLine - df -h /命令输出
 * @returns {string} JSON格式的硬盘信息
 */
function parseDiskInfo(diskLine) {
    // 示例输出: /dev/sda1  50G  20G  28G  42% /
    const parts = diskLine.trim().split(/\s+/);

    if (parts.length < 5) {
        return JSON.stringify({ total: '0', used: '0', available: '0', usedPercentage: 0 });
    }

    // 提取百分比数字
    const percentageMatch = parts[4].match(/(\d+)%/);
    const usedPercentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;

    return JSON.stringify({
        total: parts[1] || '0',
        used: parts[2] || '0',
        available: parts[3] || '0',
        usedPercentage: usedPercentage
    });
}

module.exports = {
    getSystemInfo,
    parseOSInfo,
    parseCPUInfo,
    parseMemoryInfo,
    parseDiskInfo
};
