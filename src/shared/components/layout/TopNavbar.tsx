import React, { useState, useEffect } from 'react';
import type { SiteConfig } from '../../types';
import { Icon } from '../common/Icon';
import { FloatingMenu } from './FloatingMenu';
import { Button } from '../../../components/ui/Button';

const TopNavbar = ({ config, toggleSidebar, mobileOpen: _mobileOpen, onUserClick, onLogout, isAuthenticated = false, onSearchClick, forceDarkText: propForceDarkText }: {
    config: SiteConfig,
    toggleSidebar: any,
    mobileOpen: boolean,
    onUserClick: () => void,
    onLogout: () => void,
    isAuthenticated?: boolean,
    onSearchClick: () => void,
    forceDarkText?: boolean
}) => {
    // 💡 FOOLPROOF LOGIC: Detect non-hero pages (like plugins) to ensure visibility
    const isAppPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/apps/');
    // Check if we are NOT in dark mode (where text should be white)
    const isNotDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'dark';

    // Combine path detection with propensity for dark text
    const forceDarkText = propForceDarkText || (isAppPath && isNotDarkMode);
    // ... (state logic remains same)
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [menuTimer, setMenuTimer] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (menuTimer) clearTimeout(menuTimer);
        };
    }, [menuTimer]);


    // Overlay Logic remains same...
    const isOverlayMode = config.hero?.overlayNavbar !== false;
    const navColor = config.theme?.navbarBgColor || '#5d33f0';

    // ... (color logic remains same)
    const shouldUseTransparent = isOverlayMode && !isScrolled && navColor !== 'hero';

    let navBgStyle: React.CSSProperties = {};
    let navClass = '';
    let textColorClass = 'text-white';

    if (shouldUseTransparent) {
        navClass = 'bg-transparent';
        textColorClass = forceDarkText ? 'text-gray-800' : 'text-white';
    } else {
        // [FIXED LOGIC] Prioritize Plugin/App pages in "Fixed Area" mode.
        // If we are in "Fixed Area" mode (!isOverlayMode) AND on a Plugin/App page (isAppPath),
        // we MUST enforce theme-based colors (via CSS variables) to ensure readability and correct theming.
        // This overrides ANY user-configured navbar color (Hero, Transparent, or Custom Hex).
        if (!isOverlayMode && isAppPath) {
            navBgStyle = {
                backgroundColor: 'var(--theme-bg, #ffffff)',
                borderBottom: '1px solid var(--theme-border, #e5e7eb)',
                color: 'var(--theme-text, #1f2937)'
            };
            textColorClass = forceDarkText ? 'text-gray-800' : 'text-white';
        } else {
            // Standard Logic for Landing Page OR Overlay Mode (scrolled) OR Plugin Page in Overlay Mode
            if (navColor === 'hero') {
                if (!isOverlayMode) {
                    navBgStyle = { backgroundColor: config.hero?.backgroundColor || '#5d33f0' };
                    textColorClass = forceDarkText ? 'text-gray-800' : 'text-white';
                } else {
                    if (isScrolled) {
                        navBgStyle = {
                            backgroundColor: 'rgba(255, 255, 255, 0.85)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                            color: '#1f2937'
                        };
                        textColorClass = 'text-gray-800';
                    } else {
                        navBgStyle = {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        };
                        textColorClass = forceDarkText ? 'text-gray-800' : 'text-white';
                    }
                }
            } else if (navColor === 'transparent') {
                navBgStyle = {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#1f2937'
                };
                textColorClass = 'text-gray-800';
            } else {
                navBgStyle = { backgroundColor: navColor };
                textColorClass = forceDarkText ? 'text-gray-800' : 'text-white';
            }
        }
    }

    // CRITICAL: If forceDarkText is explicitly set from parent (e.g., PluginLayout),
    // it should override all internal color logic to ensure proper contrast
    if (forceDarkText) {
        textColorClass = 'text-gray-800';
    }

    const visibleNavItems = config.topNav?.filter(item => isAuthenticated || !item.hidden) || [];
    const isDarkText = forceDarkText || textColorClass.includes('text-gray-800') || textColorClass.includes('text-black');

    // 使用自定义导航菜单颜色或自动颜色
    const navMenuColor = config.theme?.navMenuColor;
    const linkColorClass = navMenuColor
        ? '' // 使用内联样式
        : (isDarkText
            ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            : 'text-white/80 hover:text-white hover:bg-white/10');
    const linkColorStyle: React.CSSProperties = (navMenuColor && !forceDarkText)
        ? { color: navMenuColor }
        : {};

    const logoColorClass = isDarkText ? 'text-gray-800' : 'text-white';

    // 使用自定义格言颜色或自动颜色
    const quoteColor = config.theme?.quoteColor;
    const quoteColorClass = quoteColor
        ? '' // 使用内联样式
        : (isDarkText ? 'text-gray-500' : 'text-white/70');
    const quoteColorStyle: React.CSSProperties = quoteColor
        ? { color: quoteColor }
        : {};

    const iconButtonClass = isDarkText ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white';
    const mobileMenuButtonClass = isDarkText ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white';
    const borderColorClass = isDarkText ? 'border-gray-200' : 'border-white/20';

    const IconComponent = Icon as any;

    return (
        <nav
            className={`
                w-full ${isOverlayMode ? 'fixed' : 'sticky'} top-0 left-0 z-40 lg:z-50 transition-all duration-300
                ${shouldUseTransparent ? '' : 'shadow-md'}
                ${navClass} ${textColorClass} py-3.5 px-6 md:px-10
            `}
            style={navBgStyle}
        >
            <div className="flex items-center justify-between">
                {/* Left side: Logo + Navigation */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className={`lg:hidden ${mobileMenuButtonClass} hover:bg-black/5 dark:hover:bg-white/10`}
                    >
                        <IconComponent icon="fa-solid fa-bars" className="text-xl" />
                    </Button>

                    <div className="flex items-center gap-2 mr-8">
                        {config.logoUrl && (
                            <img src={config.logoUrl} alt="Logo" className="h-8 w-auto" />
                        )}
                        <span className={`text-xl font-bold ml-1 hidden sm:block ${logoColorClass}`}>
                            {config.siteName || 'Navlink'}
                        </span>
                    </div>

                    <div className="hidden lg:flex items-center space-x-0 text-sm font-medium">
                        {visibleNavItems.map((link) => (
                            <div
                                key={link.id}
                                className="relative group"
                                onMouseEnter={() => setHoverId(link.id)}
                                onMouseLeave={() => setHoverId(null)}
                            >
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target={link.openInNewTab ? '_blank' : undefined}
                                    rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                                    className={`flex items-center gap-2 px-2 py-2 text-sm font-medium rounded-lg transition-all ${linkColorClass}`}
                                    style={linkColorStyle}
                                >
                                    {link.icon && <i className={link.icon}></i>}
                                    <span>{link.title}</span>
                                    {link.children && link.children.length > 0 && <i className="fa-solid fa-angle-down text-xs mt-0.5"></i>}
                                </a>
                                {/* Submenu */}
                                {link.children && link.children.length > 0 && hoverId === link.id && (
                                    <div className="absolute top-full left-0 bg-white text-gray-700 shadow-lg rounded-lg py-2 min-w-[140px] animate-fade-in">
                                        {link.children.map(sub => (
                                            <a
                                                key={sub.id}
                                                href={sub.url}
                                                target={sub.openInNewTab ? '_blank' : undefined}
                                                rel={sub.openInNewTab ? 'noopener noreferrer' : undefined}
                                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                                            >
                                                {sub.icon && <i className={`${sub.icon} text-gray-400 w-5 text-center`}></i>}
                                                <span>{sub.title}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side: Quote + User/Search */}
                <div className="flex items-center space-x-4">
                    <span className={`hidden md:block text-xs mr-4 truncate max-w-[500px] ${quoteColorClass}`} style={quoteColorStyle} title={config.headerQuote}>
                        {config.headerQuote || '对你竖大拇指的人，不一定是在夸你，也可能是用炮在瞄你。'}
                    </span>
                    <div className={`flex items-center gap-6 pl-6 sm:border-l ${borderColorClass}`}>
                        <div
                            className="relative"
                            onMouseEnter={() => {
                                if (menuTimer) clearTimeout(menuTimer);
                                setShowUserMenu(true);
                            }}
                            onMouseLeave={() => {
                                const timer = setTimeout(() => setShowUserMenu(false), 500);
                                setMenuTimer(timer);
                            }}
                        >
                            <Button
                                variant="ghost"
                                className={`relative group px-1 ${isAuthenticated
                                    ? 'text-green-500 hover:text-green-600'
                                    : iconButtonClass
                                    } hover:bg-transparent`}
                                onClick={() => {
                                    // 移动端友好：已登录时点击切换菜单，未登录时跳转登录
                                    if (isAuthenticated) {
                                        setShowUserMenu(prev => !prev);
                                    } else {
                                        onUserClick();
                                    }
                                }}
                            >
                                {/* User Icon - changes style based on login status */}
                                <IconComponent
                                    icon={isAuthenticated ? "fa-solid fa-user-check" : "fa-regular fa-user"}
                                    className="text-lg"
                                />

                                {/* Status Badge - green dot when logged in */}
                                {isAuthenticated && (
                                    <span className="absolute top-1 right-0 w-2 h-2 bg-green-400 rounded-full border border-white/20 shadow-sm animate-pulse"></span>
                                )}

                                {/* Tooltip - only show when dropdown is not visible */}
                                {!showUserMenu && (
                                    <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 normal-case font-normal">
                                        {isAuthenticated ? '点击显示菜单' : '点击登录'}
                                        {/* Arrow */}
                                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                    </div>
                                )}
                            </Button>

                            {/* Dropdown Menu - show for both authenticated and unauthenticated users */}
                            {showUserMenu && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden animate-fade-in z-50">
                                    {isAuthenticated ? (
                                        // 已登录用户显示后台和退出
                                        <>
                                            <a
                                                href="/admin/dashboard"
                                                onClick={() => setShowUserMenu(false)}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 block"
                                            >
                                                <IconComponent icon="fa-solid fa-cog" className="text-gray-400" />
                                                <span>后台管理</span>
                                            </a>
                                            <div className="border-t border-gray-100"></div>
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setShowUserMenu(false);
                                                    onLogout();
                                                }}
                                                className="w-full px-4 py-2.5 justify-start text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2 rounded-none h-auto"
                                            >
                                                <IconComponent icon="fa-solid fa-right-from-bracket" className="text-red-500" />
                                                <span>退出登录</span>
                                            </Button>
                                        </>
                                    ) : (
                                        // 未登录用户显示登录按钮
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false);
                                                onUserClick();
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
                                        >
                                            <IconComponent icon="fa-solid fa-right-to-bracket" className="text-blue-500" />
                                            <span>登录后台</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className={`${iconButtonClass} hover:bg-black/5 dark:hover:bg-white/10`}
                            onClick={onSearchClick}
                            aria-label="Open search"
                        >
                            <IconComponent icon="fa-solid fa-magnifying-glass" className="text-lg" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Menu */}
            <div className="lg:hidden">
                <FloatingMenu items={visibleNavItems.filter(item => item.showOnMobile)} />
            </div>
        </nav>
    );
};

export default TopNavbar;
