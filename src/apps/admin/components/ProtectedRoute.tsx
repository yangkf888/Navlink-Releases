import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/shared/hooks/usePermissions';
import PermissionDenied from '../pages/PermissionDenied';

interface ProtectedRouteProps {
    permission?: string | string[];
    requireAll?: boolean;
    children: React.ReactNode;
}

/**
 * 路由守卫组件
 * 根据权限配置自动控制页面访问
 */
export function ProtectedRoute({
    permission,
    requireAll = false,
    children
}: ProtectedRouteProps) {
    const { hasPermission, hasAllPermissions, hasAnyPermission, loading } = usePermissions();

    // 权限加载中
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    // 无权限要求，直接显示
    if (!permission) {
        return <>{children}</>;
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

    // 有权限则显示页面
    return <>{children}</>;
}

export default ProtectedRoute;
