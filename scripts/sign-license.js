
import EC from 'elliptic';
import crypto from 'crypto';

const ec = new EC.ec('secp256k1');

// 获取命令行参数
const args = process.argv.slice(2);
const instanceId = args.find(a => a.startsWith('--instance='))?.split('=')[1];
const issuedTo = args[0];

if (!issuedTo || !instanceId) {
    console.error('❌ 用法: node scripts/sign-license.js user@example.com --instance=UUID');
    process.exit(1);
}

// ⚠️ 这里填入您的私钥 (来自 generate-keys.js)
const privateKey = 'f94d69332530e475ed8e61652afdf60b35e0300c269983ab8cf74397965b9c47';

if (privateKey === 'YOUR_PRIVATE_KEY_HERE') {
    console.error('❌ 请先编辑 scripts/sign-license.js 填入您的私钥！');
    process.exit(1);
}

// 构建 License 数据
const license = {
    instanceId: instanceId,
    issuedTo: issuedTo,
    expiresAt: '2099-12-31T23:59:59Z', // 默认永久
    features: ['all']
};

// 签名 (逻辑必须与 LicenseService.verifyLicense 一致)
const signString = `${license.instanceId}|${license.issuedTo}|${license.expiresAt || ''}`;
const msgHash = crypto.createHash('sha256').update(signString).digest('hex');

const key = ec.keyFromPrivate(privateKey, 'hex');
const signature = key.sign(msgHash).toDER('hex');

license.signature = signature;

// Base64 编码
const licenseKey = Buffer.from(JSON.stringify(license)).toString('base64');

console.log('✅ License Key 生成成功:');
console.log('---------------------------------------------------');
console.log(licenseKey);
console.log('---------------------------------------------------');
