import { updateService } from './server/services/UpdateService.js';

async function diagnose() {
    console.log('🔍 开始诊断升级检测功能...');

    // 1. 检查当前版本
    const currentVersion = await updateService.getCurrentVersion();
    console.log(`✅ 当前版本: ${currentVersion}`);

    // 2. 检查网络连接
    console.log('📡 正在连接 api.github.com...');
    try {
        const releases = await updateService.getReleases(5);
        console.log(`✅ 成功获取到 ${releases.length} 个 Release:`);
        releases.forEach(r => {
            console.log(`   - [${r.tagName}] ${r.name} (Published: ${r.publishedAt}) ${r.draft ? '(Draft)' : ''} ${r.prerelease ? '(Pre-release)' : ''}`);
        });

        // 3. 模拟检查更新
        console.log('🔄 模拟 checkForUpdate...');
        const result = await updateService.checkForUpdate();
        console.log('📊 检查结果:', JSON.stringify(result, null, 2));

        if (!result.hasUpdate) {
            console.warn('⚠️  诊断结果: 未检测到更新');
            if (releases.length > 0) {
                const latest = releases[0];
                console.log(`ℹ️  最新 Release 是 ${latest.tagName} (${latest.version})`);
                console.log(`ℹ️  当前版本是 ${currentVersion}`);
                console.log(`ℹ️  比较结果: isNewer(${latest.version}, ${currentVersion}) = ${updateService.isNewer(latest.version, currentVersion)}`);
            }
        } else {
            console.log('✅ 诊断结果: 成功检测到更新！');
        }

    } catch (error) {
        console.error('❌ 连接 GitHub 失败:', error.message);
        console.error('   请检查服务器/容器的网络连接，是否能访问 api.github.com');
    }
}

diagnose();
