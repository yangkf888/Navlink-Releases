const crypto = require('crypto');

// 使用固定的密钥进行加密解密（实际生产应从环境变量获取）
// 这里为了简单，使用硬编码的密钥（从旧代码迁移）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'navlink_secret_key_2024_secure_vps';
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
    if (!text) return null;
    try {
        // MD5 hash the key to get 32 bytes for AES-256
        const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        // Simple validation to ensure format is iv:encrypted
        if (textParts.length !== 2) return text;

        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');

        const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        return text; // Return original if decryption fails (fallback)
    }
}

module.exports = {
    encrypt,
    decrypt
};
