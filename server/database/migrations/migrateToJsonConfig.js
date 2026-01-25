/**
 * 数据迁移脚本：将多表配置数据迁移到 config_data JSON 字段
 */
import { ConfigService } from '../../services/ConfigService.js';
import siteConfigDAO from '../dao/SiteConfigDAO.js';

/**
 * 数据迁移脚本：将多表配置数据迁移到 config_data JSON 字段
 * 
 * @param {Object} db - better-sqlite3 数据库实例 (由 runner 传入)
 */
export async function up(db) {
    console.log('[Migration] 开始迁移配置数据到 JSON 格式...');

    // 使用 ConfigService 读取现有的多表数据
    // 注意：尽管 runner 传入了 db，但 ConfigService 内部封装了复杂的字段拼接逻辑
    // 我们可以直接使用 Service，它会使用相同的数据库文件
    const configService = new ConfigService();
    const fullConfig = await configService.getFullConfig();

    if (!fullConfig || Object.keys(fullConfig).length === 0) {
        console.log('[Migration] 未检测到旧版配置数据，跳过迁移。');
        return;
    }

    console.log('[Migration] 已读取现有配置，正在保存到新版 JSON 存储...');

    // 保存到 config_data JSON 字段
    const success = await siteConfigDAO.save(fullConfig);

    if (success) {
        console.log('[Migration] ✓ 配置数据迁移成功！');
    } else {
        throw new Error('配置数据迁移失败');
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    up()
        .then(() => {
            console.log('[Migration] 迁移完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Migration] 迁移失败:', error);
            process.exit(1);
        });
}
