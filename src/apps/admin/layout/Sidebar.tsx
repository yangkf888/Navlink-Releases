import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Link as LinkIcon,
    Puzzle,
    Users,
    Settings,
    FileText,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Shield,
    Store,
    Search,
    Palette,
    PanelTop,
    Sparkles,
    Grid3X3,
    PanelRight,
    Bot,
    HeartPulse,
    Image,
    Database,
    ScrollText,
    ArrowUpCircle,
    Key
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface MenuItem {
    id: string;
    label: string;
    icon?: any;
    path: string | null;
    isSection?: boolean;
    requiredPermissions?: string[];  // 所需权限列表
    children?: MenuItem[];
}

interface Props {
    collapsed: boolean;
    onToggle: () => void;
}

const menuItems: MenuItem[] = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard, path: '/admin/dashboard', requiredPermissions: [] },
    {
        id: 'content',
        label: '内容管理',
        icon: FileText,
        path: null,
        isSection: true,
        requiredPermissions: ['nav:view'],
        children: [
            { id: 'basic', label: '全局外观', icon: Palette, path: '/admin/settings/basic', requiredPermissions: ['config:view'] },
            { id: 'topnav', label: '顶部导航', icon: PanelTop, path: '/admin/settings/topnav', requiredPermissions: ['nav:view'] },
            { id: 'hero', label: '首屏搜索', icon: Search, path: '/admin/settings/hero', requiredPermissions: ['config:view'] },
            { id: 'promo', label: '热门/推广', icon: Sparkles, path: '/admin/settings/promo', requiredPermissions: ['nav:view'] },
            { id: 'categories', label: '内容分类', icon: Grid3X3, path: '/admin/settings/categories', requiredPermissions: ['nav:view'] },
            { id: 'sidebar', label: '侧边栏', icon: PanelRight, path: '/admin/settings/sidebar', requiredPermissions: ['config:view'] },
        ]
    },
    {
        id: 'system',
        label: '系统管理',
        icon: Settings,
        path: null,
        isSection: true,
        requiredPermissions: ['system:view'],
        children: [
            { id: 'plugin-market', label: '应用商城', icon: Store, path: '/admin/plugin-market', requiredPermissions: ['plugin:view'] },
            { id: 'plugins', label: '插件管理', icon: Puzzle, path: '/admin/plugins', requiredPermissions: ['plugin:view'] },
            { id: 'ai', label: 'AI配置', icon: Bot, path: '/admin/settings/ai', requiredPermissions: ['config:view'] },
            { id: 'health', label: '链接健康', icon: HeartPulse, path: '/admin/settings/health', requiredPermissions: ['system:view'] },
            { id: 'media', label: '资源管理', icon: Image, path: '/admin/settings/media', requiredPermissions: ['config:view'] },
            { id: 'data', label: '数据管理', icon: Database, path: '/admin/settings/data', requiredPermissions: ['config:view'] },
            { id: 'users', label: '用户管理', icon: Users, path: '/admin/users', requiredPermissions: ['user:view'] },
            { id: 'permissions', label: '权限管理', icon: Shield, path: '/admin/permissions', requiredPermissions: ['system:manage'] },
            { id: 'logs', label: '系统日志', icon: ScrollText, path: '/admin/logs', requiredPermissions: ['system:view'] },
            { id: 'update', label: '系统升级', icon: ArrowUpCircle, path: '/admin/settings/update', requiredPermissions: ['system:manage'] },
            { id: 'license', label: '授权管理', icon: Key, path: '/admin/settings/license', requiredPermissions: ['system:manage'] },
        ]
    },
];

export default function Sidebar({ collapsed, onToggle }: Props) {
    const location = useLocation();
    const [expandedSections, setExpandedSections] = useState<string[]>(['content', 'system']);
    const { hasAnyPermission, loading } = usePermissions();

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    // 根据权限过滤菜单项
    const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
        if (loading) {
            return items; // 权限加载中，先显示全部
        }

        return items.filter(item => {
            const hasPermission = hasAnyPermission(item.requiredPermissions || []);

            if (!hasPermission) return false;

            // 如果有子菜单，也需要过滤子菜单
            if (item.children) {
                const filteredChildren = item.children.filter(child =>
                    hasAnyPermission(child.requiredPermissions || [])
                );
                // 如果子菜单全部被过滤掉，则不显示父菜单
                return filteredChildren.length > 0;
            }

            return true;
        }).map(item => {
            if (item.children) {
                return {
                    ...item,
                    children: item.children.filter(child =>
                        hasAnyPermission(child.requiredPermissions || [])
                    )
                };
            }
            return item;
        });
    };

    // 扁平化菜单项（用于收缩模式）
    const getFlattenedItems = () => {
        const flattened: MenuItem[] = [];
        const filtered = filterMenuItems(menuItems);

        filtered.forEach(item => {
            if (item.children) {
                item.children.forEach(child => {
                    if (child.icon && child.path) {
                        flattened.push(child);
                    }
                });
            } else {
                flattened.push(item);
            }
        });
        return flattened;
    };

    const itemsToShow = collapsed ? getFlattenedItems() : filterMenuItems(menuItems);

    return (
        <aside
            className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 h-screen sticky top-0 z-40 ${collapsed ? 'w-16' : 'w-64'
                }`}
        >
            {/* Logo & 品牌 */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
                {!collapsed && (
                    <Link to="/" className="flex items-center justify-center flex-1">
                        <span className="text-2xl font-bold text-blue-600">NavLink</span>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-9 w-9 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </Button>
            </div>

            {/* 搜索框 */}
            {!collapsed && (
                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="搜索..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            {/* 导航菜单 */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
                {itemsToShow.map(item => {
                    // 收缩模式下，直接显示所有Item（扁平化后的）
                    if (collapsed) {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.id}
                                to={item.path!}
                                className={`flex items-center justify-center w-full h-10 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                                title={item.label}
                            >
                                {Icon && <Icon size={20} />}
                            </Link>
                        );
                    }

                    // 展开模式：保持原有逻辑（分组折叠）
                    if (item.isSection) {
                        const isExpanded = expandedSections.includes(item.id);
                        const hasActiveChild = item.children?.some(child => child.path === location.pathname);

                        return (
                            <div key={item.id} className="mb-2">
                                {/* 分组标题 */}
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleSection(item.id)}
                                    className={`w-auto flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 justify-start h-auto font-normal ${hasActiveChild
                                        ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm hover:bg-blue-100'
                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                        }`}
                                    style={{ width: 'calc(100% - 16px)' }}
                                >
                                    {item.icon && <item.icon size={20} className="flex-shrink-0" />}
                                    <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </Button>

                                {/* 子菜单 */}
                                {isExpanded && item.children && (
                                    <div className="mt-1 space-y-1">
                                        {item.children.map((child) => {
                                            if (!child.path) return null; // Skip separators
                                            const ChildIcon = child.icon;
                                            const isActive = location.pathname === child.path;

                                            return (
                                                <Link
                                                    key={child.id}
                                                    to={child.path!}
                                                    className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all duration-200 ${isActive
                                                        ? 'bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 active:bg-blue-800'
                                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
                                                        }`}
                                                >
                                                    {ChildIcon && <ChildIcon size={18} />}
                                                    <span className="text-sm">{child.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // 非分组菜单项（如仪表盘）
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.id}
                            to={item.path!}
                            className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 active:bg-blue-800'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
                                }`}
                        >
                            {Icon && <Icon size={20} />}
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* 用户信息 */}
            <div className="border-t border-gray-200 p-4 overflow-x-hidden">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        A
                    </div>
                    {!collapsed && (
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Administrator</div>
                            <div className="text-xs text-gray-500">超级管理员</div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
