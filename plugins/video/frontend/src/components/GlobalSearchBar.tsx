/**
 * 全局搜索栏组件
 * 置顶显示在所有页面，支持选择视频源进行搜索
 * 包含收藏、历史、管理按钮和主题切换
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { VideoSource } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface GlobalSearchBarProps {
    sources: VideoSource[];
    onSearch: (keyword: string, sourceId: number | null) => void;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    activeView: string;
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
        } else {
            setError('密码错误');
        }
        setLoading(false);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 text-center">管理员登录</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="输入管理密码"
                            className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none text-center"
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? '验证中...' : '登录'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

// 主题类型
type Theme = 'dark' | 'light';

// localStorage key
const THEME_KEY = 'video_theme';

export function GlobalSearchBar({ sources, onSearch, onNavigate, activeView }: GlobalSearchBarProps) {
    const [keyword, setKeyword] = useState('');
    const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // 认证状态
    const { isAuthenticated, login, logout } = useAuth();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return (saved as Theme) || 'dark';
    });

    // 应用主题到 document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);

        if (theme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
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

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            setIsUserMenuOpen(!isUserMenuOpen);
        } else {
            setIsLoginModalOpen(true);
        }
    };

    const handleLogout = () => {
        logout();
        setIsUserMenuOpen(false);
    };

    const selectedSource = sources.find(s => s.id === selectedSourceId);

    // 按钮样式
    const buttonClass = (isActive: boolean) => `
        p-2.5 rounded-lg transition-colors text-sm
        ${isActive
            ? 'bg-red-500 text-white'
            : theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }
    `;

    return (
        <div className={`sticky top-0 z-20 border-b px-4 py-3 transition-colors
            ${theme === 'dark'
                ? 'bg-gray-900/80 border-gray-800 backdrop-blur-lg'
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
                                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
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
                                        ? 'bg-gray-800 border-gray-700'
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
                                                ? 'text-blue-400 bg-gray-700/50'
                                                : theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
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
                                                    ? 'text-blue-400 bg-gray-700/50'
                                                    : theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
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
                                        ? 'bg-gray-800 text-white border-gray-700 focus:border-red-500 placeholder-gray-500'
                                        : 'bg-gray-100 text-gray-900 border-gray-300 focus:border-red-500 placeholder-gray-400'
                                    }`}
                            />
                            <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm
                                ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}></i>
                            {keyword && (
                                <button
                                    type="button"
                                    onClick={() => setKeyword('')}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors
                                        ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <i className="fas fa-times text-xs"></i>
                                </button>
                            )}
                        </div>

                        {/* 搜索按钮 */}
                        <button
                            type="submit"
                            disabled={!keyword.trim()}
                            className="px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 
                                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            <i className="fas fa-search"></i>
                        </button>
                    </form>
                </div>

                {/* 右侧工具栏 - 靠右对齐 */}
                <div className="flex items-center gap-1 ml-auto">
                    {/* 主题切换开关 */}
                    <div
                        className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1
                            ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-100'}`}
                        onClick={toggleTheme}
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
                    <button
                        onClick={() => onNavigate('favorites')}
                        className={buttonClass(activeView === 'favorites')}
                        title="我的收藏"
                    >
                        <i className="fas fa-heart"></i>
                    </button>

                    {/* 历史按钮 */}
                    <button
                        onClick={() => onNavigate('history')}
                        className={buttonClass(activeView === 'history')}
                        title="观看历史"
                    >
                        <i className="fas fa-history"></i>
                    </button>

                    {/* 管理按钮 */}
                    <button
                        onClick={() => onNavigate('admin')}
                        className={buttonClass(activeView === 'admin')}
                        title="视频源管理"
                    >
                        <i className="fas fa-cog"></i>
                    </button>

                    {/* 登录状态图标 */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={handleUserIconClick}
                            className={`p-2.5 rounded-lg text-sm transition-colors ${isAuthenticated
                                ? 'text-green-400 hover:bg-gray-700/50'
                                : theme === 'dark' ? 'text-gray-600 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                }`}
                            title={isAuthenticated ? '已认证 (点击管理)' : '未认证 (点击登录)'}
                        >
                            <i className={`fas ${isAuthenticated ? 'fa-user-check' : 'fa-user-lock'}`}></i>
                        </button>

                        {/* 用户菜单 */}
                        {isUserMenuOpen && isAuthenticated && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsUserMenuOpen(false)}
                                ></div>
                                <div className={`absolute right-0 top-full mt-2 w-32 py-1 rounded-lg shadow-xl z-20
                                    ${theme === 'dark'
                                        ? 'bg-gray-800 border border-gray-700'
                                        : 'bg-white border border-gray-200'
                                    }`}
                                >
                                    <button
                                        onClick={handleLogout}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2
                                            ${theme === 'dark'
                                                ? 'text-red-400 hover:bg-gray-700'
                                                : 'text-red-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <i className="fas fa-sign-out-alt"></i>
                                        退出登录
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 登录弹窗 */}
            <PasswordModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={login}
            />
        </div>
    );
}
