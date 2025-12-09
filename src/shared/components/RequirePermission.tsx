import React from 'react';
import { usePermissions } from '@/shared/hooks/usePermissions';
// import PermissionDenied from '@/apps/admin/pages/PermissionDenied'; // Not available in plugin context

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
    const { hasAllPermissions, hasAnyPermission, loading } = usePermissions();

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
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">
                        <i className="fa-solid fa-ban"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
                    <p className="text-gray-600">您没有权限访问此页面</p>
                </div>
            </div>
        );
    }

    // 有权限则显示子组件
    return <>{children}</>;
}

export default RequirePermission;
