import React from 'react';
import { Bell, Settings } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            {/* 面包屑导航 */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">仪表盘</span>
            </div>

            {/* 右侧操作 */}
            <div className="flex items-center gap-4">
                {/* 通知 */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Bell size={20} className="text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

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
