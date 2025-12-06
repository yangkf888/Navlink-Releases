import React, { useState, useEffect } from 'react';
import { Building2, Users, Plus, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/AdminButton';

interface Tenant {
    id: string;
    name: string;
    status: 'active' | 'suspended' | 'deleted';
    userCount: number;
    created_at: string;
    updated_at: string;
}

export default function Tenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/tenants', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('只有超级管理员可以管理租户');
                }
                throw new Error('加载租户列表失败');
            }

            const data = await response.json();
            setTenants(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (tenant: Tenant) => {
        if (!confirm(`确定要删除租户"${tenant.name}"吗?`)) return;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/tenants/${tenant.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '删除失败');
            }

            loadTenants();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleToggleStatus = async (tenant: Tenant) => {
        const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/tenants/${tenant.id}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error('更新状态失败');
            }

            loadTenants();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        <CheckCircle size={12} />
                        正常
                    </span>
                );
            case 'suspended':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        <AlertCircle size={12} />
                        暂停
                    </span>
                );
            case 'deleted':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                        <XCircle size={12} />
                        已删除
                    </span>
                );
            default:
                return <span className="text-gray-500">{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">租户管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理系统中的所有租户</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-4">加载中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">租户管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理系统中的所有租户</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <p className="text-red-800">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="text-blue-600" size={32} />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">租户管理</h1>
                        <p className="text-sm text-gray-500 mt-1">管理系统中的所有租户</p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowCreateDialog(true)}
                    icon={<Plus size={20} />}
                >
                    创建租户
                </Button>
            </div>

            {/* 租户列表 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">租户ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户数</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {tenants.map(tenant => (
                            <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-900 font-mono">{tenant.id}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{tenant.name}</td>
                                <td className="px-6 py-4">{getStatusBadge(tenant.status)}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <span className="inline-flex items-center gap-1">
                                        <Users size={16} className="text-gray-400" />
                                        {tenant.userCount}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {new Date(tenant.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {tenant.id !== 'default' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant={tenant.status === 'active' ? 'warning' : 'success'}
                                                    onClick={() => handleToggleStatus(tenant)}
                                                >
                                                    {tenant.status === 'active' ? '暂停' : '启用'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(tenant)}
                                                    icon={<Trash2 size={16} />}
                                                    title="删除"
                                                    className="!px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                />
                                            </>
                                        )}
                                        {tenant.id === 'default' && (
                                            <span className="text-xs text-gray-400">默认租户</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 创建租户对话框 */}
            {showCreateDialog && (
                <CreateTenantDialog
                    onClose={() => setShowCreateDialog(false)}
                    onSuccess={() => {
                        setShowCreateDialog(false);
                        loadTenants();
                    }}
                />
            )}
        </div>
    );
}

// 创建租户对话框组件
function CreateTenantDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/tenants', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '创建失败');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">创建新租户</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            租户名称
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="输入租户名称"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            type="submit"
                            disabled={loading}
                            variant="primary"
                            className="flex-1"
                            loading={loading}
                        >
                            {loading ? '创建中...' : '创建'}
                        </Button>
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="secondary"
                            className="flex-1"
                        >
                            取消
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
