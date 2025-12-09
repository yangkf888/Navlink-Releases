import { useState, useEffect } from 'react';

export interface UserPermissions {
    role: string;
    permissions: string[];
}

/**
 * 权限管理Hook
 * 用于检查当前用户的权限
 */
export function usePermissions() {
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await fetch('/api/user/permissions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setPermissions(data);
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 检查是否有指定权限
     */
    const hasPermission = (permission: string): boolean => {
        return permissions?.permissions.includes(permission) || false;
    };

    /**
     * 检查是否有任一权限
     */
    const hasAnyPermission = (perms: string[]): boolean => {
        if (!perms || perms.length === 0) return true;
        return perms.some(p => hasPermission(p));
    };

    /**
     * 检查是否有所有权限
     */
    const hasAllPermissions = (perms: string[]): boolean => {
        return perms.every(p => hasPermission(p));
    };

    /**
     * 检查是否是管理员
     */
    const isAdmin = (): boolean => {
        return permissions?.role === 'admin';
    };

    return {
        permissions,
        loading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
        reload: loadPermissions
    };
}
