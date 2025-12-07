/**
 * 数据迁移脚本：将多表配置数据迁移到 config_data JSON 字段
 */
import { ConfigService } from '../../services/ConfigService.js';
import siteConfigDAO from '../dao/SiteConfigDAO.js';

async function migrateToJsonConfig() {
    console.log('[Migration] 开始迁移配置数据到 JSON 格式...');

    try {
        // 使用 ConfigService 读取现有的多表数据
        const configService = new ConfigService();
        const fullConfig = await configService.getFullConfig();

        console.log('[Migration] 已读取现有配置，包含以下部分：');
        console.log('  - logoUrl:', fullConfig.logoUrl);
        console.log('  - theme:', fullConfig.theme ? '✓' : '✗');
        console.log('  - hero:', fullConfig.hero ? '✓' : '✗');
        console.log('  - searchEngines:', fullConfig.searchEngines?.length || 0, '个');
        console.log('  - categories:', fullConfig.categories?.length || 0, '个');
        console.log('  - promo:', fullConfig.promo?.length || 0, '个');
        console.log('  - topNav:', fullConfig.topNav?.length || 0, '个');
        console.log('  - rightSidebar:', fullConfig.rightSidebar ? '✓' : '✗');
        console.log('  - footer:', fullConfig.footer ? '✓' : '✗');

        // 保存到 config_data JSON 字段
        const success = await siteConfigDAO.save(fullConfig);

        if (success) {
            console.log('[Migration] ✓ 配置数据迁移成功！');

            // 验证
            const savedConfig = await siteConfigDAO.getConfig();
            if (savedConfig) {
                console.log('[Migration] ✓ 验证成功，数据已保存');
            } else {
                console.error('[Migration] ✗ 验证失败，无法读取保存的数据');
            }
        } else {
            console.error('[Migration] ✗ 迁移失败');
        }

        // 关闭数据库连接
        await configService.close();
        await siteConfigDAO.close();

    } catch (error) {
        console.error('[Migration] 迁移过程中出错:', error);
        process.exit(1);
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToJsonConfig()
        .then(() => {
            console.log('[Migration] 迁移完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Migration] 迁移失败:', error);
            process.exit(1);
        });
}

export { migrateToJsonConfig };
