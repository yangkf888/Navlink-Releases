/**
 * Kbrag 插件内部侧边栏组件
 */
import { useState, useEffect } from 'react';
import { Category } from '../types';

type View = 'dashboard' | 'list' | 'search' | 'config';
type Theme = 'light' | 'dark';

const THEME_KEY = 'kbrag_theme';

interface SidebarProps {
    activeView: View;
    selectedCategory: string;
    categories: Category[];
    categoryStats: Record<string, number>;
    onViewChange: (view: View | string) => void;
    isMobile?: boolean;
    onCloseMobile?: () => void;
}

interface SidebarItemProps {
    icon: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
    badge?: number;
    color?: string;
    indent?: boolean;
}

function SidebarItem({ icon, label, isActive, onClick, badge, color, indent }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg
                ${indent ? 'pl-10' : ''}
                ${isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
            `}
        >
            {color ? (
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            ) : (
                <i className={`${icon} w-5 text-center flex-shrink-0`}></i>
            )}
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
    selectedCategory,
    categories,
    categoryStats,
    onViewChange,
    isMobile = false,
    onCloseMobile
}: SidebarProps) {
    const [isListOpen, setIsListOpen] = useState(activeView === 'list' || !!selectedCategory);

    // 主题状态
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return (saved as Theme) || 'light';
    });

    // 应用主题到 document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleClick = (view: View | string) => {
        onViewChange(view);
        if (isMobile && onCloseMobile) {
            onCloseMobile();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">知识库</h2>
                        <p className="text-xs text-gray-500 mt-0.5">本地知识存储与检索</p>
                    </div>
                    {isMobile && onCloseMobile && (
                        <button
                            onClick={onCloseMobile}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                <SidebarItem
                    icon="fas fa-home"
                    label="概览"
                    isActive={activeView === 'dashboard' && !selectedCategory}
                    onClick={() => handleClick('dashboard')}
                />

                {/* 知识列表 - 可展开 */}
                <div>
                    <button
                        onClick={() => setIsListOpen(!isListOpen)}
                        className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg
                            ${activeView === 'list' && !selectedCategory
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }
                        `}
                    >
                        <i className="fas fa-book w-5 text-center flex-shrink-0"></i>
                        <span className="flex-1 text-left">知识列表</span>
                        <i className={`fas fa-chevron-right text-xs transition-transform ${isListOpen ? 'rotate-90' : ''}`}></i>
                    </button>

                    {isListOpen && (
                        <div className="mt-1 space-y-1">
                            <SidebarItem
                                icon="fas fa-list"
                                label="全部"
                                isActive={activeView === 'list' && !selectedCategory}
                                onClick={() => handleClick('list')}
                                indent
                            />
                            {categories.map(cat => (
                                <SidebarItem
                                    key={cat.name}
                                    icon=""
                                    label={cat.name}
                                    color={cat.color}
                                    isActive={selectedCategory === cat.name}
                                    onClick={() => handleClick(`category:${cat.name}`)}
                                    badge={categoryStats[cat.name]}
                                    indent
                                />
                            ))}
                        </div>
                    )}
                </div>

                <SidebarItem
                    icon="fas fa-search"
                    label="知识检索"
                    isActive={activeView === 'search'}
                    onClick={() => handleClick('search')}
                />

                <SidebarItem
                    icon="fas fa-cog"
                    label="配置"
                    isActive={activeView === 'config'}
                    onClick={() => handleClick('config')}
                />
            </nav>

            {/* 底部：主题切换 */}
            <div className="p-3 border-t border-gray-200">
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5 text-center`}></i>
                    <span>{theme === 'light' ? '切换暗黑模式' : '切换明亮模式'}</span>
                </button>
            </div>
        </div>
    );
}
