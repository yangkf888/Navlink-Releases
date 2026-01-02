const Database = require('better-sqlite3');

/**
 * DatabaseWrapper (CommonJS 版本)
 * 兼容 sqlite3 API 的包装器，使用 better-sqlite3 作为底层实现
 */
class DatabaseWrapper {
    constructor(filename, options = {}) {
        this.db = new Database(filename, options);

        // 启用外键约束和 WAL 模式
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        console.log(`[Database] SQLite initialized at: ${filename}`);
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

module.exports = DatabaseWrapper;
