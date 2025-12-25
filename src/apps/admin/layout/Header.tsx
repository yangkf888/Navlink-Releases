import React, { useState, useEffect, useRef } from 'react';
import { Bell, Settings, ArrowUpCircle, X, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpdateNotification {
    hasUpdate: boolean;
    latestVersion: string | null;
    currentVersion: string | null;
    lastChecked: string | null;
}

export default function Header() {
    const navigate = useNavigate();
    const [notification, setNotification] = useState<UpdateNotification | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 获取更新通知状态
    useEffect(() => {
        const fetchNotification = async () => {
            try {
                const response = await fetch('/api/system/update-notification');
                if (response.ok) {
                    const data = await response.json();
                    setNotification(data);
                }
            } catch (err) {
                console.error('Failed to fetch update notification:', err);
            }
        };

        fetchNotification();
        // 每5分钟检查一次
        const interval = setInterval(fetchNotification, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 关闭通知
    const dismissNotification = async () => {
        try {
            await fetch('/api/system/update-notification/dismiss', { method: 'POST' });
            setNotification(prev => prev ? { ...prev, hasUpdate: false } : null);
        } catch (err) {
            console.error('Failed to dismiss notification:', err);
        }
        setShowDropdown(false);
    };

    // 跳转到升级页面
    const goToUpdate = () => {
        setShowDropdown(false);
        navigate('/admin/settings/update');
    };

    // 处理密码修改
    const handlePasswordChange = async () => {
        setPasswordError('');
        setPasswordSuccess('');

        const { oldPassword, newPassword, confirmPassword } = passwordForm;

        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordError('请填写所有密码字段');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('新密码长度不能少于6位');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('两次输入的新密码不一致');
            return;
        }

        setIsChangingPassword(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            if (response.ok) {
                setPasswordSuccess('密码修改成功！下次登录请使用新密码');
                setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setShowPasswordModal(false);
                    setPasswordSuccess('');
                }, 2000);
            } else {
                const data = await response.json();
                setPasswordError(data.error || '密码修改失败');
            }
        } catch (err) {
            setPasswordError('网络错误，请重试');
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <>
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
                {/* 面包屑导航 */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-900">仪表盘</span>
                </div>

                {/* 右侧操作 */}
                <div className="flex items-center gap-4">
                    {/* 通知 */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            <Bell size={20} className="text-gray-600" />
                            {notification?.hasUpdate && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                        </button>

                        {/* 下拉菜单 */}
                        {showDropdown && (
                            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
                                <div className="p-3 border-b border-gray-100 bg-gray-50">
                                    <h3 className="font-semibold text-gray-900">通知</h3>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notification?.hasUpdate ? (
                                        <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <ArrowUpCircle className="text-blue-600" size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">有新版本可用</p>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        v{notification.currentVersion} → v{notification.latestVersion}
                                                    </p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={goToUpdate}
                                                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            查看详情
                                                        </button>
                                                        <button
                                                            onClick={dismissNotification}
                                                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                                        >
                                                            忽略
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={dismissNotification}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-gray-500">
                                            <Bell className="mx-auto mb-2 text-gray-300" size={32} />
                                            <p className="text-sm">暂无新通知</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 设置 - 打开密码修改弹窗 */}
                    <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={() => setShowPasswordModal(true)}
                        title="修改密码"
                    >
                        <Settings size={20} className="text-gray-600" />
                    </button>

                    {/* 用户菜单 */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                window.location.href = '/';
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            返回前台
                        </button>
                    </div>
                </div>
            </header>

            {/* 密码修改弹窗 */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <Lock size={20} />
                                <h3 className="font-semibold">修改密码</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                                    setPasswordError('');
                                    setPasswordSuccess('');
                                }}
                                className="text-white/80 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {passwordError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {passwordError}
                                </div>
                            )}
                            {passwordSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                                    {passwordSuccess}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.old ? 'text' : 'password'}
                                        value={passwordForm.oldPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                        placeholder="输入当前密码"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPasswords.old ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                        placeholder="输入新密码（至少6位）"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                        placeholder="再次输入新密码"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                                    setPasswordError('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handlePasswordChange}
                                disabled={isChangingPassword}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isChangingPassword ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        处理中...
                                    </>
                                ) : (
                                    '确认修改'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
