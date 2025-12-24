
import EC from 'elliptic';
const ec = new EC.ec('secp256k1');

// 生成密钥对
const key = ec.genKeyPair();

const privateKey = key.getPrivate('hex');
const publicKey = key.getPublic('hex');

console.log('✅ 密钥对生成成功 (ECDSA secp256k1)');
console.log('---------------------------------------------------');
console.log('🔑 私钥 (请妥善保管，用于签发 License):');
console.log(privateKey);
console.log('');
console.log('🔒 公钥 (请填入 LicenseService.js):');
console.log(publicKey);
console.log('---------------------------------------------------');
