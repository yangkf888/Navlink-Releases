#!/usr/bin/env node

/**
 * 单个插件打包脚本 (带混淆)
 * 
 * 使用方法：node scripts/package-single-plugin-obfuscated.cjs <plugin-id>
 * 例如：node scripts/package-single-plugin-obfuscated.cjs video
 * 
 * 功能：
 * 1. 将指定插件打包为生产版本
 * 2. 混淆后端 JS 代码 (排除入口和关键文件)
 * 3. 复制前端编译文件
 * 4. 修改版本号
 * 5. 输出 zip 包
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

// 配置
const PLUGINS_DIR = path.join(__dirname, '../plugins');
const OUTPUT_DIR = path.join(__dirname, '../dist-plugins');
const ZIP_OUTPUT_DIR = path.join(__dirname, '../Navlink-plugins');
const TARGET_VERSION = '1.0.4';

// 混淆忽略名单 (保持明文的文件)
const OBFUSCATE_IGNORE = [
    'server.js',          // 插件入口，必须明文导出
    'FfmpegInstaller.js', // 包含复杂路径和下载逻辑
    'obfuscate.js'        // 自身
];

// 低强度混淆配置 (兼顾保护与稳定)
const OBFUSCATION_OPTIONS = {
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
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    target: 'node'
};

// 排除文件/目录的规则
const EXCLUDE_PATTERNS = [
    'node_modules',
    'src',
    '.git',
    '.gitignore',
    '.DS_Store',
    '*.log',
    '*.test.js',
    'test',
    'tests',
    '__tests__',
    'coverage',
    '.env',
    '.env.local',
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'postcss.config.js',
    'tailwind.config.js',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml'
];

// 工具函数：复制文件
function copyFileSync(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

// 工具函数：混淆并写入
function obfuscateAndWrite(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    try {
        const code = fs.readFileSync(src, 'utf8');
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, OBFUSCATION_OPTIONS);
        fs.writeFileSync(dest, obfuscationResult.getObfuscatedCode(), 'utf8');
        return true;
    } catch (err) {
        console.error(`  ❌ 混淆失败: ${src}`, err.message);
        // 失败时回退到复制
        fs.copyFileSync(src, dest);
        return false;
    }
}

// 工具函数：检查是否应该排除
function shouldExclude(itemPath, itemName) {
    for (const pattern of EXCLUDE_PATTERNS) {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(itemName)) return true;
        } else {
            if (itemName === pattern) return true;
        }
    }
    return false;
}

// 递归处理后端文件
function processBackendFiles(src, dest, stats = { files: 0, obfuscated: 0, size: 0 }) {
    if (!fs.existsSync(src)) return stats;

    const items = fs.readdirSync(src);

    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        if (shouldExclude(srcPath, item)) continue;

        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            processBackendFiles(srcPath, destPath, stats);
        } else if (stat.isFile()) {
            const ext = path.extname(item);

            // 也是仅处理 .js, .json, .db
            if (['.js', '.json', '.db'].includes(ext)) {
                // 判断是否需要混淆
                if (ext === '.js' && !OBFUSCATE_IGNORE.includes(item)) {
                    obfuscateAndWrite(srcPath, destPath);
                    stats.obfuscated++;
                } else {
                    copyFileSync(srcPath, destPath);
                }
                stats.files++;
                // 统计的是源文件大小，粗略估计
                stats.size += stat.size;
            }
        }
    }

    return stats;
}

// 复制前端dist目录 (保持不变)
function copyFrontendDist(src, dest, stats = { files: 0, size: 0 }) {
    if (!fs.existsSync(src)) {
        throw new Error(`Frontend dist not found: ${src}`);
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            copyFrontendDist(srcPath, destPath, stats);
        } else {
            copyFileSync(srcPath, destPath);
            stats.files++;
            stats.size += stat.size;
        }
    }

    return stats;
}

// 处理manifest.json (保持不变)
function processManifest(pluginDir, outputDir) {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = TARGET_VERSION;
    const outputManifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(outputManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}

// 处理package.json (保持不变)
function processPackageJson(backendDir, outputBackendDir) {
    const packagePath = path.join(backendDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
        console.warn(`  ⚠️  package.json not found in ${backendDir}`);
        return null;
    }
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const prodPkg = {
        name: pkg.name,
        version: TARGET_VERSION,
        description: pkg.description,
        main: pkg.main || 'server.js',
        dependencies: pkg.dependencies || {}
    };
    delete prodPkg.devDependencies;
    delete prodPkg.scripts;
    const outputPackagePath = path.join(outputBackendDir, 'package.json');
    fs.writeFileSync(outputPackagePath, JSON.stringify(prodPkg, null, 2), 'utf8');
    return prodPkg;
}

// 格式化文件大小
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 打包单个插件
async function packagePlugin(pluginId) {
    console.log(`\n📦 打包 ${pluginId} (带混淆)...`);

    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    const outputDir = path.join(OUTPUT_DIR, pluginId);

    if (!fs.existsSync(pluginDir)) {
        console.error(`  ❌ 插件目录不存在: ${pluginDir}`);
        return null;
    }

    // 1. 清理输出目录
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // 2. 处理manifest.json
    const manifest = processManifest(pluginDir, outputDir);
    console.log(`  ✅ 更新manifest.json`);

    // 3. 处理后端文件 (含混淆)
    const backendDir = path.join(pluginDir, 'backend-nodejs');
    const outputBackendDir = path.join(outputDir, 'backend-nodejs');
    console.log(`  🔒 正在混淆并复制后端代码...`);

    // 确保 javascript-obfuscator 已安装
    try {
        require.resolve('javascript-obfuscator');
    } catch (e) {
        console.error('  ❌ 未找到 javascript-obfuscator 依赖，请先安装: npm install javascript-obfuscator --save-dev');
        return null;
    }

    const backendStats = processBackendFiles(backendDir, outputBackendDir);
    console.log(`  ✅ 后端处理完成: 总数 ${backendStats.files}, 混淆 ${backendStats.obfuscated} 个敏感文件`);

    // 4. 处理package.json
    processPackageJson(backendDir, outputBackendDir);

    // 5. 复制前端dist
    const frontendDistDir = path.join(pluginDir, 'frontend/dist');
    if (!fs.existsSync(frontendDistDir)) {
        console.error(`  ❌ 前端dist不存在: ${frontendDistDir}`);
        return null;
    }

    const outputFrontendDir = path.join(outputDir, 'frontend/dist');
    const frontendStats = copyFrontendDist(frontendDistDir, outputFrontendDir);
    console.log(`  ✅ 复制前端dist (${frontendStats.files} files)`);

    const totalSize = backendStats.size + frontendStats.size;

    return {
        id: pluginId,
        backendFiles: backendStats.files,
        frontendFiles: frontendStats.files,
        totalSize: totalSize
    };
}

// 压缩插件为 zip 文件 (保持不变)
function zipPlugin(pluginId) {
    const outputDir = path.join(OUTPUT_DIR, pluginId);
    const zipFile = path.join(ZIP_OUTPUT_DIR, `${pluginId}-${TARGET_VERSION}.zip`);

    if (!fs.existsSync(ZIP_OUTPUT_DIR)) {
        fs.mkdirSync(ZIP_OUTPUT_DIR, { recursive: true });
    }
    if (fs.existsSync(zipFile)) {
        fs.unlinkSync(zipFile);
    }

    try {
        const command = `cd "${outputDir}" && zip -r "${zipFile}" . -q`;
        execSync(command, { stdio: 'inherit' });
        const stats = fs.statSync(zipFile);
        console.log(`  ✅ 压缩完成: ${path.basename(zipFile)} (${formatBytes(stats.size)})`);
        return { zipFile, size: stats.size };
    } catch (error) {
        console.error(`  ❌ 压缩失败: ${error.message}`);
        return null;
    }
}

// 主函数
async function main() {
    const pluginId = process.argv[2];

    if (!pluginId) {
        console.error('❌ 请指定插件ID');
        console.log('\n使用方法: node scripts/package-single-plugin-obfuscated.cjs <plugin-id>');
        process.exit(1);
    }

    const result = await packagePlugin(pluginId);
    if (!result) process.exit(1);

    const zipResult = zipPlugin(result.id);
    if (!zipResult) process.exit(1);

    console.log('\n✨ 打包完成！');
    console.log(`📁 ZIP文件: ${zipResult.zipFile}`);
}

main().catch(err => {
    console.error('❌ 脚本出错:', err);
    process.exit(1);
});
