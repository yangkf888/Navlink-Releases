/**
 * 全局搜索栏组件
 * 置顶显示在所有页面，支持选择视频源进行搜索
 * 包含收藏、历史、管理按钮和主题切换
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { VideoSource } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AppModule } from '../App';

interface GlobalSearchBarProps {
    sources: VideoSource[];
    onSearch: (keyword: string, sourceId: number | null) => void;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    activeView: string;
    activeModule: AppModule;
    onModuleChange: (module: AppModule) => void;
    onToggleSidebar?: () => void; // 移动端侧边栏切换
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    isAdminPasswordEnabled?: boolean;
}

// 简单的密码输入模态框
function PasswordModal({ isOpen, onClose, onLogin }: { isOpen: boolean; onClose: () => void; onLogin: (pwd: string) => Promise<boolean> }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;

        setLoading(true);
        setError('');

        const success = await onLogin(password);
        if (success) {
            setPassword('');
            onClose();
            // 登录成功后强制刷新页面以同步所有状态
            window.location.reload();
        } else {
            setError('密码错误');
        }
        setLoading(false);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-secondary rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-border-color transform transition-all">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-user-shield text-red-500 text-2xl"></i>
                    </div>
                    <h3 className="text-2xl font-black text-primary">管理员登录</h3>
                    <p className="text-secondary text-sm mt-1">请输入管理密码以继续</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="relative">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="管理密码"
                            className="w-full px-4 py-3 bg-tertiary text-primary rounded-xl border border-border-color focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-center font-mono tracking-wider transition-all placeholder:text-secondary/50"
                            autoFocus
                        />
                        {error && (
                            <div className="flex items-center justify-center gap-2 mt-3 text-red-500 text-xs font-bold animate-shake">
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-secondary hover:bg-tertiary text-primary rounded-xl border border-border-color font-bold transition-all active:scale-95"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                            ) : (
                                '确认登录'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}


// localStorage key
const THEME_KEY = 'video_theme';

export function GlobalSearchBar({ sources, onSearch, onNavigate, activeView, activeModule, onModuleChange, onToggleSidebar, theme, onToggleTheme, isAdminPasswordEnabled }: GlobalSearchBarProps) {
    const [keyword, setKeyword] = useState('');
    const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false); // 移动端搜索弹出层

    // 认证状态
    const { isAuthenticated, login, logout } = useAuth();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // 应用主题到 document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);

        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        }
    }, [theme]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (keyword.trim()) {
            onSearch(keyword.trim(), selectedSourceId);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && keyword.trim()) {
            onSearch(keyword.trim(), selectedSourceId);
        }
    };

    const handleUserIconClick = async () => {
        if (isAuthenticated) {
            setIsUserMenuOpen(!isUserMenuOpen);
        } else if (!isAdminPasswordEnabled) {
            // 后台未启用密码：自动免密登录并刷新
            const success = await login('');
            if (success) {
                window.location.reload();
            }
        } else {
            setIsLoginModalOpen(true);
        }
    };

    const handleLogout = () => {
        logout();
        setIsUserMenuOpen(false);
        // 退出后强制刷新页面以同步所有状态
        window.location.reload();
    };

    const selectedSource = sources.find(s => s.id === selectedSourceId);

    // 按钮样式
    const buttonClass = (isActive: boolean) => `
        p-2.5 rounded-lg transition-colors text-sm
        ${isActive
            ? 'bg-blue-600 text-primary shadow-md shadow-blue-500/20'
            : theme === 'dark'
                ? 'text-secondary hover:text-primary hover:bg-white/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
        }
    `;

    const buttonStyle = (isActive: boolean) => isActive ? { color: '#fff' } : undefined;

    return (
        <>
            {/* 移动端导航栏 - 简洁版 */}
            <div className={`lg:hidden sticky top-0 z-20 border-b px-3 py-2 transition-colors
                ${theme === 'dark'
                    ? 'bg-secondary/95 border-border-color backdrop-blur-lg'
                    : 'bg-white/95 border-gray-200 backdrop-blur-lg'
                }`}
            >
                <div className="flex items-center justify-between">
                    {/* 左侧：侧边栏按钮 + 标题 */}
                    <div className="flex items-center gap-3">
                        {onToggleSidebar && (
                            <button
                                onClick={onToggleSidebar}
                                className={`p-2 rounded-lg transition-colors
                                    ${theme === 'dark'
                                        ? 'text-secondary hover:text-primary hover:bg-white/10'
                                        : 'text-secondary hover:text-slate-900 hover:bg-black/5'
                                    }`}
                            >
                                <i className="fas fa-bars text-lg"></i>
                            </button>
                        )}
                        <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-primary' : 'text-gray-900'}`}>
                            视频中心
                        </h1>
                    </div>

                    {/* 右侧：工具按钮 */}
                    <div className="flex items-center gap-1">
                        {/* 搜索按钮 */}
                        <button
                            onClick={() => setIsMobileSearchOpen(true)}
                            className={`p-2 rounded-lg transition-colors
                                ${theme === 'dark'
                                    ? 'text-secondary hover:text-primary hover:bg-secondary'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <i className="fas fa-search"></i>
                        </button>

                        {/* 主题切换 */}
                        <button
                            onClick={onToggleTheme}
                            className={`p-2 rounded-lg transition-colors
                                ${theme === 'dark'
                                    ? 'text-secondary hover:text-primary hover:bg-secondary'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
                        </button>

                        {/* 用户图标 - 始终显示以提供管理入口 */}
                        <div className="relative">
                            <button
                                onClick={handleUserIconClick}
                                className={`p-2 rounded-lg transition-colors
                                    ${isAuthenticated
                                        ? 'text-green-400'
                                        : theme === 'dark'
                                            ? 'text-secondary hover:text-primary'
                                            : 'text-secondary hover:text-gray-600'
                                    }`}
                            >
                                <i className={`fas ${isAuthenticated ? 'fa-user-check' : 'fa-user-lock'}`}></i>
                            </button>

                            {/* 移动端用户菜单 */}
                            {isUserMenuOpen && isAuthenticated && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[60]"
                                        onClick={() => setIsUserMenuOpen(false)}
                                    ></div>
                                    <div className={`absolute right-0 top-full mt-2 w-48 py-2 rounded-xl shadow-2xl z-[70] transform origin-top-right transition-all animate-in fade-in zoom-in duration-200
                                    ${theme === 'dark'
                                            ? 'bg-secondary border border-border-color shadow-black/50'
                                            : 'bg-white border border-gray-100 shadow-slate-200'
                                        }`}
                                    >
                                        <div className="px-4 py-2 border-b border-border-color mb-1">
                                            <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">当前身份</p>
                                            <p className="text-sm font-bold text-primary">系统管理员</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors
                                            ${theme === 'dark'
                                                    ? 'text-red-400 hover:bg-red-500/10'
                                                    : 'text-red-500 hover:bg-red-50'
                                                }`}
                                        >
                                            <i className="fas fa-sign-out-alt"></i>
                                            <span className="font-bold">安全退出登录</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 移动端搜索弹出层 */}
            {isMobileSearchOpen && (
                <div className={`lg:hidden fixed inset-0 z-50 ${theme === 'dark' ? 'bg-secondary' : 'bg-white'}`}>
                    <div className="flex flex-col h-full">
                        {/* 搜索标题栏 */}
                        <div className={`flex items-center gap-3 px-3 py-3 border-b ${theme === 'dark' ? 'border-border-color' : 'border-gray-200'}`}>
                            <button
                                onClick={() => setIsMobileSearchOpen(false)}
                                className={`p-2 rounded-lg transition-colors
                                    ${theme === 'dark'
                                        ? 'text-secondary hover:text-primary hover:bg-secondary'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                <i className="fas fa-arrow-left"></i>
                            </button>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && keyword.trim()) {
                                            onSearch(keyword.trim(), selectedSourceId);
                                            setIsMobileSearchOpen(false);
                                        }
                                    }}
                                    placeholder="搜索电影、电视剧、动漫..."
                                    autoFocus
                                    className={`w-full px-4 py-2.5 pl-10 rounded-lg border focus:outline-none transition-colors text-sm
                                        ${theme === 'dark'
                                            ? 'bg-secondary text-primary border-border-color focus:border-red-500 placeholder-gray-500'
                                            : 'bg-gray-100 text-gray-900 border-gray-300 focus:border-red-500 placeholder-gray-400'
                                        }`}
                                />
                                <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm
                                    ${theme === 'dark' ? 'text-secondary' : 'text-secondary'}`}></i>
                            </div>
                            <button
                                onClick={() => {
                                    if (keyword.trim()) {
                                        onSearch(keyword.trim(), selectedSourceId);
                                        setIsMobileSearchOpen(false);
                                    }
                                }}
                                disabled={!keyword.trim()}
                                className="px-4 py-2.5 bg-red-500 text-primary rounded-lg hover:bg-red-600 
                                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                搜索
                            </button>
                        </div>

                        {/* 搜索提示 */}
                        <div className="flex-1 p-4">
                            <p className={`text-sm ${theme === 'dark' ? 'text-secondary' : 'text-secondary'}`}>
                                <i className="fas fa-lightbulb mr-2 text-yellow-500"></i>
                                输入关键词后点击搜索或按回车键
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 桌面端导航栏 (原有布局) */}
            <div className={`hidden lg:block sticky top-0 z-[50] border-b px-4 py-3 h-16 transition-colors
                ${theme === 'dark'
                    ? 'bg-secondary/80 border-border-color backdrop-blur-lg'
                    : 'bg-white/80 border-gray-200 backdrop-blur-lg'
                }`}
            >
                <div className="flex items-center gap-2">
                    {/* 左侧：视频源选择器 + 搜索框 */}
                    <div className="flex items-center gap-2 flex-1 max-w-3xl">
                        {/* 视频源选择器 */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm transition-colors min-w-[100px]
                                ${theme === 'dark'
                                        ? 'bg-secondary border-border-color text-primary hover:bg-gray-750'
                                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <i className="fas fa-database text-xs opacity-70"></i>
                                <span className="truncate">{selectedSource?.name || '全部源'}</span>
                                <i className={`fas fa-chevron-down text-xs transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                            </button>

                            {isDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsDropdownOpen(false)}
                                    ></div>
                                    <div className={`absolute top-full left-0 mt-1 w-48 border rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-y-auto
                                    ${theme === 'dark'
                                            ? 'bg-secondary border-border-color'
                                            : 'bg-white border-gray-200'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSourceId(null);
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors
                                            ${selectedSourceId === null
                                                    ? theme === 'dark' ? 'text-blue-400 bg-gray-700/50' : 'text-blue-600 bg-blue-100'
                                                    : theme === 'dark' ? 'text-primary hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                        >
                                            <i className="fas fa-globe mr-2 opacity-70"></i>
                                            全部视频源
                                        </button>
                                        {sources.map(source => (
                                            <button
                                                key={source.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSourceId(source.id);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors
                                                ${selectedSourceId === source.id
                                                        ? theme === 'dark' ? 'text-blue-400 bg-gray-700/50' : 'text-blue-600 bg-blue-100'
                                                        : theme === 'dark' ? 'text-primary hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <i className="fas fa-database mr-2 opacity-70"></i>
                                                {source.name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 搜索输入框 */}
                        <form onSubmit={handleSubmit} className="flex-1 relative flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="搜索电影、电视剧、动漫..."
                                    className={`w-full px-4 py-2.5 pl-10 rounded-lg border focus:outline-none transition-colors text-sm
                                    ${theme === 'dark'
                                            ? 'bg-secondary text-primary border-border-color focus:border-red-500 placeholder-gray-500'
                                            : 'bg-gray-100 text-gray-900 border-gray-300 focus:border-red-500 placeholder-gray-400'
                                        }`}
                                />
                                <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm
                                ${theme === 'dark' ? 'text-secondary' : 'text-secondary'}`}></i>
                                {keyword && (
                                    <button
                                        type="button"
                                        onClick={() => setKeyword('')}
                                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors
                                        ${theme === 'dark' ? 'text-secondary hover:text-primary' : 'text-secondary hover:text-gray-600'}`}
                                    >
                                        <i className="fas fa-times text-xs"></i>
                                    </button>
                                )}
                            </div>

                            {/* 搜索按钮 */}
                            <button
                                type="submit"
                                disabled={!keyword.trim()}
                                className="px-5 py-2.5 bg-blue-600 text-primary rounded-lg hover:bg-blue-700 
                                     transition-all duration-300 shadow-lg shadow-blue-500/20 
                                     disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                <i className="fas fa-search"></i>
                            </button>
                        </form>
                    </div>

                    {/* 导航菜单 - 放在搜索框和右侧工具栏之间，靠右 */}
                    <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
                        {[
                            { key: 'home', label: '首页', icon: 'fa-home' },
                            { key: 'sources', label: '资源站', icon: 'fa-database' },
                            { key: 'tv', label: '电视', icon: 'fa-tv' },
                            { key: 'live', label: '直播', icon: 'fa-broadcast-tower' },
                            { key: 'netdisk', label: '媒体库', icon: 'fa-cloud' },
                        ].map(item => (
                            <button
                                key={item.key}
                                onClick={() => onModuleChange(item.key as AppModule)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5
                                ${activeModule === item.key
                                        ? 'bg-blue-500'
                                        : theme === 'dark'
                                            ? 'text-secondary hover:text-primary hover:bg-secondary'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                                style={activeModule === item.key ? { color: '#fff' } : undefined}
                            >
                                <i className={`fas ${item.icon} text-xs`}></i>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* 右侧工具栏 */}
                    <div className="flex items-center gap-1">
                        {/* 主题切换开关 */}
                        <div
                            className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1
                            ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-100'}`}
                            onClick={onToggleTheme}
                            title={theme === 'dark' ? '切换到明亮模式' : '切换到暗黑模式'}
                        >
                            {/* 滑块 */}
                            <div
                                className={`absolute w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center
                                ${theme === 'dark'
                                        ? 'left-1 bg-gray-600'
                                        : 'left-8 bg-yellow-400'
                                    }`}
                            >
                                <i className={`fas ${theme === 'dark' ? 'fa-moon text-blue-300' : 'fa-sun text-yellow-600'} text-xs`}></i>
                            </div>
                        </div>

                        {/* 分隔线 */}
                        <div className={`w-px h-6 mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

                        {/* 收藏按钮 */}
                        {(!isAdminPasswordEnabled || isAuthenticated) && (
                            <button
                                onClick={() => onNavigate('favorites')}
                                className={buttonClass(activeView === 'favorites')}
                                style={buttonStyle(activeView === 'favorites')}
                                title="我的收藏"
                            >
                                <i className="fas fa-heart"></i>
                            </button>
                        )}

                        {/* 历史按钮 */}
                        {(!isAdminPasswordEnabled || isAuthenticated) && (
                            <button
                                onClick={() => onNavigate('history')}
                                className={buttonClass(activeView === 'history')}
                                style={buttonStyle(activeView === 'history')}
                                title="观看历史"
                            >
                                <i className="fas fa-history"></i>
                            </button>
                        )}

                        {/* 管理按钮 */}
                        {(!isAdminPasswordEnabled || isAuthenticated) && (
                            <button
                                onClick={() => onNavigate('admin')}
                                className={buttonClass(activeView === 'admin')}
                                style={buttonStyle(activeView === 'admin')}
                                title="视频源管理"
                            >
                                <i className="fas fa-cog"></i>
                            </button>
                        )}

                        {/* 登录状态图标 - 始终显示以提供管理入口 */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={handleUserIconClick}
                                className={`p-2.5 rounded-lg text-sm transition-colors ${isAuthenticated
                                    ? 'text-green-400 hover:bg-gray-700/50'
                                    : theme === 'dark' ? 'text-gray-600 hover:text-primary hover:bg-gray-700/50' : 'text-secondary hover:text-gray-600 hover:bg-gray-200'
                                    }`}
                                title={isAuthenticated ? '已认证 (点击管理)' : '未认证 (点击登录)'}
                            >
                                <i className={`fas ${isAuthenticated ? 'fa-user-check' : 'fa-user-lock'}`}></i>
                            </button>

                            {/* 用户菜单 - 增加美化与层级控制 */}
                            {isUserMenuOpen && isAuthenticated && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[60]"
                                        onClick={() => setIsUserMenuOpen(false)}
                                    ></div>
                                    <div className={`absolute right-0 top-full mt-2 w-56 py-3 rounded-2xl shadow-2xl z-[70] transform origin-top-right transition-all animate-in fade-in zoom-in duration-200
                                    ${theme === 'dark'
                                            ? 'bg-[#1a1c1e] border border-white/10 shadow-black/60 backdrop-blur-xl'
                                            : 'bg-white border border-slate-100 shadow-slate-200/80'
                                        }`}
                                    >
                                        <div className="px-4 py-3 border-b border-border-color/50 mb-2 bg-gradient-to-r from-red-500/5 to-transparent">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                <p className="text-[10px] text-secondary uppercase font-black tracking-[0.2em]">当前用户</p>
                                            </div>
                                            <p className="text-sm font-extrabold text-primary">系统管理员</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-all duration-300
                                            ${theme === 'dark'
                                                    ? 'text-red-400 hover:bg-red-500/20 hover:pl-5'
                                                    : 'text-red-500 hover:bg-red-50 hover:pl-5'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}>
                                                <i className="fas fa-sign-out-alt"></i>
                                            </div>
                                            <span className="font-bold">全面退出登录</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* 登录弹窗 */}
            <PasswordModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={login}
            />
        </>
    );
}
