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

const PluginLayout: React.FC = () => {
    const { config, isAuthenticated, logout } = useConfig();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showAIChatModal, setShowAIChatModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 插件请求隐藏移动端顶部导航
    const [hideHeader, setHideHeader] = useState(false);

    // 设置CSS变量 --theme-primary
    useEffect(() => {
        const primaryColor = config.theme?.primaryColor || '#f1404b';
        document.documentElement.style.setProperty('--theme-primary', primaryColor);
    }, [config.theme?.primaryColor]);

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            window.location.href = '/admin/dashboard';
        } else {
            // 未登录用户 - 弹出登录框
            setShowLoginModal(true);
        }
    };

    // 监听来自插件iframe的消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // 插件请求隐藏移动端顶部导航
            if (event.data.type === 'PLUGIN_REQUEST_HIDE_HEADER') {
                const hide = event.data.payload?.hideHeader ?? event.data.payload?.hideMobile ?? false;
                console.log(`[PluginLayout] Received hideHeader: ${hide} from plugin`);
                setHideHeader(hide);
            }

            // 插件请求同步主题
            if (event.data.type === 'PLUGIN_THEME_CHANGED') {
                const newTheme = event.data.payload?.theme || 'light';
                console.log(`[PluginLayout] Syncing theme to: ${newTheme}`);
                document.documentElement.setAttribute('data-theme', newTheme);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            // 走出插件布局时还原主题为明亮（或默认）
            document.documentElement.removeAttribute('data-theme');
        };
    }, []);

    // Determine if we should use dark text based on background color
    const bgColor = config.theme?.backgroundColor || '#f1f2f3';
    const useDarkText = isLightColor(bgColor);

    return (
        <div className="h-screen flex flex-col bg-[var(--theme-bg)] font-sans text-[var(--theme-text)] overflow-hidden">
            {/* Search Modal */}
            {showSearchModal && (
                <SearchModal
                    config={config}
                    isAuthenticated={isAuthenticated}
                    onClose={() => setShowSearchModal(false)}
                    onAIModeClick={() => setShowAIChatModal(true)}
                />
            )}

            {/* 桌面端默认显示 Header，移动端默认隐藏插件模式下的 Header */}
            <div className={`flex-shrink-0 ${hideHeader ? 'hidden' : 'hidden lg:block'}`}>
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
            </div>

            {/* 增加 pt-14 补偿，仅在桌面端 Header 显示时生效 */}
            <div className={`flex-1 flex overflow-hidden relative ${!hideHeader ? 'lg:pt-14' : ''}`}>
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
