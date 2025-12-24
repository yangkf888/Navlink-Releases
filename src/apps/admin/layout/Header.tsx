import React, { useState, useEffect, useRef } from 'react';
import { Bell, Settings, ArrowUpCircle, X } from 'lucide-react';
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

    return (
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

                {/* 设置 */}
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
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
    );
}
