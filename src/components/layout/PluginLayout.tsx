import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useConfig } from '@/shared/context/ConfigContext';
import TopNavbar from '@/shared/components/layout/TopNavbar';
import { AIChatModal } from '../../apps/navlink/components/ai/AIChatModal';
import SearchModal from '../../apps/navlink/components/common/SearchModal';
import LoginModal from '../../apps/navlink/components/common/LoginModal';

// Helper to determine if a color is light or dark
const isLightColor = (color?: string) => {
    if (!color) return true; // Default to light background if unknown

    // Quick check for common light/dark keywords
    if (color === 'white' || color === 'transparent') return true;
    if (color === 'black') return false;

    // Handle Hex
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        // Expand shorthand (e.g. "03F") to full form ("0033FF")
        const fullHex = hex.length === 3
            ? hex.split('').map(x => x + x).join('')
            : hex;

        const r = parseInt(fullHex.substring(0, 2), 16);
        const g = parseInt(fullHex.substring(2, 4), 16);
        const b = parseInt(fullHex.substring(4, 6), 16);

        // YIQ brightness formula
        return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    }

    // Default to true (light) for safety
    return true;
};

import Sidebar from '@/shared/components/layout/Sidebar';

interface SidebarItem {
    id: string;
    label: string;
    icon?: string; // Icon is optional now
    children?: SidebarItem[];
    isOpen?: boolean; // Initial state
    isLabel?: boolean; // If true, renders as a section header
    statusColor?: string; // If set, shows a status dot
    isCategory?: boolean; // If true, renders with smaller font size
}

interface PluginSidebarConfig {
    title?: string;
    items: SidebarItem[];
    activeId: string;
}

const PluginLayout: React.FC = () => {
    const { config, isAuthenticated, logout } = useConfig();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showAIChatModal, setShowAIChatModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 插件Sidebar配置（通过postMessage接收）
    const [pluginSidebarConfig, setPluginSidebarConfig] = useState<PluginSidebarConfig | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

    // 设置CSS变量 --theme-primary
    useEffect(() => {
        const primaryColor = config.theme?.primaryColor || '#f1404b';
        document.documentElement.style.setProperty('--theme-primary', primaryColor);
    }, [config.theme?.primaryColor]);

    // Handle group toggle
    const toggleGroup = (groupId: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            window.location.href = '/admin/dashboard';
        } else {
            // 未登录用户 - 弹出登录框
            setShowLoginModal(true);
        }
    };

    const handleLogout = () => {
        logout();
    };

    // 监听来自插件iframe的消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // 安全检查：只接受预期的消息
            if (event.data.type === 'PLUGIN_SET_SIDEBAR') {
                setPluginSidebarConfig(event.data.payload);

                // Initialize open groups based on activeId or default isOpen
                const config = event.data.payload as PluginSidebarConfig;
                if (config.items) {
                    const initialOpen = new Set<string>();
                    const findPathToActive = (items: SidebarItem[]): boolean => {
                        for (const item of items) {
                            if (item.id === config.activeId) return true;
                            if (item.children) {
                                if (findPathToActive(item.children)) {
                                    initialOpen.add(item.id);
                                    return true;
                                }
                            }
                        }
                        return false;
                    };
                    findPathToActive(config.items);

                    // Also honor isOpen prop
                    const scanOpen = (items: SidebarItem[]) => {
                        items.forEach(item => {
                            if (item.isOpen) initialOpen.add(item.id);
                            if (item.children) scanOpen(item.children);
                        });
                    };
                    scanOpen(config.items);

                    setOpenGroups(initialOpen);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 处理Sidebar项点击
    const handleSidebarItemClick = (itemId: string, isGroup: boolean = false) => {
        if (isGroup) {
            toggleGroup(itemId);
            return;
        }

        // 动态查找iframe（每次点击时都查找，确保能找到）
        const iframe = document.querySelector('iframe');

        if (iframe && iframe.contentWindow) {
            // 发送消息给插件
            iframe.contentWindow.postMessage({
                type: 'SIDEBAR_ITEM_CLICKED',
                payload: { itemId }
            }, '*');
        } else {
            console.error('iframe not found or contentWindow is null');
        }
    };

    // Determine if we should use dark text based on background color
    const bgColor = config.theme?.backgroundColor || '#f1f2f3';
    const useDarkText = isLightColor(bgColor);

    // Render Item Helper
    const renderSidebarItem = (item: SidebarItem, depth = 0) => {
        // Label Handling (Section Header) - Now styled like a non-interactive item
        if (item.isLabel) {
            if (collapsed) return null; // Hide labels when collapsed
            return (
                <div key={item.id} className="w-full flex items-center px-4 py-2 mt-2 text-[14px] font-medium text-gray-600">
                    {/* Icon */}
                    {item.icon && (
                        <div className="w-5 text-center mr-3 flex-shrink-0">
                            <i className={item.icon}></i>
                        </div>
                    )}
                    {item.label}
                </div>
            );
        }

        const hasChildren = item.children && item.children.length > 0;
        const isActive = pluginSidebarConfig?.activeId === item.id;
        const isOpen = openGroups.has(item.id);
        const paddingLeft = collapsed ? '0' : '16px';

        // Calculate icon wrapper styles
        const iconWrapperClass = collapsed
            ? 'text-lg w-auto mr-0'
            : 'w-5 text-center mr-3'; // Refined spacing: w-5 (20px) + mr-3 (12px) = 32px space.
        // Item text start = 16 + 32 = 48px.
        // Label pl-12 (48px) matches.

        // Font size class based on isCategory
        const labelClass = item.isCategory ? 'text-xs text-gray-500 font-medium' : 'text-[14px] font-medium';

        return (
            <div key={item.id} className="w-full">
                <button
                    onClick={() => handleSidebarItemClick(item.id, hasChildren)}
                    className={`
                        w-full flex items-center py-2 transition-all duration-200 group relative
                        ${labelClass}
                        ${isActive
                            ? 'text-[var(--theme-primary)] bg-blue-50/50'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-[var(--theme-primary)]'
                        }
                        ${collapsed ? 'justify-center px-0' : ''}
                    `}
                    style={{ paddingLeft: collapsed ? 0 : paddingLeft }}
                    title={collapsed ? item.label : ''}
                >
                    {/* Active Indicator Bar */}
                    {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--theme-primary)] rounded-r"></div>
                    )}

                    {(item.statusColor || item.icon !== '') && (
                        <div className={`${iconWrapperClass} ${isActive ? 'text-[var(--theme-primary)]' : 'text-gray-400 group-hover:text-[var(--theme-primary)]'} flex items-center justify-center flex-shrink-0`}>
                            {item.statusColor ? (
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.statusColor }}></div>
                            ) : (
                                <i className={item.icon || 'fas fa-circle'}></i>
                            )}
                        </div>
                    )}

                    {!collapsed && (
                        <>
                            <span className="flex-1 text-left truncate">{item.label}</span>
                            {hasChildren && (
                                <div className={`ml-2 transition-transform duration-200 text-xs text-gray-400 ${isOpen ? 'rotate-90' : ''}`}>
                                    <i className="fa-solid fa-angle-right"></i>
                                </div>
                            )}
                        </>
                    )}
                </button>

                {/* Children */}
                {hasChildren && isOpen && !collapsed && (
                    <div className="overflow-hidden transition-all duration-300">
                        {item.children!.map(child => renderSidebarItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // 渲染动态Sidebar
    const renderPluginSidebar = () => {
        const widthClass = collapsed ? 'w-[68px]' : 'w-[220px]';

        return (
            <>
                {/* 桌面端Sidebar - 始终渲染容器，避免布局闪烁 */}
                <aside className={`
                    hidden lg:flex flex-col flex-shrink-0
                    bg-white border-r border-gray-200 z-20 pt-2
                    transition-all duration-300 ease-in-out
                    ${widthClass}
                `}>
                    {pluginSidebarConfig ? (
                        <>
                            {!collapsed && (
                                <div className="p-6 pt-4 mb-2">
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {pluginSidebarConfig.title || '插件'}
                                    </h2>
                                </div>
                            )}

                            <nav className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="space-y-0.5">
                                    {pluginSidebarConfig.items.map((item) => renderSidebarItem(item))}
                                </div>
                            </nav>

                            <div className="p-4 border-t border-gray-100">
                                <button
                                    onClick={() => setCollapsed(!collapsed)}
                                    className={`
                                        w-full flex items-center justify-center px-4 py-2 text-sm text-gray-500 hover:text-[var(--theme-primary)] 
                                        hover:bg-gray-50 rounded-lg transition-colors
                                        ${collapsed ? '' : 'gap-2'}
                                    `}
                                    title={collapsed ? '展开' : '收起'}
                                >
                                    {collapsed ? (
                                        <i className="fa-solid fa-angles-right"></i>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-angles-left"></i>
                                            <span>收起</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* 加载占位符 - 保持布局稳定 */
                        <div className="flex-1 flex items-center justify-center">
                            {/* 骨架屏加载效果 */}
                            {!collapsed && (
                                <div className="w-full p-6 space-y-4 animate-pulse">
                                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                                    <div className="space-y-3 pt-4">
                                        <div className="h-10 bg-gray-100 rounded"></div>
                                        <div className="h-10 bg-gray-100 rounded"></div>
                                        <div className="h-10 bg-gray-100 rounded"></div>
                                        <div className="h-10 bg-gray-100 rounded"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* 移动端Sidebar - 始终渲染 */}
                {mobileOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        onClick={() => setMobileOpen(false)}
                    >
                        <aside
                            className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 pt-24">
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-primary)] to-purple-600">
                                    插件菜单
                                </h2>
                            </div>

                            {pluginSidebarConfig ? (
                                <nav className="flex-1 overflow-y-auto custom-scrollbar py-2">
                                    <div className="space-y-1">
                                        {pluginSidebarConfig.items.map((item) => renderSidebarItem(item))}
                                    </div>
                                </nav>
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-500">
                                    <div className="w-8 h-8 border-3 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <p className="text-sm">加载中...</p>
                                </div>
                            )}
                        </aside>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="min-h-screen bg-[var(--theme-bg)] font-sans text-[var(--theme-text)]">
            {/* Search Modal */}
            {showSearchModal && (
                <SearchModal
                    config={config}
                    isAuthenticated={isAuthenticated}
                    onClose={() => setShowSearchModal(false)}
                    onAIModeClick={() => setShowAIChatModal(true)}
                />
            )}

            <TopNavbar
                config={config}
                toggleSidebar={() => setMobileOpen(!mobileOpen)}
                mobileOpen={mobileOpen}
                onUserClick={handleUserIconClick}
                onLogout={logout}
                isAuthenticated={isAuthenticated}
                onSearchClick={() => setShowSearchModal(true)}
                forceDarkText={useDarkText}
            />

            <div className="pt-20 w-full h-[calc(100vh)] box-border flex relative">
                {/* 只渲染插件Sidebar */}
                {renderPluginSidebar()}

                {/* Main Content Area */}
                <div className="flex-1 h-full overflow-hidden relative">
                    <Outlet />
                </div>
            </div>

            {/* AI Chat Modal */}
            <AIChatModal isOpen={showAIChatModal} onClose={() => setShowAIChatModal(false)} />

            {/* Login Modal */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </div>
    );
};

export default PluginLayout;
