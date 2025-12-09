import React from 'react';
import { usePermissions } from '@/shared/hooks/usePermissions';
import PermissionDenied from '@/apps/admin/pages/PermissionDenied';

interface RequirePermissionProps {
    permission: string | string[];
    requireAll?: boolean;
    children: React.ReactNode;
}

/**
 * 权限守卫组件
 * 用于保护需要特定权限的页面
 */
export function RequirePermission({
    permission,
    requireAll = false,
    children
}: RequirePermissionProps) {
    const { hasPermission, hasAllPermissions, hasAnyPermission, loading } = usePermissions();

    // 权限加载中
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    // 转换为数组
    const permissions = Array.isArray(permission) ? permission : [permission];

    // 检查权限
    const hasAccess = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);

    // 无权限则显示拒绝页面
    if (!hasAccess) {
        return <PermissionDenied />;
    }

    // 有权限则显示子组件
    return <>{children}</>;
}

export default RequirePermission;
