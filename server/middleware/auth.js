import { AuthService } from '../services/AuthService.js';
import { hasPermission, hasAnyPermission } from '../config/permissions.js';

const authService = new AuthService();

/**
 * JWT 认证中间件
 */
export async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            console.log('[Auth] No token provided');
            return res.status(401).json({ error: 'Access token required' });
        }

        const user = await authService.verifyToken(token);
        req.user = user; // 将用户信息附加到 request
        next();
    } catch (error) {
        console.log('[Auth] Token verification failed:', error.message);
        return res.status(error.code || 403).json({ error: error.message });
    }
}

/**
 * 管理员权限中间件
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        console.log('[Auth] Admin access denied for user:', req.user?.username);
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

/**
 * 可选认证中间件 (Token 存在则验证,不存在则跳过)
 */
export async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const user = await authService.verifyToken(token);
            req.user = user;
        }
        next();
    } catch (error) {
        // Token 无效,但不阻止请求
        console.log('[Auth] Optional auth failed, continuing without user');
        next();
    }
}

/**
 * 权限检查中间件
 * @param {string|string[]} permissions - 需要的权限(单个或多个)
 */
export function requirePermission(permissions) {
    return (req, res, next) => {
        if (!req.user) {
            console.log('[Auth] Permission check failed: No user');
            return res.status(401).json({ error: 'Authentication required' });
        }

        const permissionList = Array.isArray(permissions) ? permissions : [permissions];

        // 检查用户是否有任一所需权限
        if (!hasAnyPermission(req.user.role, permissionList)) {
            console.log('[Auth] Permission denied:', {
                user: req.user.username,
                role: req.user.role,
                required: permissionList
            });
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: permissionList
            });
        }

        next();
    };
}

/**
 * 要求所有权限的中间件
 * @param {string[]} permissions - 需要的所有权限
 */
export function requireAllPermissions(permissions) {
    return (req, res, next) => {
        if (!req.user) {
            console.log('[Auth] Permission check failed: No user');
            return res.status(401).json({ error: 'Authentication required' });
        }

        // 检查用户是否拥有所有所需权限
        const hasAll = permissions.every(permission =>
            hasPermission(req.user.role, permission)
        );

        if (!hasAll) {
            console.log('[Auth] Permission denied:', {
                user: req.user.username,
                role: req.user.role,
                required: permissions
            });
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: permissions
            });
        }

        next();
    };
}

/**
 * 验证token并返回用户信息 (用于WebSocket等非HTTP场景)
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} 用户信息或null
 */
export async function verifyToken(token) {
    try {
        return await authService.verifyToken(token);
    } catch (error) {
        return null;
    }
}
