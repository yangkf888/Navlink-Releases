/**
 * 租户隔离中间件
 * 确保用户只能访问自己租户的数据
 */

/**
 * 验证租户访问权限
 * 确保用户只能访问自己租户的数据
 */
export function enforceTenantIsolation(req, res, next) {
    // 如果请求中包含tenantId参数,检查是否与用户的tenantId一致
    const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
    
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
        // 只有超级管理员可以跨租户访问
        if (req.user.role !== 'admin' || req.user.tenantId !== 'default') {
            console.warn(`[TenantIsolation] User ${req.user.username} attempted to access tenant ${requestedTenantId}`);
            return res.status(403).json({ 
                error: 'Access denied: Cannot access data from other tenants' 
            });
        }
    }
    
    next();
}

/**
 * 自动注入租户ID到请求
 * 用于确保所有数据操作都带有租户ID
 */
export function injectTenantId(req, res, next) {
    // 将用户的tenantId注入到请求中
    req.tenantId = req.user.tenantId;
    
    // 如果是POST/PUT请求,自动添加tenantId到body
    if ((req.method === 'POST' || req.method === 'PUT') && req.body && !req.body.tenantId) {
        req.body.tenantId = req.user.tenantId;
    }
    
    next();
}

/**
 * 检查租户状态
 * 确保租户处于活动状态
 */
export function checkTenantStatus(tenantService) {
    return async (req, res, next) => {
        try {
            const tenant = await tenantService.getTenant(req.user.tenantId);
            
            if (tenant.status !== 'active') {
                return res.status(403).json({ 
                    error: `Tenant is ${tenant.status}`,
                    message: '您的租户账号已被暂停或删除'
                });
            }
            
            // 将租户信息添加到请求中
            req.tenant = tenant;
            next();
        } catch (error) {
            console.error('[TenantIsolation] Failed to check tenant status:', error);
            res.status(500).json({ error: 'Failed to verify tenant status' });
        }
    };
}

/**
 * 只允许默认租户的管理员访问
 * 用于租户管理等敏感操作
 */
export function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'admin' || req.user.tenantId !== 'default') {
        console.warn(`[TenantIsolation] Non-super-admin user ${req.user.username} attempted admin operation`);
        return res.status(403).json({ 
            error: 'Access denied: Super admin required' 
        });
    }
    next();
}
