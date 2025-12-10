
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import config from '../config/env.js';

const logger = createLogger('Maintenance');

/**
 * System Maintenance Service
 * 负责定期维护系统健康，包括数据库优化和文件清理
 */
class SystemMaintenanceService {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.logsDir = path.join(process.cwd(), 'logs');
        // 默认保留 30 天的日志/备份
        this.retentionDays = 30;
    }

    /**
     * 启动定时维护任务
     * 默认每天凌晨 03:00 执行
     */
    startSchedule() {
        // Schedule: 0 3 * * * (每天 03:00)
        cron.schedule('0 3 * * *', async () => {
            logger.info('Starting scheduled system maintenance...');
            await this.executeMaintenance();
            logger.info('Scheduled system maintenance completed.');
        });

        logger.info('System maintenance scheduled for 03:00 daily');
    }

    /**
     * 执行维护任务
     */
    async executeMaintenance() {
        try {
            await this.optimizeDatabases();
            await this.cleanupOldFiles();
        } catch (error) {
            logger.error('System maintenance failed', { error: error.message });
        }
    }

    /**
     * 优化 SQLite 数据库 (VACUUM)
     */
    async optimizeDatabases() {
        logger.info('Starting database optimization (VACUUM)...');

        if (!fs.existsSync(this.dataDir)) {
            logger.warn(`Data directory not found: ${this.dataDir}`);
            return;
        }

        const files = fs.readdirSync(this.dataDir);
        const dbFiles = files.filter(file => file.endsWith('.db'));

        let successCount = 0;
        let failCount = 0;

        for (const file of dbFiles) {
            const dbPath = path.join(this.dataDir, file);
            logger.debug(`Optimizing database: ${file}`);

            let db = null;
            try {
                // 连接数据库并执行 VACUUM
                db = new Database(dbPath);
                db.pragma('journal_mode = WAL'); // 确保是 WAL 模式
                db.exec('VACUUM;');

                // 获取新大小
                const stats = fs.statSync(dbPath);
                logger.info(`Database optimized: ${file}`, { size: stats.size });
                successCount++;
            } catch (err) {
                logger.error(`Failed to optimize database: ${file}`, { error: err.message });
                failCount++;
            } finally {
                if (db) db.close();
            }
        }

        logger.info(`Database optimization completed. Success: ${successCount}, Failed: ${failCount}`);
    }

    /**
     * 清理旧日志和备份文件
     */
    async cleanupOldFiles() {
        logger.info(`Starting file cleanup (Retention: ${this.retentionDays} days)...`);
        const now = Date.now();
        const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        // 1. 清理日志文件
        if (fs.existsSync(this.logsDir)) {
            const logFiles = fs.readdirSync(this.logsDir);
            for (const file of logFiles) {
                // 只清理 .log 文件 (包括轮转的 .log.2023-12-01)
                if (!file.includes('.log')) continue;

                const filePath = path.join(this.logsDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                        logger.info(`Deleted old log file: ${file}`);
                        deletedCount++;
                    }
                } catch (err) {
                    logger.warn(`Failed to delete file: ${file}`, { error: err.message });
                }
            }
        }

        // 2. 清理数据库备份 (如果将来有备份功能)
        // 假设备份在 data/backups 或 backups 目录，目前暂未实现备份逻辑，预留位置

        logger.info(`File cleanup completed. Deleted ${deletedCount} files.`);
    }
}

export default new SystemMaintenanceService();
