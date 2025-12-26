import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Lock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/AdminButton';

interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
    tenant_name: string;
    last_login: string | null;
    created_at: string;
}

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [error, setError] = useState('');

    // 加载用户列表
    const loadUsers = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // 删除用户
    const handleDelete = async (user: User) => {
        if (!confirm(`确定要删除用户 "${user.username}" 吗？`)) return;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete user');
            }

            loadUsers();
        } catch (err: any) {
            alert('删除失败: ' + err.message);
        }
    };

    // 切换用户状态
    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/users/${user.id}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update status');
            }

            loadUsers();
        } catch (err: any) {
            alert('状态更新失败: ' + err.message);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '从未登录';
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理系统用户</p>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理系统用户和权限</p>
                </div>
                <Button
                    onClick={() => {
                        setEditingUser(null);
                        setShowDialog(true);
                    }}
                    icon={<Plus size={20} />}
                >
                    新建用户
                </Button>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* 用户表格 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                用户名
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                邮箱
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                角色
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                状态
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                最后登录
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    暂无用户
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                                                {user.username[0].toUpperCase()}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {user.email || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin'
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {user.role === 'admin' ? '管理员' : '普通用户'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(user)}
                                            className="inline-flex items-center gap-1 text-sm"
                                        >
                                            {user.status === 'active' ? (
                                                <>
                                                    <CheckCircle size={16} className="text-green-600" />
                                                    <span className="text-green-600">正常</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle size={16} className="text-gray-400" />
                                                    <span className="text-gray-400">禁用</span>
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {formatDate(user.last_login)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setShowDialog(true);
                                                }}
                                                icon={<Edit size={16} />}
                                                title="编辑"
                                                className="!px-2"
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(user)}
                                                icon={<Trash2 size={16} />}
                                                title="删除"
                                                className="!px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 用户编辑对话框 */}
            {showDialog && (
                <UserDialog
                    user={editingUser}
                    onClose={() => {
                        setShowDialog(false);
                        setEditingUser(null);
                    }}
                    onSave={() => {
                        setShowDialog(false);
                        setEditingUser(null);
                        loadUsers();
                    }}
                />
            )}
        </div>
    );
}

// 用户编辑对话框组件
function UserDialog({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: () => void }) {
    const [formData, setFormData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        password: '',
        role: user?.role || 'user',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('auth_token');

            if (user) {
                // 编辑模式 - 更新用户
                const updateData: any = {};

                // 只提交有变化的字段
                if (formData.username !== user.username) {
                    updateData.username = formData.username;
                }
                if (formData.email !== user.email) {
                    updateData.email = formData.email;
                }
                if (formData.password) {
                    updateData.password = formData.password;
                }
                if (formData.role !== user.role) {
                    updateData.role = formData.role;
                }

                // 如果没有任何变化，直接关闭
                if (Object.keys(updateData).length === 0) {
                    onClose();
                    return;
                }

                const response = await fetch(`/api/users/${user.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to update user');
                }

                onSave();
            } else {
                // 新建用户
                if (!formData.password) {
                    setError('密码不能为空');
                    setLoading(false);
                    return;
                }

                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to create user');
                }

                onSave();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">
                    {user ? '编辑用户' : '新建用户'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            用户名
                        </label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="请输入用户名"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            邮箱
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="请输入邮箱"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {user ? '新密码（留空则不修改）' : '密码'}
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={user ? '留空则保持原密码' : '请输入密码'}
                            required={!user}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            角色
                        </label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="user">普通用户</option>
                            <option value="editor">编辑者</option>
                            <option value="admin">管理员</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            普通用户: 只能查看 | 编辑者: 可管理内容 | 管理员: 全部权限
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="submit"
                            disabled={loading}
                            variant="primary"
                            className="flex-1"
                            loading={loading}
                        >
                            {loading ? '保存中...' : '保存'}
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


// 导出组件（权限保护已在路由层统一处理）
export default UsersPage;
