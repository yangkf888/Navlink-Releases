import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import EC from 'elliptic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ec = new EC.ec('secp256k1');

/**
 * 授权服务 (License Service)
 * 负责 License 的验证、激活和状态管理
 */
export class LicenseService {
    constructor() {
        // 内置公钥 (用于验证签名)
        // ⚠️ 在生产环境中，请替换为您自己的公钥
        this.publicKey = '04862015b7e5f1721724aa5c31794a16faec7b86399a32e5c97a5a34f0343d2039d05e7e3d8d6dac2a50cbcc4dbd68985047e5ed50d00edd48f8bb5b44d5fafa58';

        this.dataDir = path.join(__dirname, '../../data');
        this.instanceIdPath = path.join(this.dataDir, 'instance.id');
        this.licensePath = path.join(this.dataDir, 'license.key');

        this.instanceId = null;
        this.license = null;
        this.isValid = false;

        // 缓存验证结果
        this.lastValidation = 0;
        this.validationCacheDuration = 60 * 1000; // 1分钟
    }

    /**
     * 初始化服务
     */
    async init() {
        await this.ensureInstanceId();
        await this.loadLicense();
    }

    /**
     * 确保实例 ID 存在 (机器绑定核心)
     */
    async ensureInstanceId() {
        try {
            // 尝试读取现有 ID
            this.instanceId = await fs.readFile(this.instanceIdPath, 'utf-8');
        } catch (error) {
            // 如果不存在，生成新的 UUID 作为实例 ID
            this.instanceId = crypto.randomUUID();
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.writeFile(this.instanceIdPath, this.instanceId);
            console.log('[LicenseService] Generated new Instance ID:', this.instanceId);
        }
    }

    /**
     * 获取实例 ID
     */
    getInstanceId() {
        return this.instanceId;
    }

    /**
     * 加载并验证 License
     */
    async loadLicense() {
        try {
            const licenseData = await fs.readFile(this.licensePath, 'utf-8');
            this.license = JSON.parse(Buffer.from(licenseData, 'base64').toString());
            this.isValid = this.verifyLicense(this.license);

            if (this.isValid) {
                console.log('[LicenseService] License loaded and verified for:', this.license.issuedTo);
            } else {
                console.warn('[LicenseService] License loaded but INVALID');
            }
        } catch (error) {
            // 无 License 或格式错误
            this.license = null;
            this.isValid = false;
            // console.warn('[LicenseService] No valid license found');
        }
    }

    /**
     * 验证 License 对象
     */
    verifyLicense(licenseData) {
        if (!licenseData || !licenseData.signature) return false;

        // 1. 检查机器绑定
        if (licenseData.instanceId !== this.instanceId) {
            console.warn(`[LicenseService] Instance ID mismatch: expected ${this.instanceId}, got ${licenseData.instanceId}`);
            return false;
        }

        // 2. 检查过期时间
        if (licenseData.expiresAt) {
            const expires = new Date(licenseData.expiresAt);
            if (expires < new Date()) {
                console.warn('[LicenseService] License expired at:', expires);
                return false;
            }
        }

        // 3. 验证签名
        try {
            // 构建待签名的原始数据 (必须与签发时完全一致)
            const payload = { ...licenseData };
            delete payload.signature;

            // 关键：确保字段顺序一致 (这就要求签发和验证使用相同的序列化逻辑)
            // 这里我们规定：payload 应该是去除 signature 后的 JSON 字符串
            // 为了避免 JSON 序列化不确定性，我们在签发时应该对 payload 签名，
            // License 数据结构: { payload: { "instanceId":... }, signature: "..." }
            // 但为了简单，用户提供的格式是打平的。我们尝试重构 payload。
            // 简单起见，我们只对几个核心关键字段拼接签名：
            // method 1: specific fields connection (recommended for robustness)
            const signString = `${payload.instanceId}|${payload.issuedTo}|${payload.expiresAt || ''}`;
            const msgHash = crypto.createHash('sha256').update(signString).digest('hex');

            const key = ec.keyFromPublic(this.publicKey, 'hex');
            return key.verify(msgHash, licenseData.signature);
        } catch (error) {
            console.error('[LicenseService] Verification error:', error);
            return false;
        }
    }

    /**
     * 激活 License
     */
    async activate(licenseKey) {
        try {
            // 1. Base64 解码
            const jsonStr = Buffer.from(licenseKey, 'base64').toString();
            const licenseData = JSON.parse(jsonStr);

            // 2. 验证
            if (!this.verifyLicense(licenseData)) {
                throw new Error('无效的 License Key 或不匹配的机器码');
            }

            // 3. 保存
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.writeFile(this.licensePath, licenseKey);

            // 4. 更新状态
            this.license = licenseData;
            this.isValid = true;

            return { success: true, issuedTo: licenseData.issuedTo };

        } catch (error) {
            throw new Error(`激活失败: ${error.message}`);
        }
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            valid: this.isValid,
            instanceId: this.instanceId,
            license: this.isValid ? {
                issuedTo: this.license.issuedTo,
                expiresAt: this.license.expiresAt,
                features: this.license.features
            } : null
        };
    }
}

export const licenseService = new LicenseService();
