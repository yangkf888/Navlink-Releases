import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

interface Permission {
    key: string;
    name: string;
}

interface RolePermissions {
    role: string;
    permissions: string[];
}

const PERMISSION_NAMES: { [key: string]: string } = {
    'user:view': '查看用户',
    'user:create': '创建用户',
    'user:update': '更新用户',
    'user:delete': '删除用户',
    'plugin:view': '查看插件',
    'plugin:start': '启动插件',
    'plugin:stop': '停止插件',
    'plugin:install': '安装插件',
    'plugin:delete': '删除插件',
    'config:view': '查看配置',
    'config:update': '更新配置',
    'nav:view': '查看导航',
    'nav:create': '创建导航',
    'nav:update': '更新导航',
    'nav:delete': '删除导航',
    'system:view': '查看系统',
    'system:manage': '系统管理',
};

const ROLE_NAMES: { [key: string]: string } = {
    admin: '管理员',
    editor: '编辑者',
    user: '普通用户',
};

export default function Permissions() {
    const [roles, setRoles] = useState<string[]>([]);
    const [rolePermissions, setRolePermissions] = useState<{ [role: string]: string[] }>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            const token = localStorage.getItem('auth_token');

            // 获取所有角色
            const rolesRes = await fetch('/api/roles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const rolesData = await rolesRes.json();
            setRoles(rolesData);

            // 获取每个角色的权限
            const permissionsMap: { [role: string]: string[] } = {};
            for (const role of rolesData) {
                const permRes = await fetch(`/api/roles/${role}/permissions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const permData = await permRes.json();
                permissionsMap[role] = permData.permissions;
            }
            setRolePermissions(permissionsMap);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 按类别分组权限
    const groupedPermissions = Object.entries(PERMISSION_NAMES).reduce((acc, [key, name]) => {
        const category = key.split(':')[0];
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push({ key, name });
        return acc;
    }, {} as { [category: string]: Permission[] });

    const categoryNames: { [key: string]: string } = {
        user: '👤 用户管理',
        plugin: '🔌 插件管理',
        config: '⚙️ 配置管理',
        nav: '🧭 导航管理',
        system: '🖥️ 系统管理',
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">权限管理</h1>
                    <p className="text-sm text-gray-500 mt-1">查看角色和权限配置</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-4">加载中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <Shield className="text-blue-600" size={32} />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">权限管理</h1>
                    <p className="text-sm text-gray-500 mt-1">查看系统角色和权限配置</p>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* 角色说明卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {roles.map(role => {
                    const permCount = rolePermissions[role]?.length || 0;
                    return (
                        <div key={role} className="bg-white rounded-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {ROLE_NAMES[role] || role}
                                </h3>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    {permCount} 个权限
                                </span>
                            </div>
                            <p className="text-sm text-gray-500">
                                {role === 'admin' && '拥有系统全部权限'}
                                {role === 'editor' && '可以管理内容,但不能管理用户和系统'}
                                {role === 'user' && '只能查看内容,无法修改'}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* 权限矩阵 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">权限矩阵</h2>
                    <p className="text-sm text-gray-500 mt-1">查看每个角色拥有的具体权限</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                                    权限
                                </th>
                                {roles.map(role => (
                                    <th key={role} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {ROLE_NAMES[role] || role}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {Object.entries(groupedPermissions).map(([category, permissions]) => (
                                <React.Fragment key={category}>
                                    {/* 分类标题行 */}
                                    <tr className="bg-gray-50">
                                        <td colSpan={roles.length + 1} className="px-6 py-3 text-sm font-semibold text-gray-700">
                                            {categoryNames[category] || category}
                                        </td>
                                    </tr>
                                    {/* 权限行 */}
                                    {permissions.map(perm => (
                                        <tr key={perm.key} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 sticky left-0 bg-white">
                                                {perm.name}
                                                <span className="text-xs text-gray-400 ml-2">({perm.key})</span>
                                            </td>
                                            {roles.map(role => {
                                                const hasPermission = rolePermissions[role]?.includes(perm.key);
                                                return (
                                                    <td key={role} className="px-6 py-4 text-center">
                                                        {hasPermission ? (
                                                            <CheckCircle className="inline text-green-600" size={20} />
                                                        ) : (
                                                            <XCircle className="inline text-gray-300" size={20} />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 说明文档 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 权限说明</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>管理员</strong>: 拥有系统所有权限,包括用户管理、插件管理和系统配置</li>
                    <li>• <strong>编辑者</strong>: 可以管理导航内容和配置,但无法管理用户和系统</li>
                    <li>• <strong>普通用户</strong>: 只能查看系统信息,无法进行任何修改操作</li>
                </ul>
            </div>
        </div>
    );
}
