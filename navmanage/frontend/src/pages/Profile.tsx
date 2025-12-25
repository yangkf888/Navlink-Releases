import { useState, useEffect } from 'react'
import { User, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react'

export default function Profile() {
    const [profile, setProfile] = useState({ username: '', created_at: '' })
    const [form, setForm] = useState({
        newUsername: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })

    const token = localStorage.getItem('navmanage_token')

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/auth/profile', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) {
                setProfile(data)
                setForm(f => ({ ...f, newUsername: data.username }))
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        }
    }

    const handleSubmit = async () => {
        // Validate
        if (!form.currentPassword) {
            setMsg({ type: 'error', text: '请输入当前密码以确认修改' })
            return
        }
        if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
            setMsg({ type: 'error', text: '两次输入的新密码不一致' })
            return
        }

        setLoading(true)
        setMsg({ type: '', text: '' })

        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    newUsername: form.newUsername,
                    newPassword: form.newPassword || undefined,
                    currentPassword: form.currentPassword
                })
            })
            const data = await res.json()

            if (res.ok) {
                setMsg({ type: 'success', text: '修改成功！' })
                setProfile(p => ({ ...p, username: data.username }))
                setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmNewPassword: '' }))
            } else {
                setMsg({ type: 'error', text: data.error || '修改失败' })
            }
        } catch (error) {
            setMsg({ type: 'error', text: '网络错误' })
        }
        setLoading(false)
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">账号设置</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                        {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{profile.username}</h2>
                        <p className="text-sm text-gray-500">管理员账号</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {msg.text && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                            {msg.text}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><User size={20} /></span>
                            <input
                                value={form.newUsername}
                                onChange={e => setForm({ ...form, newUsername: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">修改密码 (可选)</h3>
                        <div className="grid gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={20} /></span>
                                    <input
                                        type="password"
                                        value={form.newPassword}
                                        onChange={e => setForm({ ...form, newPassword: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="不修改请留空"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={20} /></span>
                                    <input
                                        type="password"
                                        value={form.confirmNewPassword}
                                        onChange={e => setForm({ ...form, confirmNewPassword: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="再次输入新密码"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <label className="block text-sm font-medium text-gray-900 mb-2">当前密码 (验证身份) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={20} /></span>
                            <input
                                type="password"
                                value={form.currentPassword}
                                onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="请输入当前使用的密码"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !form.currentPassword}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Save size={20} />
                            {loading ? '保存中...' : '保存修改'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
