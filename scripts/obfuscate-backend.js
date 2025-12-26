#!/usr/bin/env node

/**
 * 后端代码混淆脚本
 * 用于保护 NavLink 项目的后端源码
 */

import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 输出目录
const OUTPUT_DIR = path.join(rootDir, 'dist-server');

// 需要高强度保护的关键文件
const CRITICAL_FILES = [
    'server/services/LicenseService.js',
    'server/services/FingerprintService.js',
    'server/services/AuthService.js',
    'server/middleware/license.js'
];

// 高强度混淆配置 (用于关键授权文件)
const HIGH_SECURITY_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // 不启用调试保护,避免影响性能
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// 标准混淆配置 (用于一般业务代码)
const STANDARD_OPTIONS = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.5,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

/**
 * 检查文件是否为关键文件
 */
function isCriticalFile(filePath) {
    const relativePath = path.relative(rootDir, filePath);
    return CRITICAL_FILES.some(criticalFile =>
        relativePath.replace(/\\/g, '/').includes(criticalFile)
    );
}

/**
 * 混淆单个文件
 */
function obfuscateFile(inputPath, outputPath, options) {
    try {
        // 读取源文件
        const code = fs.readFileSync(inputPath, 'utf8');

        // 混淆
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, options);

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入混淆后的代码
        fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode(), 'utf8');

        const relativePath = path.relative(rootDir, inputPath);
        const isCritical = isCriticalFile(inputPath);
        console.log(`✅ ${relativePath} ${isCritical ? '[高强度]' : '[标准]'}`);

        return true;
    } catch (error) {
        console.error(`❌ 混淆失败: ${inputPath}`);
        console.error(`   ${error.message}`);
        return false;
    }
}

/**
 * 递归遍历目录
 */
function walkDirectory(dir, callback) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // 跳过 node_modules 等目录
            if (file === 'node_modules' || file === '.git') {
                return;
            }
            walkDirectory(filePath, callback);
        } else if (file.endsWith('.js')) {
            callback(filePath);
        }
    });
}

/**
 * 主流程
 */
function main() {
    console.log('🔒 NavLink 后端代码混淆工具\n');
    console.log('输入目录:', rootDir);
    console.log('输出目录:', OUTPUT_DIR);
    console.log('');

    // 清空输出目录
    if (fs.existsSync(OUTPUT_DIR)) {
        console.log('🗑️  清空旧的输出目录...');
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    let totalFiles = 0;
    let successFiles = 0;
    let criticalFiles = 0;

    // 混淆 server/ 目录
    const serverDir = path.join(rootDir, 'server');
    if (fs.existsSync(serverDir)) {
        console.log('📁 混淆 server/ 目录:\n');
        walkDirectory(serverDir, (filePath) => {
            totalFiles++;
            const relativePath = path.relative(serverDir, filePath);
            const outputPath = path.join(OUTPUT_DIR, 'server', relativePath);

            const isCritical = isCriticalFile(filePath);
            if (isCritical) criticalFiles++;

            const options = isCritical ? HIGH_SECURITY_OPTIONS : STANDARD_OPTIONS;
            if (obfuscateFile(filePath, outputPath, options)) {
                successFiles++;
            }
        });
    }

    // 混淆 server.js
    const serverJsPath = path.join(rootDir, 'server.js');
    if (fs.existsSync(serverJsPath)) {
        console.log('\n📁 混淆 server.js:\n');
        totalFiles++;
        const outputPath = path.join(OUTPUT_DIR, 'server.js');
        if (obfuscateFile(serverJsPath, outputPath, STANDARD_OPTIONS)) {
            successFiles++;
        }
    }

    // 统计
    console.log('\n' + '='.repeat(50));
    console.log('✅ 混淆完成!');
    console.log('='.repeat(50));
    console.log(`总文件数: ${totalFiles}`);
    console.log(`成功: ${successFiles}`);
    console.log(`失败: ${totalFiles - successFiles}`);
    console.log(`关键文件(高强度混淆): ${criticalFiles}`);
    console.log(`输出目录: ${OUTPUT_DIR}`);
    console.log('');

    // 计算大小
    const getDirectorySize = (dir) => {
        let size = 0;
        if (!fs.existsSync(dir)) return 0;

        const walk = (d) => {
            const files = fs.readdirSync(d);
            files.forEach(file => {
                const p = path.join(d, file);
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    walk(p);
                } else {
                    size += stat.size;
                }
            });
        };
        walk(dir);
        return size;
    };

    const originalSize = getDirectorySize(serverDir) + (fs.existsSync(serverJsPath) ? fs.statSync(serverJsPath).size : 0);
    const obfuscatedSize = getDirectorySize(OUTPUT_DIR);
    const sizeIncrease = ((obfuscatedSize / originalSize - 1) * 100).toFixed(1);

    console.log(`原始大小: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`混淆后: ${(obfuscatedSize / 1024).toFixed(1)} KB`);
    console.log(`大小增加: ${sizeIncrease}%`);
    console.log('');

    if (successFiles < totalFiles) {
        console.error('⚠️  部分文件混淆失败，请检查错误信息');
        process.exit(1);
    }

    console.log('💡 提示:');
    console.log('  - 开发时使用原始代码: npm run dev');
    console.log('  - 生产构建使用混淆代码: npm run build:all');
    console.log('  - 查看混淆效果: cat dist-server/server/services/LicenseService.js');
    console.log('');
}

// 运行
try {
    main();
} catch (error) {
    console.error('❌ 混淆过程出错:');
    console.error(error);
    process.exit(1);
}
