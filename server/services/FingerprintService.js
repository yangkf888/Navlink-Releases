/**
 * 硬件指纹服务
 * 收集设备特征用于授权绑定
 */
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';

class FingerprintService {
    /**
     * 获取硬件指纹
     * @returns {{ hash: string, factors: object }}
     */
    getFingerprint() {
        const factors = this.collectFactors();
        const hash = this.hashFactors(factors);
        return { hash, factors };
    }

    /**
     * 收集硬件因素
     */
    collectFactors() {
        const factors = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpuModel: os.cpus()[0]?.model || 'unknown',
            cpuCount: os.cpus().length,
            totalMemGB: Math.round(os.totalmem() / (1024 ** 3)),
        };

        // Docker 环境特有标识
        if (process.env.HOSTNAME) {
            factors.containerId = process.env.HOSTNAME;
        }

        // 尝试获取 Docker 容器 ID
        try {
            if (fs.existsSync('/proc/self/cgroup')) {
                const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf-8');
                const match = cgroup.match(/docker\/([a-f0-9]{12,})/);
                if (match) {
                    factors.dockerId = match[1].slice(0, 12);
                }
            }
        } catch (e) {
            // 非 Docker 环境
        }

        return factors;
    }

    /**
     * 计算指纹哈希
     */
    hashFactors(factors) {
        const str = Object.values(factors).join('|');
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 32);
    }

    /**
     * 比较两个指纹是否匹配
     * @param {string} storedHash - 存储的指纹哈希
     * @param {string} currentHash - 当前指纹哈希
     * @returns {boolean}
     */
    compare(storedHash, currentHash) {
        return storedHash === currentHash;
    }
}

export const fingerprintService = new FingerprintService();
