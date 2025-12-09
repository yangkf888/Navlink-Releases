import Redis from 'ioredis';
import config from '../config/env.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Cache');

/**
 * Redis缓存服务
 * 支持回退到内存缓存(当Redis不可用时)
 */
class CacheService {
    constructor() {
        this.redis = null;
        this.memoryCache = new Map();
        this.memoryExpiry = new Map();
        this.isRedisAvailable = false;
        this.useMemoryFallback = true;
    }

    /**
     * 初始化Redis连接
     */
    async connect() {
        // 如果Redis未启用，直接使用内存缓存
        if (!config.redis.enabled) {
            logger.info('Redis disabled in config, using memory cache');
            this.useMemoryFallback = true;
            this.isRedisAvailable = false;
            this.startMemoryCacheCleanup();
            return true;
        }

        try {
            this.redis = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password || undefined,
                db: config.redis.db,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                connectTimeout: 10000,
                lazyConnect: true
            });

            // 尝试连接
            await this.redis.connect();

            this.redis.on('connect', () => {
                logger.info('Redis connected successfully');
                this.isRedisAvailable = true;
            });

            this.redis.on('error', (err) => {
                logger.error('Redis connection error', { error: err.message });
                this.isRedisAvailable = false;
            });

            this.redis.on('close', () => {
                logger.warn('Redis connection closed');
                this.isRedisAvailable = false;
            });

            this.redis.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
            });

            // 测试连接
            await this.redis.ping();
            logger.info('Redis ping successful');
            this.isRedisAvailable = true;

            // 启动内存缓存清理
            this.startMemoryCacheCleanup();

            return true;
        } catch (error) {
            logger.warn('Redis not available, using memory cache fallback', {
                error: error.message
            });
            this.isRedisAvailable = false;

            // 即使Redis不可用,也启动内存缓存清理
            this.startMemoryCacheCleanup();

            return false;
        }
    }

    /**
     * 启动内存缓存定期清理(清除过期项)
     */
    startMemoryCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, expiry] of this.memoryExpiry.entries()) {
                if (expiry <= now) {
                    this.memoryCache.delete(key);
                    this.memoryExpiry.delete(key);
                }
            }
        }, 60000); // 每分钟清理一次
    }

    /**
     * 获取缓存
     */
    async get(key) {
        try {
            if (this.isRedisAvailable && this.redis) {
                const value = await this.redis.get(key);
                if (value) {
                    return JSON.parse(value);
                }
                return null;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                const expiry = this.memoryExpiry.get(key);
                if (expiry && expiry <= Date.now()) {
                    // 已过期
                    this.memoryCache.delete(key);
                    this.memoryExpiry.delete(key);
                    return null;
                }
                const value = this.memoryCache.get(key);
                return value !== undefined ? value : null;
            }

            return null;
        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            return null;
        }
    }

    /**
     * 设置缓存
     * @param {string} key - 键
     * @param {any} value - 值(会被JSON序列化)
     * @param {number} ttl - 过期时间(秒),默认3600秒(1小时)
     */
    async set(key, value, ttl = 3600) {
        try {
            if (this.isRedisAvailable && this.redis) {
                await this.redis.setex(key, ttl, JSON.stringify(value));
                return true;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                this.memoryCache.set(key, value);
                this.memoryExpiry.set(key, Date.now() + ttl * 1000);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            return false;
        }
    }

    /**
     * 删除缓存
     */
    async del(key) {
        try {
            if (this.isRedisAvailable && this.redis) {
                await this.redis.del(key);
                return true;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                this.memoryCache.delete(key);
                this.memoryExpiry.delete(key);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return false;
        }
    }

    /**
     * 批量删除(支持模式匹配)
     */
    async delPattern(pattern) {
        try {
            if (this.isRedisAvailable && this.redis) {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
                return keys.length;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                let count = 0;
                for (const key of this.memoryCache.keys()) {
                    if (regex.test(key)) {
                        this.memoryCache.delete(key);
                        this.memoryExpiry.delete(key);
                        count++;
                    }
                }
                return count;
            }

            return 0;
        } catch (error) {
            logger.error('Cache delete pattern error', { pattern, error: error.message });
            return 0;
        }
    }

    /**
     * 检查键是否存在
     */
    async exists(key) {
        try {
            if (this.isRedisAvailable && this.redis) {
                return await this.redis.exists(key) === 1;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                const expiry = this.memoryExpiry.get(key);
                if (expiry && expiry <= Date.now()) {
                    return false;
                }
                return this.memoryCache.has(key);
            }

            return false;
        } catch (error) {
            logger.error('Cache exists error', { key, error: error.message });
            return false;
        }
    }

    /**
     * 设置过期时间
     */
    async expire(key, ttl) {
        try {
            if (this.isRedisAvailable && this.redis) {
                return await this.redis.expire(key, ttl) === 1;
            }

            // 内存缓存回退
            if (this.useMemoryFallback && this.memoryCache.has(key)) {
                this.memoryExpiry.set(key, Date.now() + ttl * 1000);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Cache expire error', { key, ttl, error: error.message });
            return false;
        }
    }

    /**
     * 获取剩余TTL
     */
    async ttl(key) {
        try {
            if (this.isRedisAvailable && this.redis) {
                return await this.redis.ttl(key);
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                const expiry = this.memoryExpiry.get(key);
                if (!expiry) return -2; // 键不存在
                const remaining = Math.floor((expiry - Date.now()) / 1000);
                return remaining > 0 ? remaining : -2;
            }

            return -2;
        } catch (error) {
            logger.error('Cache ttl error', { key, error: error.message });
            return -2;
        }
    }

    /**
     * 清空所有缓存
     */
    async flush() {
        try {
            if (this.isRedisAvailable && this.redis) {
                await this.redis.flushdb();
                logger.info('Redis cache flushed');
                return true;
            }

            // 内存缓存回退
            if (this.useMemoryFallback) {
                this.memoryCache.clear();
                this.memoryExpiry.clear();
                logger.info('Memory cache flushed');
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Cache flush error', { error: error.message });
            return false;
        }
    }

    /**
     * 获取缓存统计信息
     */
    async getStats() {
        try {
            const stats = {
                type: this.isRedisAvailable ? 'redis' : 'memory',
                available: this.isRedisAvailable || this.useMemoryFallback
            };

            if (this.isRedisAvailable && this.redis) {
                const info = await this.redis.info('stats');
                const keyspace = await this.redis.info('keyspace');
                stats.redis = {
                    connected: true,
                    info: info,
                    keyspace: keyspace
                };
            } else {
                stats.memory = {
                    keys: this.memoryCache.size,
                    expiryKeys: this.memoryExpiry.size
                };
            }

            return stats;
        } catch (error) {
            logger.error('Cache stats error', { error: error.message });
            return {
                type: 'unknown',
                available: false,
                error: error.message
            };
        }
    }

    /**
     * 关闭连接
     */
    async disconnect() {
        try {
            if (this.redis) {
                await this.redis.quit();
                logger.info('Redis disconnected');
            }
        } catch (error) {
            logger.error('Cache disconnect error', { error: error.message });
        }
    }

    /**
     * 缓存装饰器 - 自动缓存函数结果
     */
    async cached(key, fn, ttl = 3600) {
        // 尝试从缓存获取
        const cached = await this.get(key);
        if (cached !== null) {
            logger.debug('Cache hit', { key });
            return cached;
        }

        // 缓存未命中,执行函数
        logger.debug('Cache miss', { key });
        const result = await fn();

        // 存储到缓存
        await this.set(key, result, ttl);

        return result;
    }
}

// 创建单例实例
const cacheService = new CacheService();

export default cacheService;
export { CacheService };
