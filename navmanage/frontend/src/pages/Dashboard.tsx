import { useEffect, useState } from 'react'
import { Users, Key, Download, CheckCircle, Clock } from 'lucide-react'

interface Stats {
    users: { total: number; withActivations: number }
    activations: { total: number; active: number; revoked: number }
    codes: { total: number; used: number; available: number }
    plugins: { total: number; totalDownloads: number }
    recentActivations: { email: string; fingerprint: string; date: string }[]
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [publicKey, setPublicKey] = useState('')

    useEffect(() => {
        fetchStats()
        fetchPublicKey()
    }, [])

    const fetchStats = async () => {
        const token = localStorage.getItem('navmanage_token')
        try {
            // 获取用户列表
            const userRes = await fetch('/api/activation/users', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const users = await userRes.json()

            // 获取激活记录
            const licRes = await fetch('/api/activation/licenses', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const licenses = await licRes.json()

            // 获取插件统计
            const plugRes = await fetch('/api/plugins')
            const plugins = await plugRes.json()

            // 计算统计数据
            const userCount = Array.isArray(users) ? users.length : 0
            const usersWithActivations = Array.isArray(users)
                ? users.filter((u: any) => (u.used_activations || 0) > 0).length
                : 0

            const totalActivations = Array.isArray(licenses) ? licenses.length : 0
            const activeActivations = Array.isArray(licenses)
                ? licenses.filter((l: any) => l.status === 'active').length
                : 0
            const revokedActivations = totalActivations - activeActivations

            // 计算激活码统计
            let totalCodes = 0, usedCodes = 0
            if (Array.isArray(users)) {
                users.forEach((u: any) => {
                    totalCodes += u.code_count || 0
                    usedCodes += (u.code_count || 0) - (u.active_codes || 0)
                })
            }

            // 最近激活记录
            const recentActivations = Array.isArray(licenses)
                ? licenses.slice(0, 5).map((l: any) => ({
                    email: l.email,
                    fingerprint: l.fingerprint?.slice(0, 12) + '...',
                    date: l.activated_at?.split('T')[0] || '-'
                }))
                : []

            setStats({
                users: { total: userCount, withActivations: usersWithActivations },
                activations: { total: totalActivations, active: activeActivations, revoked: revokedActivations },
                codes: { total: totalCodes, used: usedCodes, available: totalCodes - usedCodes },
                plugins: {
                    total: Array.isArray(plugins) ? plugins.length : 0,
                    totalDownloads: Array.isArray(plugins) ? plugins.reduce((sum: number, p: any) => sum + (p.total_downloads || 0), 0) : 0
                },
                recentActivations
            })
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    const fetchPublicKey = async () => {
        try {
            const res = await fetch('/api/licenses/public-key')
            const data = await res.json()
            setPublicKey(data.publicKey || '')
        } catch {
            console.error('Failed to fetch public key')
        }
    }

    const statCards = [
        { label: '用户总数', value: stats?.users.total || 0, sub: `${stats?.users.withActivations || 0} 已激活`, icon: Users, color: 'blue' },
        { label: '总激活次数', value: stats?.activations.total || 0, sub: `${stats?.activations.active || 0} 有效`, icon: CheckCircle, color: 'green' },
        { label: '可用激活码', value: stats?.codes.available || 0, sub: `${stats?.codes.used || 0} 已用 / ${stats?.codes.total || 0} 总数`, icon: Key, color: 'purple' },
        { label: '插件下载', value: stats?.plugins.totalDownloads || 0, sub: `${stats?.plugins.total || 0} 个插件`, icon: Download, color: 'orange' },
    ]

    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">仪表盘</h1>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{card.label}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${colorMap[card.color]}`}>
                                <card.icon size={24} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 最近激活 */}
            {stats?.recentActivations && stats.recentActivations.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-gray-400" />
                        最近激活记录
                    </h2>
                    <div className="space-y-3">
                        {stats.recentActivations.map((a, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                                <span className="text-gray-900">{a.email}</span>
                                <span className="text-gray-400 font-mono text-xs">{a.fingerprint}</span>
                                <span className="text-gray-500">{a.date}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 公钥信息 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">公钥信息</h2>
                <p className="text-sm text-gray-500 mb-3">
                    将此公钥配置到 NavLink 的 LicenseService.js 中以启用 License 验证
                </p>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-xs break-all">
                    {publicKey || '加载中...'}
                </div>
                <button
                    onClick={() => navigator.clipboard.writeText(publicKey)}
                    className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    复制公钥
                </button>
            </div>
        </div>
    )
}
