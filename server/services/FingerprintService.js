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

        // 注意: 不再收集 Docker 环境变量 HOSTNAME (containerId)
        // 因为如果用户没有在 docker-compose.yml 中设置 hostname，
        // Docker 会使用容器ID作为 HOSTNAME，升级后会变化
        // 只使用 hostname (os.hostname()) + platform + arch + cpu + memory

        // 注意: 不再收集 Docker 容器 ID (dockerId)
        // 因为容器升级/重建后 ID 会变化，会导致指纹不匹配
        // 使用 hostname + platform + arch + cpu + memory 足以标识设备

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
