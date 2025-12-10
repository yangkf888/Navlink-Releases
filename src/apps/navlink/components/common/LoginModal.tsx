

import React, { useState, useEffect } from 'react';
import { Icon } from '@/shared/components/common/Icon';
import { toast } from 'react-hot-toast';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setLoading(false);
        }
    }, [isOpen]);

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            toast.error('请输入密码');
            return;
        }

        try {
            setLoading(true);

            // 直接调用API，避免缓存问题
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '登录失败');
            }

            const { token } = await response.json();
            localStorage.setItem('auth_token', token);

            toast.success('登录成功');
            onClose();

            // 刷新页面以更新认证状态
            window.location.reload();
        } catch (error: any) {
            toast.error(error.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden p-8">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                >
                    <Icon icon="fa-solid fa-times" />
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[var(--theme-primary)] rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-lg shadow-[var(--theme-primary)]/30">
                        <Icon icon="fa-solid fa-lock" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">管理员登录</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">请输入您的账号密码</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            用户名
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Icon icon="fa-solid fa-user" />
                            </div>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent transition-all outline-none"
                                placeholder="Admin"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            密码
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Icon icon="fa-solid fa-key" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent transition-all outline-none"
                                placeholder="••••••••"
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-[var(--theme-primary)] hover:brightness-110 text-white font-medium rounded-lg shadow-lg shadow-[var(--theme-primary)]/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                登录中...
                            </>
                        ) : (
                            <>
                                登录
                                <Icon icon="fa-solid fa-arrow-right" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
