/**
 * 前端权限检查工具
 * 用于在React组件中检查当前用户是否有某个权限
 */

import { useState, useEffect } from 'react';

// 权限常量 (与后端保持一致)
export const PERMISSIONS = {
    USER_VIEW: 'user:view',
    USER_CREATE: 'user:create',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',
    
    PLUGIN_VIEW: 'plugin:view',
    PLUGIN_START: 'plugin:start',
    PLUGIN_STOP: 'plugin:stop',
    PLUGIN_INSTALL: 'plugin:install',
    PLUGIN_DELETE: 'plugin:delete',
    
    CONFIG_VIEW: 'config:view',
    CONFIG_UPDATE: 'config:update',
    
    NAV_VIEW: 'nav:view',
    NAV_CREATE: 'nav:create',
    NAV_UPDATE: 'nav:update',
    NAV_DELETE: 'nav:delete',
    
    SYSTEM_VIEW: 'system:view',
    SYSTEM_MANAGE: 'system:manage',
};

/**
 * Hook: 获取当前用户的所有权限
 */
export function usePermissions() {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [role, setRole] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/user/permissions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setPermissions(data.permissions);
                    setRole(data.role);
                }
            } catch (error) {
                console.error('[Permissions] Failed to fetch permissions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, []);

    return { permissions, role, loading };
}

/**
 * Hook: 检查是否有某个权限
 */
export function useHasPermission(permission: string) {
    const { permissions, loading } = usePermissions();
    return {
        hasPermission: permissions.includes(permission),
        loading
    };
}

/**
 * Hook: 检查是否有任一权限
 */
export function useHasAnyPermission(requiredPermissions: string[]) {
    const { permissions, loading } = usePermissions();
    const hasAny = requiredPermissions.some(perm => permissions.includes(perm));
    return { hasPermission: hasAny, loading };
}

/**
 * Hook: 检查是否有所有权限
 */
export function useHasAllPermissions(requiredPermissions: string[]) {
    const { permissions, loading } = usePermissions();
    const hasAll = requiredPermissions.every(perm => permissions.includes(perm));
    return { hasPermission: hasAll, loading };
}

/**
 * Hook: 检查是否是管理员
 */
export function useIsAdmin() {
    const { role, loading } = usePermissions();
    return { isAdmin: role === 'admin', loading };
}
