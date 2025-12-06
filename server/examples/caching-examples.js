import cacheService from '../services/CacheService.js';
import { cacheMiddleware, tenantCacheMiddleware, userCacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

/**
 * 缓存使用示例和最佳实践
 */

// ===========================
// 1. 基础缓存使用
// ===========================

/**
 * 示例1: 缓存API响应 (通过中间件)
 */
export const exampleCacheMiddleware = () => {
    // 在路由中使用
    // app.get('/api/data', cacheMiddleware({ ttl: 300 }), handler);
    
    // 这会自动缓存GET请求的响应5分钟
};

/**
 * 示例2: 手动缓存和获取
 */
export const exampleManualCache = async () => {
    // 设置缓存
    await cacheService.set('user:123', { name: 'John', role: 'admin' }, 3600);
    
    // 获取缓存
    const user = await cacheService.get('user:123');
    console.log(user); // { name: 'John', role: 'admin' }
    
    // 删除缓存
    await cacheService.del('user:123');
};

/**
 * 示例3: 使用缓存装饰器
 */
export const exampleCachedFunction = async (userId) => {
    return await cacheService.cached(
        `user:profile:${userId}`,
        async () => {
            // 这个函数只在缓存未命中时执行
            // 模拟数据库查询
            return { id: userId, name: 'John Doe', email: 'john@example.com' };
        },
        3600 // TTL: 1小时
    );
};

// ===========================
// 2. 租户级缓存
// ===========================

/**
 * 示例4: 租户级缓存 (自动隔离)
 */
export const exampleTenantCache = () => {
    // 在路由中使用
    // app.get('/api/tenant-data', authenticateToken, tenantCacheMiddleware({ ttl: 600 }), handler);
    
    // 缓存键会自动添加租户ID前缀: tenant:tenant_123:/api/tenant-data
    // 不同租户的数据自动隔离
};

/**
 * 示例5: 手动租户级缓存
 */
export const exampleManualTenantCache = async (tenantId, data) => {
    const key = `tenant:${tenantId}:settings`;
    await cacheService.set(key, data, 1800); // 30分钟
};

// ===========================
// 3. 用户级缓存
// ===========================

/**
 * 示例6: 用户级缓存
 */
export const exampleUserCache = () => {
    // app.get('/api/user-preferences', authenticateToken, userCacheMiddleware({ ttl: 1800 }), handler);
    
    // 缓存键会自动添加用户ID: user:user_456:/api/user-preferences
};

// ===========================
// 4. 缓存失效策略
// ===========================

/**
 * 示例7: 自动失效相关缓存
 */
export const exampleCacheInvalidation = () => {
    // 当更新数据时,自动失效相关缓存
    // app.post('/api/users/:id', 
    //     authenticateToken, 
    //     invalidateCacheMiddleware([
    //         'user:*',           // 失效所有用户缓存
    //         'tenant:*/users'    // 失效所有租户的用户列表
    //     ]),
    //     handler
    // );
};

/**
 * 示例8: 动态失效模式
 */
export const exampleDynamicInvalidation = () => {
    // app.put('/api/tenant/:tenantId/settings',
    //     authenticateToken,
    //     invalidateCacheMiddleware([
    //         (req) => `tenant:${req.params.tenantId}:*`  // 动态生成失效模式
    //     ]),
    //     handler
    // );
};

/**
 * 示例9: 手动批量失效
 */
export const exampleBatchInvalidation = async () => {
    // 失效所有用户相关的缓存
    const count = await cacheService.delPattern('user:*');
    console.log(`Invalidated ${count} keys`);
};

// ===========================
// 5. 缓存预热
// ===========================

/**
 * 示例10: 启动时预热常用数据
 */
export const exampleCacheWarmup = async () => {
    // 预热系统配置
    await cacheService.set('system:config', {
        siteName: 'NavLink',
        version: '2.0.0',
        features: ['multi-tenant', 'caching']
    }, 3600 * 24); // 24小时

    // 预热热门数据
    const popularLinks = [/* ... */];
    await cacheService.set('popular:links', popularLinks, 3600); // 1小时
};

// ===========================
// 6. 高级用法
// ===========================

/**
 * 示例11: 缓存穿透保护 (空值缓存)
 */
export const exampleCacheNullValue = async (userId) => {
    const key = `user:${userId}`;
    
    // 尝试从缓存获取
    let user = await cacheService.get(key);
    if (user !== null) {
        return user === 'NULL' ? null : user;
    }
    
    // 从数据库查询
    user = await fetchUserFromDB(userId);
    
    // 如果用户不存在,缓存空值标记(短TTL)
    if (!user) {
        await cacheService.set(key, 'NULL', 60); // 1分钟
        return null;
    }
    
    // 缓存正常数据
    await cacheService.set(key, user, 3600);
    return user;
};

/**
 * 示例12: 缓存雪崩保护 (随机TTL)
 */
export const exampleRandomTTL = async (key, data) => {
    // 基础TTL + 随机值,避免大量缓存同时过期
    const baseTTL = 3600;
    const randomTTL = Math.floor(Math.random() * 300); // 0-5分钟
    await cacheService.set(key, data, baseTTL + randomTTL);
};

/**
 * 示例13: 分布式锁 (简单实现)
 */
export const exampleDistributedLock = async (lockKey, callback, timeout = 10) => {
    const lockValue = Date.now().toString();
    
    // 尝试获取锁
    const acquired = !(await cacheService.exists(lockKey));
    if (!acquired) {
        throw new Error('Failed to acquire lock');
    }
    
    await cacheService.set(lockKey, lockValue, timeout);
    
    try {
        // 执行业务逻辑
        return await callback();
    } finally {
        // 释放锁
        await cacheService.del(lockKey);
    }
};

/**
 * 示例14: 计数器 (限流、统计等)
 */
export const exampleCounter = async (key) => {
    const count = await cacheService.get(key) || 0;
    await cacheService.set(key, count + 1, 60); // 1分钟窗口
    return count + 1;
};

/**
 * 示例15: 会话缓存
 */
export const exampleSessionCache = async (sessionId, sessionData) => {
    const key = `session:${sessionId}`;
    await cacheService.set(key, sessionData, 1800); // 30分钟
    
    // 每次访问时刷新过期时间
    await cacheService.expire(key, 1800);
};

// ===========================
// 7. 监控和调试
// ===========================

/**
 * 示例16: 获取缓存统计
 */
export const exampleCacheStats = async () => {
    const stats = await cacheService.getStats();
    console.log('Cache Type:', stats.type); // 'redis' 或 'memory'
    console.log('Available:', stats.available);
    
    if (stats.type === 'redis') {
        console.log('Redis Info:', stats.redis);
    } else {
        console.log('Memory Keys:', stats.memory.keys);
    }
};

/**
 * 示例17: 缓存命中率监控
 */
export const exampleHitRateMonitor = () => {
    let hits = 0;
    let misses = 0;
    
    const getWithMetrics = async (key) => {
        const value = await cacheService.get(key);
        if (value !== null) {
            hits++;
        } else {
            misses++;
        }
        
        const hitRate = hits / (hits + misses);
        console.log(`Cache Hit Rate: ${(hitRate * 100).toFixed(2)}%`);
        
        return value;
    };
    
    return getWithMetrics;
};

// ===========================
// 辅助函数
// ===========================

async function fetchUserFromDB(userId) {
    // 模拟数据库查询
    return { id: userId, name: 'John Doe' };
}

// ===========================
// 最佳实践总结
// ===========================

/**
 * 缓存最佳实践:
 * 
 * 1. TTL设置:
 *    - 静态数据: 长TTL (24小时+)
 *    - 半静态数据: 中等TTL (1-6小时)
 *    - 动态数据: 短TTL (5-30分钟)
 *    - 实时数据: 不缓存或极短TTL (<1分钟)
 * 
 * 2. 缓存键命名:
 *    - 使用冒号分隔: resource:id:field
 *    - 包含版本号: v1:user:123
 *    - 包含租户ID: tenant:tenant_123:resource
 * 
 * 3. 缓存失效:
 *    - 主动失效: 数据更新时立即失效
 *    - 被动失效: 依赖TTL自动过期
 *    - 批量失效: 使用模式匹配
 * 
 * 4. 避免问题:
 *    - 缓存穿透: 缓存空值
 *    - 缓存击穿: 使用锁机制
 *    - 缓存雪崩: 随机TTL
 *    - 热点数据: 多级缓存
 * 
 * 5. 监控指标:
 *    - 命中率 (>80%理想)
 *    - 响应时间
 *    - 缓存大小
 *    - 失效频率
 */

export default {
    exampleCacheMiddleware,
    exampleManualCache,
    exampleCachedFunction,
    exampleTenantCache,
    exampleUserCache,
    exampleCacheInvalidation,
    exampleCacheWarmup,
    exampleCacheStats
};
