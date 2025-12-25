import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Key, Puzzle, LogOut, Settings } from 'lucide-react'

interface LayoutProps {
    children: React.ReactNode
    onLogout: () => void
}

const navItems = [
    { path: '/', icon: LayoutDashboard, label: '仪表盘' },
    { path: '/licenses', icon: Key, label: 'License 管理' },
    { path: '/plugins', icon: Puzzle, label: '插件管理' },
    { path: '/profile', icon: Settings, label: '账号设置' },
]

export default function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation()

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* 侧边栏 */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">🛠️</span>
                        NavManage
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">NavLink 管理系统</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <item.icon size={20} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
                    >
                        <LogOut size={20} />
                        退出登录
                    </button>
                </div>
            </aside>

            {/* 主内容 */}
            <main className="flex-1 p-8 overflow-auto">
                {children}
            </main>
        </div>
    )
}
