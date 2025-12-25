import crypto from 'crypto';
import EC from 'elliptic';

const ec = new EC.ec('secp256k1');

// 私钥从环境变量获取 (生产环境必须设置)
const PRIVATE_KEY = process.env.LICENSE_PRIVATE_KEY || 'f94d69332530e475ed8e61652afdf60b35e0300c269983ab8cf74397965b9c47';

export class LicenseGenerator {
    constructor() {
        this.privateKey = PRIVATE_KEY;
    }

    /**
     * 生成 License
     * @param {string} instanceId - 机器码
     * @param {string} issuedTo - 授权给谁
     * @param {string} expiresAt - 过期时间 (ISO 格式)
     * @param {string[]} features - 功能列表
     * @returns {object} - { licenseKey, licenseData }
     */
    generate(instanceId, issuedTo, expiresAt = '2099-12-31T23:59:59Z', features = ['all']) {
        // 构建 License 数据
        const license = {
            instanceId,
            issuedTo,
            expiresAt,
            features
        };

        // 签名
        const signString = `${license.instanceId}|${license.issuedTo}|${license.expiresAt || ''}`;
        const msgHash = crypto.createHash('sha256').update(signString).digest('hex');

        const key = ec.keyFromPrivate(this.privateKey, 'hex');
        const signature = key.sign(msgHash).toDER('hex');

        license.signature = signature;

        // Base64 编码
        const licenseKey = Buffer.from(JSON.stringify(license)).toString('base64');

        return {
            licenseKey,
            licenseData: license
        };
    }

    /**
     * 验证 License
     * @param {string} licenseKey - Base64 编码的 License
     * @returns {object} - { valid, license, error }
     */
    verify(licenseKey) {
        try {
            // 解码
            const jsonStr = Buffer.from(licenseKey, 'base64').toString();
            const license = JSON.parse(jsonStr);

            if (!license.signature) {
                return { valid: false, error: 'Missing signature' };
            }

            // 检查过期
            if (license.expiresAt) {
                const expires = new Date(license.expiresAt);
                if (expires < new Date()) {
                    return { valid: false, license, error: 'License expired' };
                }
            }

            // 获取公钥并验证签名
            const key = ec.keyFromPrivate(this.privateKey, 'hex');
            const publicKey = key.getPublic('hex');

            const signString = `${license.instanceId}|${license.issuedTo}|${license.expiresAt || ''}`;
            const msgHash = crypto.createHash('sha256').update(signString).digest('hex');

            const verifyKey = ec.keyFromPublic(publicKey, 'hex');
            const valid = verifyKey.verify(msgHash, license.signature);

            return { valid, license };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * 获取公钥 (用于 NavLink 配置)
     */
    getPublicKey() {
        const key = ec.keyFromPrivate(this.privateKey, 'hex');
        return key.getPublic('hex');
    }
}

export const licenseGenerator = new LicenseGenerator();
