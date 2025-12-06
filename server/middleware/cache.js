import cacheService from '../services/CacheService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CacheMiddleware');

/**
 * 响应缓存中间件
 * 缓存GET请求的响应
 */
export const cacheMiddleware = (options = {}) => {
    const {
        ttl = 300, // 默认5分钟
        keyPrefix = 'api:',
        excludePaths = [],
        includeQuery = true,
        varyBy = [] // 额外的缓存键变量(如header)
    } = options;

    return async (req, res, next) => {
        // 只缓存GET请求
        if (req.method !== 'GET') {
            return next();
        }

        // 检查是否在排除列表中
        if (excludePaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // 生成缓存键
        let cacheKey = keyPrefix + req.path;
        
        if (includeQuery && Object.keys(req.query).length > 0) {
            const queryString = new URLSearchParams(req.query).toString();
            cacheKey += '?' + queryString;
        }

        // 添加额外的变量
        for (const header of varyBy) {
            const value = req.get(header);
            if (value) {
                cacheKey += `:${header}:${value}`;
            }
        }

        // 尝试从缓存获取
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('Cache hit', { key: cacheKey });
            
            // 添加缓存头
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Key', cacheKey);
            
            return res.json(cached);
        }

        logger.debug('Cache miss', { key: cacheKey });
        res.set('X-Cache', 'MISS');

        // 拦截原始的res.json方法
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            // 只缓存成功的响应
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cacheService.set(cacheKey, data, ttl).catch(err => {
                    logger.error('Failed to cache response', { 
                        key: cacheKey, 
                        error: err.message 
                    });
                });
            }
            
            return originalJson(data);
        };

        next();
    };
};

/**
 * 租户级缓存中间件
 * 自动添加租户ID到缓存键
 */
export const tenantCacheMiddleware = (options = {}) => {
    const {
        ttl = 300,
        keyPrefix = 'tenant:',
        ...otherOptions
    } = options;

    return async (req, res, next) => {
        const tenantId = req.user?.tenantId || req.headers['x-nav-tenant-id'] || 'default';
        
        const modifiedOptions = {
            ...otherOptions,
            ttl,
            keyPrefix: `${keyPrefix}${tenantId}:`,
        };

        return cacheMiddleware(modifiedOptions)(req, res, next);
    };
};

/**
 * 用户级缓存中间件
 * 自动添加用户ID到缓存键
 */
export const userCacheMiddleware = (options = {}) => {
    const {
        ttl = 300,
        keyPrefix = 'user:',
        ...otherOptions
    } = options;

    return async (req, res, next) => {
        const userId = req.user?.id || req.headers['x-nav-user-id'];
        
        if (!userId) {
            // 如果没有用户ID,不使用缓存
            return next();
        }

        const modifiedOptions = {
            ...otherOptions,
            ttl,
            keyPrefix: `${keyPrefix}${userId}:`,
        };

        return cacheMiddleware(modifiedOptions)(req, res, next);
    };
};

/**
 * 缓存失效中间件
 * 在数据修改后自动失效相关缓存
 */
export const invalidateCacheMiddleware = (patterns = []) => {
    return async (req, res, next) => {
        // 拦截原始的响应方法
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        const invalidateCache = async () => {
            // 只在成功的修改操作后失效缓存
            if (res.statusCode >= 200 && res.statusCode < 300) {
                for (const pattern of patterns) {
                    try {
                        let finalPattern = pattern;
                        
                        // 支持动态模式(使用req对象)
                        if (typeof pattern === 'function') {
                            finalPattern = pattern(req);
                        }

                        const count = await cacheService.delPattern(finalPattern);
                        if (count > 0) {
                            logger.info('Cache invalidated', { 
                                pattern: finalPattern, 
                                count 
                            });
                        }
                    } catch (err) {
                        logger.error('Cache invalidation error', { 
                            pattern, 
                            error: err.message 
                        });
                    }
                }
            }
        };

        res.json = async (data) => {
            await invalidateCache();
            return originalJson(data);
        };

        res.send = async (data) => {
            await invalidateCache();
            return originalSend(data);
        };

        next();
    };
};

/**
 * 缓存预热辅助函数
 */
export const warmupCache = async (key, fn, ttl = 3600) => {
    try {
        const data = await fn();
        await cacheService.set(key, data, ttl);
        logger.info('Cache warmed up', { key });
        return data;
    } catch (error) {
        logger.error('Cache warmup failed', { key, error: error.message });
        throw error;
    }
};

/**
 * 批量缓存预热
 */
export const warmupCaches = async (tasks = []) => {
    const results = [];
    
    for (const { key, fn, ttl } of tasks) {
        try {
            const data = await warmupCache(key, fn, ttl);
            results.push({ key, success: true, data });
        } catch (error) {
            results.push({ key, success: false, error: error.message });
        }
    }

    return results;
};

export default {
    cacheMiddleware,
    tenantCacheMiddleware,
    userCacheMiddleware,
    invalidateCacheMiddleware,
    warmupCache,
    warmupCaches
};
