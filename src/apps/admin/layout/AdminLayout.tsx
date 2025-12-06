import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu, X } from 'lucide-react';
import { useConfig } from '@/shared/context/ConfigContext';
import { useSessionManager, useTokenRefresh } from '@/shared/hooks/useSessionManager';

interface Props {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: Props) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isAuthenticated, isLoaded } = useConfig();
    const navigate = useNavigate();

    // 启用会话管理和Token刷新
    useSessionManager();
    useTokenRefresh();

    // 检查登录状态 - 未登录则重定向到登录页面
    useEffect(() => {
        if (isLoaded && !isAuthenticated) {
            console.log('[AdminLayout] User not authenticated, redirecting to login');
            navigate('/admin/login');
        }
    }, [isAuthenticated, isLoaded, navigate]);

    // 加载中显示
    if (!isLoaded) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">加载中...</p>
                </div>
            </div>
        );
    }

    // 未认证时显示空白页面（防止闪烁）
    if (!isAuthenticated) {
        return null;
    }
    
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* 移动端遮罩 */}
            {mobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            
            {/* 左侧边栏 */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50 lg:z-0
                transform transition-transform duration-300
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <Sidebar 
                    collapsed={sidebarCollapsed} 
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
                />
            </div>
            
            {/* 主内容区 */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* 移动端菜单按钮 */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-md"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                
                <Header />
                
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
                
                <footer className="bg-white border-t border-gray-200 px-6 py-3 text-center text-sm text-gray-500">
                    Powered by NavLink v2.0
                </footer>
            </div>
        </div>
    );
}
