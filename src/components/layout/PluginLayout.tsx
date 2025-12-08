import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useConfig } from '@/shared/context/ConfigContext';
import TopNavbar from '@/shared/components/layout/TopNavbar';
import { AIChatModal } from '../../apps/navlink/components/ai/AIChatModal';
import SearchModal from '../../apps/navlink/components/common/SearchModal';

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
    icon: string;
}

interface PluginSidebarConfig {
    title?: string; // 侧边栏标题
    items: SidebarItem[];
    activeId: string;
}

const PluginLayout: React.FC = () => {
    const { config, isAuthenticated, logout } = useConfig();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showAIChatModal, setShowAIChatModal] = useState(false);

    // 插件Sidebar配置（通过postMessage接收）
    const [pluginSidebarConfig, setPluginSidebarConfig] = useState<PluginSidebarConfig | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    // 设置CSS变量 --theme-primary
    useEffect(() => {
        const primaryColor = config.theme?.primaryColor || '#f1404b';
        document.documentElement.style.setProperty('--theme-primary', primaryColor);
        console.log('[PluginLayout] Set --theme-primary:', primaryColor);
    }, [config.theme?.primaryColor]);

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            window.location.href = '/admin/dashboard';
        } else {
            window.location.href = '/admin/login';
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
                console.log('[PluginLayout] Received sidebar config:', event.data.payload);
                setPluginSidebarConfig(event.data.payload);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 处理Sidebar项点击
    const handleSidebarItemClick = (itemId: string) => {
        console.log('[PluginLayout] Sidebar item clicked:', itemId);

        // 动态查找iframe（每次点击时都查找，确保能找到）
        const iframe = document.querySelector('iframe');

        if (iframe && iframe.contentWindow) {
            console.log('[PluginLayout] Sending message to iframe');
            // 发送消息给插件
            iframe.contentWindow.postMessage({
                type: 'SIDEBAR_ITEM_CLICKED',
                payload: { itemId }
            }, '*');
        } else {
            console.error('[PluginLayout] iframe not found or contentWindow is null');
        }
    };

    // Determine if we should use dark text based on background color
    const bgColor = config.theme?.backgroundColor || '#f1f2f3';
    const useDarkText = isLightColor(bgColor);

    // 渲染动态Sidebar
    const renderPluginSidebar = () => {
        const widthClass = collapsed ? 'w-[68px]' : 'w-[220px]';

        return (
            <>
                {/* 桌面端Sidebar */}
                {pluginSidebarConfig && (
                    <aside className={`
                        hidden lg:flex flex-col flex-shrink-0
                        bg-white/80 backdrop-blur-md border-r border-gray-200/50 shadow-sm z-20 pt-2
                        transition-all duration-300 ease-in-out
                        ${widthClass}
                    `}>
                        {!collapsed && (
                            <div className="p-6 pt-4">
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-primary)] to-purple-600">
                                    {pluginSidebarConfig.title || '插件'}
                                </h2>
                            </div>
                        )}

                        <nav className="flex-1 overflow-y-auto custom-scrollbar py-2 pr-2">
                            <div className="space-y-1">
                                {pluginSidebarConfig.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSidebarItemClick(item.id)}
                                        className={`
                                            w-full flex items-center px-4 py-3 text-[14px] font-medium rounded-lg transition-all duration-200 group
                                            ${pluginSidebarConfig.activeId === item.id
                                                ? 'text-white bg-[var(--theme-primary)] shadow-md'
                                                : 'text-gray-600 hover:bg-white hover:text-[var(--theme-primary)] hover:shadow-sm'
                                            }
                                            ${collapsed ? 'justify-center px-0' : ''}
                                        `}
                                        title={collapsed ? item.label : ''}
                                    >
                                        <div className={`${collapsed ? 'text-lg w-auto mr-0' : 'w-6 text-center mr-2'} ${pluginSidebarConfig.activeId === item.id ? 'text-white' : 'text-gray-400 group-hover:text-[var(--theme-primary)]'} flex items-center justify-center`}>
                                            <i className={item.icon}></i>
                                        </div>
                                        {!collapsed && item.label}
                                        {!collapsed && <div className="ml-auto opacity-0 group-hover:opacity-50 text-xs"><i className="fa-solid fa-angle-right"></i></div>}
                                    </button>
                                ))}
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
                    </aside>
                )}

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
                                    <div className="space-y-1 px-2">
                                        {pluginSidebarConfig.items.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    handleSidebarItemClick(item.id);
                                                    setMobileOpen(false);
                                                }}
                                                className={`
                                                    w-full flex items-center px-4 py-3 text-[14px] font-medium rounded-lg transition-all duration-200 group
                                                    ${pluginSidebarConfig.activeId === item.id
                                                        ? 'text-white bg-[var(--theme-primary)] shadow-md'
                                                        : 'text-gray-600 hover:bg-white hover:text-[var(--theme-primary)] hover:shadow-sm'
                                                    }
                                                `}
                                            >
                                                <div className={`w-6 text-center mr-2 ${pluginSidebarConfig.activeId === item.id ? 'text-white' : 'text-gray-400 group-hover:text-[var(--theme-primary)]'} flex items-center justify-center`}>
                                                    <i className={item.icon}></i>
                                                </div>
                                                {item.label}
                                                <div className="ml-auto opacity-0 group-hover:opacity-50 text-xs"><i className="fa-solid fa-angle-right"></i></div>
                                            </button>
                                        ))}
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
        </div>
    );
};

export default PluginLayout;
