import Database from 'better-sqlite3';

/**
 * DatabaseWrapper - 兼容 sqlite3 API 的包装器
 * 使用 better-sqlite3 作为底层实现，提供同步 API
 */
export class DatabaseWrapper {
    constructor(filename, options = {}) {
        // 创建 better-sqlite3 数据库实例，增加超时重试时间
        this.db = new Database(filename, { timeout: 5000, ...options });

        // 启用外键约束和 WAL 模式（提升并发性能）
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('foreign_keys = ON');

        console.log(`[AuthDB] Database opened: ${filename}`);
    }

    /**
     * 兼容 sqlite3 的 run 方法
     * @param {string} sql - SQL 语句
     * @param {Array|any} params - 参数
     * @param {Function} callback - 可选的回调函数
     * @returns {Object} - { changes, lastID }
     */
    run(sql, params = [], callback) {
        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.run(...(Array.isArray(params) ? params : [params]));

            const returnValue = {
                changes: result.changes,
                lastID: result.lastInsertRowid
            };

            if (callback) {
                // 模拟 sqlite3 的 callback(err) + this.changes/lastID
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

    /**
     * 兼容 sqlite3 的 get 方法
     * @param {string} sql - SQL 语句
     * @param {Array|any} params - 参数
     * @param {Function} callback - 可选的回调函数
     * @returns {Object|undefined} - 单行数据或 undefined
     */
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

    /**
     * 兼容 sqlite3 的 all 方法
     * @param {string} sql - SQL 语句
     * @param {Array|any} params - 参数
     * @param {Function} callback - 可选的回调函数
     * @returns {Array} - 所有行数据
     */
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

    /**
     * 兼容 sqlite3 的 exec 方法
     * @param {string} sql - SQL 语句（可以是多条语句）
     * @param {Function} callback - 可选的回调函数
     */
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

    /**
     * 兼容 sqlite3 的 prepare 方法
     * @param {string} sql - SQL 语句
     * @returns {Statement} - better-sqlite3 的 Statement 对象
     */
    prepare(sql) {
        return this.db.prepare(sql);
    }

    /**
     * 兼容 sqlite3 的 close 方法
     * @param {Function} callback - 可选的回调函数
     */
    close(callback) {
        try {
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

    /**
     * 执行事务
     * @param {Function} fn - 事务函数
     * @returns {Function} - 事务包装器
     */
    transaction(fn) {
        return this.db.transaction(fn);
    }

    /**
     * 设置 PRAGMA
     * @param {string} pragma - PRAGMA 语句
     * @returns {any} - PRAGMA 结果
     */
    pragma(pragma) {
        return this.db.pragma(pragma);
    }
}
