import { useState, useEffect, useMemo } from 'react'
import { Plus, Copy, X, Edit2, Trash2, Search, ArrowUpDown } from 'lucide-react'

interface UserData {
    id: number
    email: string
    name: string
    code_count: number
    active_codes?: number
    max_activations?: number
    used_activations?: number
    status?: string
    expires_at?: string
    last_activation?: string
    created_at: string
}

interface ActivationCode {
    id: number
    code: string
    plan_type: string
    max_installs: number
    remaining_installs: number
    status: string
    created_at: string
    expires_at?: string
}

interface ActiveLicense {
    id: number
    email: string
    name: string
    activation_code: string
    fingerprint: string
    status: string
    activated_at: string
}

export default function Licenses() {
    const [users, setUsers] = useState<UserData[]>([])
    const [licenses, setLicenses] = useState<ActiveLicense[]>([])
    const [unboundCodes, setUnboundCodes] = useState<ActivationCode[]>([]) // 未绑定激活码列表
    const [showUserModal, setShowUserModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showCodesModal, setShowCodesModal] = useState(false)
    const [showBatchModal, setShowBatchModal] = useState(false) // 批量生成弹窗
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
    const [userCodes, setUserCodes] = useState<ActivationCode[]>([])
    const [form, setForm] = useState({ email: '', name: '', maxActivations: 3 })
    const [editForm, setEditForm] = useState({ email: '', name: '', maxActivations: 3, status: 'active', expiresAt: '' })
    const [batchForm, setBatchForm] = useState({ count: 10, maxActivations: 3, validDays: '' }) // 批量生成表单
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'users' | 'licenses' | 'unbound'>('users')

    // 搜索和排序状态
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

    const token = localStorage.getItem('navmanage_token')

    // 过滤和排序用户列表
    const filteredUsers = useMemo(() => {
        let result = users.filter(user =>
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key] ?? ''
                const bVal = (b as any)[sortConfig.key] ?? ''
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }
        return result
    }, [users, searchTerm, sortConfig])

    // 过滤和排序已激活列表
    const filteredLicenses = useMemo(() => {
        let result = licenses.filter(license =>
            license.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (license.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key] ?? ''
                const bVal = (b as any)[sortConfig.key] ?? ''
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }
        return result
    }, [licenses, searchTerm, sortConfig])

    // 点击表头排序
    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'asc' }
        })
    }

    useEffect(() => {
        fetchUsers()
        fetchLicenses()
        fetchUnboundCodes()
    }, [])

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/activation/users', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) setUsers(data)
        } catch (error) {
            console.error('Failed to fetch users:', error)
        }
    }

    const fetchUnboundCodes = async () => {
        try {
            const res = await fetch('/api/activation/codes/unbound', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) setUnboundCodes(data)
        } catch (error) {
            console.error('Failed to fetch unbound codes:', error)
        }
    }

    const batchGenerateCodes = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/activation/codes/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(batchForm)
            })
            const data = await res.json()
            if (res.ok) {
                alert(`已成功生成 ${data.count} 个激活码`)
                setShowBatchModal(false)
                fetchUnboundCodes()
            } else {
                alert(data.error || '生成失败')
            }
        } catch (error) {
            console.error('Failed to generate codes:', error)
        }
        setLoading(false)
    }

    const deleteUnboundCode = async (id: number) => {
        if (!confirm('确定要删除此激活码吗？')) return
        try {
            const res = await fetch(`/api/activation/codes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                fetchUnboundCodes()
            }
        } catch (error) {
            console.error('Failed to delete code:', error)
        }
    }


    const fetchLicenses = async () => {
        try {
            const res = await fetch('/api/activation/licenses', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (Array.isArray(data)) setLicenses(data)
        } catch (error) {
            console.error('Failed to fetch licenses:', error)
        }
    }

    const createUser = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/activation/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (res.ok) {
                alert(`用户创建成功！\n激活码: ${data.activationCode}`)
                setShowUserModal(false)
                setForm({ email: '', name: '', maxActivations: 3 })
                fetchUsers()
            } else {
                alert(data.error || '创建失败')
            }
        } catch (error) {
            console.error('Failed to create user:', error)
        }
        setLoading(false)
    }

    const viewUserCodes = async (user: UserData) => {
        setSelectedUser(user)
        try {
            const res = await fetch(`/api/activation/users/${user.id}/codes`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (Array.isArray(data)) setUserCodes(data)
        } catch (error) {
            console.error('Failed to fetch codes:', error)
        }
        setShowCodesModal(true)
    }

    const generateNewCode = async () => {
        if (!selectedUser) return
        try {
            const res = await fetch(`/api/activation/users/${selectedUser.id}/codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({})
            })
            const data = await res.json()
            if (res.ok) {
                alert(`新激活码: ${data.code}`)
                viewUserCodes(selectedUser)
                fetchUsers()
            }
        } catch (error) {
            console.error('Failed to generate code:', error)
        }
    }

    const revokeLicense = async (id: number) => {
        if (!confirm('确定要撤销此授权吗？该设备将无法继续使用。')) return
        try {
            await fetch(`/api/activation/licenses/${id}/revoke`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchLicenses()
        } catch (error) {
            console.error('Failed to revoke:', error)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        alert('已复制到剪贴板')
    }

    const openEditUser = (user: UserData) => {
        setSelectedUser(user)
        setEditForm({
            email: user.email,
            name: user.name || '',
            maxActivations: user.max_activations || 3,
            status: user.status || 'active',
            expiresAt: user.expires_at || ''
        })
        setShowEditModal(true)
    }

    const updateUser = async () => {
        if (!selectedUser) return
        setLoading(true)
        try {
            const res = await fetch(`/api/activation/users/${selectedUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            })
            const data = await res.json()
            if (res.ok) {
                alert('用户信息已更新')
                setShowEditModal(false)
                fetchUsers()
            } else {
                alert(data.error || '更新失败')
            }
        } catch (error) {
            console.error('Failed to update user:', error)
        }
        setLoading(false)
    }

    const deleteUser = async (userId: number) => {
        if (!confirm('确定要删除此用户吗？该用户的所有激活码和记录将被删除。')) return
        try {
            const res = await fetch(`/api/activation/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) {
                fetchUsers()
            } else {
                alert(data.error || '删除失败')
            }
        } catch (error) {
            console.error('Failed to delete user:', error)
        }
    }

    const deleteCode = async (codeId: number) => {
        if (!confirm('确定要删除此激活码吗？')) return
        try {
            const res = await fetch(`/api/activation/codes/${codeId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) {
                if (selectedUser) viewUserCodes(selectedUser)
                fetchUsers()
            } else {
                alert(data.error || '删除失败')
            }
        } catch (error) {
            console.error('Failed to delete code:', error)
        }
    }

    return (
        <div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900">授权管理</h1>
                    <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            用户管理
                        </button>
                        <button
                            onClick={() => setActiveTab('licenses')}
                            className={`px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'licenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            已激活列表
                        </button>
                        <button
                            onClick={() => setActiveTab('unbound')}
                            className={`px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'unbound' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            未绑定激活码
                        </button>
                    </div>
                </div>
                {activeTab === 'users' && (
                    <button
                        onClick={() => setShowUserModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        <Plus size={20} />
                        添加用户
                    </button>
                )}
                {activeTab === 'unbound' && (
                    <button
                        onClick={() => setShowBatchModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                        <Plus size={20} />
                        批量生成
                    </button>
                )}
            </div>

            {/* 搜索框 */}
            {(activeTab === 'users' || activeTab === 'licenses') && (
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="搜索邮箱或名称..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            )}

            {/* 用户列表 */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                                    用户 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>
                                    邮箱 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                    状态 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('used_activations')}>
                                    激活次数 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('expires_at')}>
                                    过期时间 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('last_activation')}>
                                    最后激活 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm text-gray-900">{user.name || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-500">{user.email}</td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.status === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {user.status === 'disabled' ? '已禁用' : '启用'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs ${(user.used_activations || 0) >= (user.max_activations || 3)
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700'
                                            }`}>
                                            {user.used_activations || 0} / {user.max_activations || 3}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500">
                                        {user.expires_at ? (
                                            <span className={new Date(user.expires_at) < new Date() ? 'text-red-500' : ''}>
                                                {user.expires_at.split('T')[0]}
                                                {new Date(user.expires_at) < new Date() && ' (已过期)'}
                                            </span>
                                        ) : '永久'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500">
                                        {user.last_activation?.split('T')[0] || '-'}
                                    </td>
                                    <td className="px-4 py-4 flex gap-2">
                                        <button
                                            onClick={() => openEditUser(user)}
                                            className="text-gray-500 hover:text-blue-600"
                                            title="编辑"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => viewUserCodes(user)}
                                            className="text-blue-600 hover:underline text-sm"
                                        >
                                            激活码
                                        </button>
                                        <button
                                            onClick={() => deleteUser(user.id)}
                                            className="text-gray-400 hover:text-red-600"
                                            title="删除用户"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        暂无用户，点击右上角添加
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 未绑定激活码列表 */}
            {activeTab === 'unbound' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">激活码</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">包含授权数</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">过期时间</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {unboundCodes.map(code => (
                                <tr key={code.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{code.code}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {code.max_installs} 次
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(code.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {code.expires_at ? (
                                            <span className={new Date(code.expires_at) < new Date() ? 'text-red-500 font-bold' : ''}>
                                                {new Date(code.expires_at).toLocaleString()}
                                                {new Date(code.expires_at) < new Date() && ' (已过期)'}
                                            </span>
                                        ) : '永久有效'}
                                    </td>
                                    <td className="px-6 py-4 flex gap-2">
                                        <button
                                            onClick={() => copyToClipboard(code.code)}
                                            className="text-gray-500 hover:text-blue-600"
                                            title="复制"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteUnboundCode(code.id)}
                                            className="text-gray-400 hover:text-red-600"
                                            title="删除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {unboundCodes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        暂无未绑定激活码，点击右上角批量生成
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 已激活列表 */}
            {activeTab === 'licenses' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                                    用户 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>
                                    邮箱 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fingerprint')}>
                                    设备指纹 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('activated_at')}>
                                    激活时间 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                    状态 <ArrowUpDown size={12} className="inline ml-1" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredLicenses.map(license => (
                                <tr key={license.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{license.name || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{license.email}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                        {license.fingerprint.substring(0, 12)}...
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {license.activated_at?.split('T')[0]}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${license.status === 'active'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {license.status === 'active' ? '活跃' : '已撤销'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {license.status === 'active' && (
                                            <button
                                                onClick={() => revokeLicense(license.id)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                撤销
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {licenses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        暂无激活记录
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 创建用户弹窗 */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">添加新用户</h3>
                            <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="用户名称"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">最大激活次数</label>
                                <input
                                    type="number"
                                    value={form.maxActivations}
                                    onChange={e => setForm({ ...form, maxActivations: parseInt(e.target.value) || 3 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={1}
                                    max={99}
                                />
                                <p className="text-xs text-gray-400 mt-1">用户可激活的设备总数</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={createUser}
                                disabled={loading || !form.email}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '创建中...' : '创建用户'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 编辑用户弹窗 */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">编辑用户</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                                <input
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">最大激活次数</label>
                                <input
                                    type="number"
                                    value={editForm.maxActivations}
                                    onChange={e => setEditForm({ ...editForm, maxActivations: parseInt(e.target.value) || 3 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={1}
                                    max={99}
                                />
                                <p className="text-xs text-gray-400 mt-1">已使用: {selectedUser.used_activations || 0} 次</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">账户状态</label>
                                <select
                                    value={editForm.status}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="active">启用</option>
                                    <option value="disabled">禁用</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">禁用后用户无法升级且本地许可将被清除</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">过期时间</label>
                                <input
                                    type="date"
                                    value={editForm.expiresAt ? editForm.expiresAt.split('T')[0] : ''}
                                    onChange={e => setEditForm({ ...editForm, expiresAt: e.target.value ? e.target.value + 'T23:59:59Z' : '' })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">留空表示永久有效</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={updateUser}
                                disabled={loading || !editForm.email}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 批量生成弹窗 */}
            {showBatchModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">批量生成激活码</h3>
                            <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">生成数量</label>
                                <input
                                    type="number"
                                    value={batchForm.count}
                                    onChange={e => setBatchForm({ ...batchForm, count: parseInt(e.target.value) || 10 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={1}
                                    max={50}
                                />
                                <p className="text-xs text-gray-400 mt-1">一次最多生成 50 个</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">授权次数</label>
                                <input
                                    type="number"
                                    value={batchForm.maxActivations}
                                    onChange={e => setBatchForm({ ...batchForm, maxActivations: parseInt(e.target.value) || 3 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={1}
                                    max={99}
                                />
                                <p className="text-xs text-gray-400 mt-1">每个被注册/绑定的用户获得的激活额度</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">有效期 (天)</label>
                                <input
                                    type="number"
                                    value={batchForm.validDays}
                                    onChange={e => setBatchForm({ ...batchForm, validDays: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min={1}
                                    placeholder="留空代表永久有效"
                                />
                                <p className="text-xs text-gray-400 mt-1">设置激活码的有效期限，过期后无法激活</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={batchGenerateCodes}
                                disabled={loading}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {loading ? '生成中...' : '开始生成'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 激活码弹窗 */}
            {showCodesModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{selectedUser.email} 的激活码</h3>
                            <button onClick={() => setShowCodesModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 max-h-96 overflow-y-auto">
                            {userCodes.map(code => (
                                <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                                    <div>
                                        <p className="font-mono font-medium text-gray-900">{code.code}</p>
                                        <p className="text-xs text-gray-500">
                                            剩余: {code.remaining_installs}/{code.max_installs} 次
                                            <span className={`ml-2 ${code.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                                                {code.status === 'active' ? '有效' : '已用'}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => copyToClipboard(code.code)}
                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                                            title="复制"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteCode(code.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="删除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {userCodes.length === 0 && (
                                <p className="text-center text-gray-500 py-8">暂无激活码</p>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-between">
                            <button
                                onClick={() => generateNewCode()}
                                disabled={loading}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                {loading ? '生成中...' : '生成新激活码'}
                            </button>
                            <button onClick={() => setShowCodesModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

