/**
 * Docker 插件内部侧边栏组件
 */
import { useState, useEffect } from 'react';
import { DockerServer } from '../types/docker';

export type DockerView = 'overview' | 'dashboard' | 'containers' | 'images' | 'networks' | 'volumes' | 'servers';
type Theme = 'light' | 'dark';

const THEME_KEY = 'docker_theme';

interface SidebarProps {
    activeView: DockerView;
    onViewChange: (view: DockerView) => void;
    selectedServer: DockerServer | null;
    servers: DockerServer[];
    onSelectServer: (server: DockerServer) => void;
    isMobile?: boolean;
    onCloseMobile?: () => void;
}

interface SidebarItemProps {
    icon: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
    badge?: number;
}

function SidebarItem({ icon, label, isActive, onClick, badge }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg
                ${isActive
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }
            `}
        >
            <i className={`${icon} w-5 text-center flex-shrink-0`}></i>
            <span className="flex-1 text-left truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-200'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

export function Sidebar({
    activeView,
    onViewChange,
    selectedServer,
    servers,
    onSelectServer,
    isMobile = false,
    onCloseMobile
}: SidebarProps) {
    const [isServersOpen, setIsServersOpen] = useState(false);

    // 主题状态
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return (saved as Theme) || 'light';
    });

    // 应用主题到 document 并同步到父窗口
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);

        // 同步到主应用
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'PLUGIN_THEME_CHANGED',
                payload: { theme }
            }, '*');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleClick = (view: DockerView) => {
        onViewChange(view);
        if (isMobile && onCloseMobile) {
            onCloseMobile();
        }
    };

    const menuItems = [
        { id: 'overview' as DockerView, icon: 'fa-solid fa-globe', label: '总览' },
        { id: 'dashboard' as DockerView, icon: 'fa-solid fa-dashboard', label: '概览' },
        { id: 'containers' as DockerView, icon: 'fa-solid fa-box', label: '容器' },
        { id: 'images' as DockerView, icon: 'fa-solid fa-layer-group', label: '镜像' },
        { id: 'networks' as DockerView, icon: 'fa-solid fa-network-wired', label: '网络' },
        { id: 'volumes' as DockerView, icon: 'fa-solid fa-database', label: '卷' },
        { id: 'servers' as DockerView, icon: 'fa-solid fa-server', label: '服务器' },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900 shadow-sm transition-colors">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Docker管理</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">容器和镜像管理</p>
                    </div>
                    {isMobile && onCloseMobile && (
                        <button
                            onClick={onCloseMobile}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {menuItems.map(item => (
                    <SidebarItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activeView === item.id}
                        onClick={() => handleClick(item.id)}
                    />
                ))}
            </nav>

            {/* 底部：主题切换 */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5 text-center`}></i>
                    <span>{theme === 'light' ? '切换暗黑模式' : '切换明亮模式'}</span>
                </button>
            </div>
        </div>
    );
}
