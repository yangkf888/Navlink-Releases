#!/usr/bin/env node

/**
 * 插件打包脚本
 * 
 * 功能：
 * 1. 将开发版插件打包为生产版本
 * 2. 只包含编译后的文件（dist/）和生产JS
 * 3. 修改版本号为2.0.0
 * 4. 输出到dist-plugins/目录
 * 5. 不修改原插件代码
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const PLUGINS_DIR = path.join(__dirname, '../plugins');
const OUTPUT_DIR = path.join(__dirname, '../dist-plugins');
const ZIP_OUTPUT_DIR = path.join(__dirname, '../Navlink-plugins');
const PLUGIN_IDS = ['vps', 'docker', 'sub', 'kbrag', 'video'];
const TARGET_VERSION = '2.0.0';

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

// 工具函数：检查是否应该排除
function shouldExclude(itemPath, itemName) {
    // 检查是否匹配排除规则
    for (const pattern of EXCLUDE_PATTERNS) {
        if (pattern.includes('*')) {
            // glob pattern
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(itemName)) return true;
        } else {
            if (itemName === pattern) return true;
        }
    }
    return false;
}

// 递归复制目录（只复制.js文件和必要文件）
function copyBackendFiles(src, dest, stats = { files: 0, size: 0 }) {
    if (!fs.existsSync(src)) {
        return stats;
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        // 检查是否排除
        if (shouldExclude(srcPath, item)) {
            continue;
        }

        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            // 递归复制目录
            copyBackendFiles(srcPath, destPath, stats);
        } else if (stat.isFile()) {
            // 只复制.js文件和.json文件
            const ext = path.extname(item);
            if (['.js', '.json', '.db'].includes(ext)) {
                copyFileSync(srcPath, destPath);
                stats.files++;
                stats.size += stat.size;
            }
        }
    }

    return stats;
}

// 复制前端dist目录
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

// 处理manifest.json
function processManifest(pluginDir, outputDir) {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // 修改版本号
    manifest.version = TARGET_VERSION;

    // 写入输出目录
    const outputManifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(
        outputManifestPath,
        JSON.stringify(manifest, null, 2),
        'utf8'
    );

    return manifest;
}

// 处理package.json
function processPackageJson(backendDir, outputBackendDir) {
    const packagePath = path.join(backendDir, 'package.json');

    if (!fs.existsSync(packagePath)) {
        console.warn(`  ⚠️  package.json not found in ${backendDir}`);
        return null;
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // 创建生产版package.json
    const prodPkg = {
        name: pkg.name,
        version: TARGET_VERSION,
        description: pkg.description,
        main: pkg.main || 'server.js',
        dependencies: pkg.dependencies || {}
    };

    // 移除devDependencies和scripts
    delete prodPkg.devDependencies;
    delete prodPkg.scripts;

    // 写入输出目录
    const outputPackagePath = path.join(outputBackendDir, 'package.json');
    fs.writeFileSync(
        outputPackagePath,
        JSON.stringify(prodPkg, null, 2),
        'utf8'
    );

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
    console.log(`\n📦 打包 ${pluginId}...`);

    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    const outputDir = path.join(OUTPUT_DIR, pluginId);

    // 检查插件目录是否存在
    if (!fs.existsSync(pluginDir)) {
        console.error(`  ❌ 插件目录不存在: ${pluginDir}`);
        return null;
    }

    // 1. 清理输出目录
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`  ✅ 清理输出目录`);

    // 2. 处理manifest.json
    const manifest = processManifest(pluginDir, outputDir);
    console.log(`  ✅ 更新manifest.json (version: ${TARGET_VERSION})`);

    // 3. 复制后端文件
    const backendDir = path.join(pluginDir, 'backend-nodejs');
    const outputBackendDir = path.join(outputDir, 'backend-nodejs');
    const backendStats = copyBackendFiles(backendDir, outputBackendDir);
    console.log(`  ✅ 复制后端文件 (${backendStats.files} files, ${formatBytes(backendStats.size)})`);

    // 4. 处理package.json
    processPackageJson(backendDir, outputBackendDir);
    console.log(`  ✅ 生成package.json (只包含dependencies)`);

    // 5. 检查并复制前端dist
    const frontendDistDir = path.join(pluginDir, 'frontend/dist');
    if (!fs.existsSync(frontendDistDir)) {
        console.error(`  ❌ 前端dist不存在: ${frontendDistDir}`);
        console.log(`  💡 请先运行: cd plugins/${pluginId}/frontend && npm run build`);
        return null;
    }

    const outputFrontendDir = path.join(outputDir, 'frontend/dist');
    const frontendStats = copyFrontendDist(frontendDistDir, outputFrontendDir);
    console.log(`  ✅ 复制前端dist (${frontendStats.files} files, ${formatBytes(frontendStats.size)})`);

    // 6. 计算总大小
    const totalSize = backendStats.size + frontendStats.size;
    console.log(`  ✅ ${pluginId} 打包完成 (${formatBytes(totalSize)})`);

    return {
        id: pluginId,
        backendFiles: backendStats.files,
        frontendFiles: frontendStats.files,
        totalSize: totalSize
    };
}

/**
 * 压缩插件为 zip 文件
 * 重要：确保 manifest.json 在 zip 根目录（不包含插件名称的顶层目录）
 */
function zipPlugin(pluginId) {
    const outputDir = path.join(OUTPUT_DIR, pluginId);
    const zipFile = path.join(ZIP_OUTPUT_DIR, `${pluginId}-${TARGET_VERSION}.zip`);

    // 确保 ZIP_OUTPUT_DIR 存在
    if (!fs.existsSync(ZIP_OUTPUT_DIR)) {
        fs.mkdirSync(ZIP_OUTPUT_DIR, { recursive: true });
    }

    // 删除旧的 zip 文件
    if (fs.existsSync(zipFile)) {
        fs.unlinkSync(zipFile);
    }

    try {
        // 使用 cd 到插件目录内再压缩，确保 manifest.json 在 zip 根目录
        // 不要包含插件名称的顶层目录（如 sub/）
        const command = `cd "${outputDir}" && zip -r "${zipFile}" . -q`;
        execSync(command, { stdio: 'inherit' });

        const stats = fs.statSync(zipFile);
        console.log(`  ✅ 压缩完成: ${pluginId}-${TARGET_VERSION}.zip (${formatBytes(stats.size)})`);

        return {
            zipFile,
            size: stats.size
        };
    } catch (error) {
        console.error(`  ❌ 压缩失败: ${error.message}`);
        return null;
    }
}

// 主函数
async function main() {
    console.log('🎁 开始打包插件...\n');
    console.log(`源目录: ${PLUGINS_DIR}`);
    console.log(`输出目录: ${OUTPUT_DIR}`);
    console.log(`ZIP输出: ${ZIP_OUTPUT_DIR}`);
    console.log(`目标版本: ${TARGET_VERSION}\n`);

    // 清理输出目录
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // 打包所有插件
    const results = [];
    for (const pluginId of PLUGIN_IDS) {
        const result = await packagePlugin(pluginId);
        if (result) {
            results.push(result);
        }
    }

    // 压缩插件为 zip 文件
    console.log('\n📦 压缩插件...\n');
    const zipResults = [];
    for (const result of results) {
        const zipResult = zipPlugin(result.id);
        if (zipResult) {
            zipResults.push({ ...result, ...zipResult });
        }
    }

    // 生成报告
    console.log('\n✨ 打包完成！\n');
    console.log('📊 打包报告:');

    let totalSize = 0;
    let totalZipSize = 0;
    for (const result of zipResults) {
        console.log(`  - ${result.id}: ${formatBytes(result.totalSize)} → ${formatBytes(result.size)} (${result.backendFiles + result.frontendFiles} files)`);
        totalSize += result.totalSize;
        totalZipSize += result.size;
    }

    console.log(`\n  原始总计: ${formatBytes(totalSize)}`);
    console.log(`  压缩总计: ${formatBytes(totalZipSize)}`);
    console.log(`  压缩率: ${Math.round((1 - totalZipSize / totalSize) * 100)}%`);
    console.log(`\n📁 输出目录: ${OUTPUT_DIR}`);
    console.log(`📁 ZIP文件: ${ZIP_OUTPUT_DIR}`);
    console.log('\n💡 提示: 插件已自动压缩并保存到 Navlink-plugins/ 目录');
    console.log('💡 可以直接推送到 GitHub 供应用商城使用');
}

// 运行
main().catch(err => {
    console.error('❌ 打包失败:', err);
    process.exit(1);
});
