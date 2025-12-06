/**
 * Winston日志系统配置
 * 提供结构化日志、日志轮转、多级别日志等功能
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志目录
const LOG_DIR = path.join(__dirname, '../../logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 自定义日志格式
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;

        if (context) {
            log += ` [${context}]`;
        }

        log += `: ${message}`;

        // 添加额外的元数据
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }

        return log;
    })
);

// 文件日志格式(JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// 控制台输出格式(带颜色)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, context }) => {
        let log = `${timestamp} ${level}`;
        if (context) {
            log += ` [${context}]`;
        }
        log += `: ${message}`;
        return log;
    })
);

// 创建日志传输配置
const transports = [];

// 控制台输出
transports.push(
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info'
    })
);

// 错误日志(每天轮转)
transports.push(
    new DailyRotateFile({
        filename: path.join(LOG_DIR, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat
    })
);

// 组合日志(所有级别,每天轮转)
transports.push(
    new DailyRotateFile({
        filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format: fileFormat
    })
);

// 系统事件日志(info级别以上)
transports.push(
    new DailyRotateFile({
        filename: path.join(LOG_DIR, 'system-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat
    })
);

// 创建logger实例
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat, // Default to file format for other generic transports if any
    transports,
    exitOnError: false
});

// 创建不同上下文的logger
export function createLogger(context) {
    return {
        error: (message, meta = {}) => logger.error(message, { context, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
        info: (message, meta = {}) => logger.info(message, { context, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
        verbose: (message, meta = {}) => logger.verbose(message, { context, ...meta })
    };
}

// 导出默认logger
export default logger;

// 导出日志查询功能
export class LogQuery {
    /**
     * 查询日志文件
     * @param {object} options - 查询选项
     * @returns {Promise<Array>} 日志记录数组
     */
    static async queryLogs(options = {}) {
        const {
            level = null,
            context = null,
            startDate = null,
            endDate = null,
            limit = 100,
            logType = 'combined' // combined, error, system
        } = options;

        const logs = [];
        const logFiles = this.getLogFiles(logType, startDate, endDate);

        for (const file of logFiles) {
            const filePath = path.join(LOG_DIR, file);
            if (!fs.existsSync(filePath)) continue;

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    let log;
                    try {
                        log = JSON.parse(line);
                    } catch (e) {
                        // 兼容旧的文本格式: 2025-12-06 14:23:59 [WARN] [Auth]: Failed request ...
                        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\](?: \[([^\]]+)\])?: (.*)$/);
                        if (match) {
                            log = {
                                timestamp: match[1],
                                level: match[2].toLowerCase(),
                                context: match[3],
                                message: match[4]
                            };
                        } else {
                            continue; // Skip unknown format
                        }
                    }

                    // 过滤条件
                    if (level && log.level !== level) continue;
                    if (context && log.context !== context) continue;
                    if (startDate && new Date(log.timestamp) < new Date(startDate)) continue;
                    if (endDate && new Date(log.timestamp) > new Date(endDate)) continue;

                    logs.push(log);

                    if (logs.length >= limit) break;
                } catch (err) {
                    // 跳过无效的JSON行
                }
            }

            if (logs.length >= limit) break;
        }

        return logs.slice(0, limit).reverse(); // 最新的在前
    }

    /**
     * 获取日志文件列表
     */
    static getLogFiles(logType, startDate, endDate) {
        const files = fs.readdirSync(LOG_DIR);
        const pattern = new RegExp(`^${logType}-(\\d{4}-\\d{2}-\\d{2})\\.log$`);

        return files
            .filter(file => pattern.test(file))
            .sort()
            .reverse(); // 最新的在前
    }

    /**
     * 获取日志统计信息
     */
    static async getStats() {
        const files = fs.readdirSync(LOG_DIR);
        const stats = {
            totalFiles: files.length,
            totalSize: 0,
            filesByType: {
                error: 0,
                combined: 0,
                system: 0
            }
        };

        for (const file of files) {
            const filePath = path.join(LOG_DIR, file);
            const stat = fs.statSync(filePath);
            stats.totalSize += stat.size;

            if (file.startsWith('error-')) stats.filesByType.error++;
            else if (file.startsWith('combined-')) stats.filesByType.combined++;
            else if (file.startsWith('system-')) stats.filesByType.system++;
        }

        return stats;
    }
    /**
     * 获取详细日志文件列表
     */
    static listFiles() {
        const files = fs.readdirSync(LOG_DIR);
        return files
            .filter(file => file.endsWith('.log'))
            .map(file => {
                const filePath = path.join(LOG_DIR, file);
                const stat = fs.statSync(filePath);
                return {
                    name: file,
                    size: stat.size,
                    updatedAt: stat.mtime
                };
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
}
