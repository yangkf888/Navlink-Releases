import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Key, Puzzle, LogOut, Settings, Menu, X } from 'lucide-react'
import { useState } from 'react'

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
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const closeSidebar = () => setSidebarOpen(false)

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* 移动端遮罩 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* 侧边栏 */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-white border-r border-gray-200 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="text-2xl">🛠️</span>
                            NavManage
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">NavLink 管理系统</p>
                    </div>
                    <button
                        onClick={closeSidebar}
                        className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={closeSidebar}
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
            <div className="flex-1 flex flex-col min-w-0">
                {/* 移动端顶部导航 */}
                <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">🛠️ NavManage</h1>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}

