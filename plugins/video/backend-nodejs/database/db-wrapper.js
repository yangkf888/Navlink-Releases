const Database = require('better-sqlite3');

// 全局数据库实例列表，用于优雅关闭
const allDatabaseInstances = [];

/**
 * DatabaseWrapper (CommonJS 版本)
 * 兼容 sqlite3 API 的包装器，使用 better-sqlite3 作为底层实现
 */
class DatabaseWrapper {
    constructor(filename, options = {}) {
        this.db = new Database(filename, options);
        this.filename = filename;
        this.checkpointTimer = null;

        // 启用外键约束和 WAL 模式
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        // 🚀 解决 database is locked 的关键：设置 busy_timeout
        this.db.pragma('busy_timeout = 10000');

        // 设置 WAL 自动 checkpoint 阈值
        this.db.pragma('wal_autocheckpoint = 2000');

        // 启动定期 checkpoint（每30秒）
        this.startCheckpointTimer();

        // 注册到全局实例列表
        allDatabaseInstances.push(this);

        console.log(`[Database] SQLite initialized at: ${filename}`);
    }

    /**
     * 启动定期 WAL checkpoint 定时器
     */
    startCheckpointTimer() {
        // 每30秒执行一次 checkpoint，确保数据持久化
        this.checkpointTimer = setInterval(() => {
            this.checkpoint();
        }, 30000);

        // 确保定时器不阻止进程退出
        if (this.checkpointTimer.unref) {
            this.checkpointTimer.unref();
        }
    }

    /**
     * 执行 WAL checkpoint，将数据持久化到主数据库文件
     */
    checkpoint() {
        try {
            if (this.db && this.db.open) {
                this.db.pragma('wal_checkpoint(PASSIVE)');
            }
        } catch (err) {
            console.error(`[Database] Checkpoint failed for ${this.filename}:`, err.message);
        }
    }

    run(sql, params = [], callback) {
        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.run(...(Array.isArray(params) ? params : [params]));

            const returnValue = {
                changes: result.changes,
                lastID: result.lastInsertRowid
            };

            if (callback) {
                callback.call(returnValue, null);
            }

            return returnValue;
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
    }

    get(sql, params = [], callback) {
        try {
            const stmt = this.db.prepare(sql);
            const row = stmt.get(...(Array.isArray(params) ? params : [params]));

            if (callback) {
                callback(null, row);
            }

            return row;
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
    }

    all(sql, params = [], callback) {
        try {
            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...(Array.isArray(params) ? params : [params]));

            if (callback) {
                callback(null, rows);
            }

            return rows;
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
    }

    exec(sql, callback) {
        try {
            this.db.exec(sql);

            if (callback) {
                callback(null);
            }
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
    }

    prepare(sql) {
        return this.db.prepare(sql);
    }

    close(callback) {
        try {
            // 停止 checkpoint 定时器
            if (this.checkpointTimer) {
                clearInterval(this.checkpointTimer);
                this.checkpointTimer = null;
            }

            // 关闭前执行最后一次 checkpoint
            if (this.db && this.db.open) {
                try {
                    this.db.pragma('wal_checkpoint(TRUNCATE)');
                    console.log(`[Database] Final checkpoint completed for: ${this.filename}`);
                } catch (e) {
                    console.error(`[Database] Final checkpoint failed:`, e.message);
                }
            }

            // 从全局列表中移除
            const idx = allDatabaseInstances.indexOf(this);
            if (idx > -1) {
                allDatabaseInstances.splice(idx, 1);
            }

            this.db.close();

            if (callback) {
                callback(null);
            }
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
    }

    transaction(fn) {
        return this.db.transaction(fn);
    }

    pragma(pragma) {
        return this.db.pragma(pragma);
    }
}

/**
 * 优雅关闭所有数据库实例
 * 在进程退出前执行 checkpoint 并关闭数据库
 */
function gracefulShutdown(signal) {
    console.log(`[Database] Received ${signal}, performing graceful shutdown...`);

    for (const instance of allDatabaseInstances) {
        try {
            if (instance.db && instance.db.open) {
                // 执行完整的 checkpoint
                instance.db.pragma('wal_checkpoint(TRUNCATE)');
                console.log(`[Database] Checkpoint completed for: ${instance.filename}`);
                instance.db.close();
                console.log(`[Database] Closed: ${instance.filename}`);
            }
        } catch (err) {
            console.error(`[Database] Error during shutdown for ${instance.filename}:`, err.message);
        }
    }

    // 清空实例列表
    allDatabaseInstances.length = 0;
}

// 注册进程退出信号处理
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => gracefulShutdown('beforeExit'));

module.exports = DatabaseWrapper;

