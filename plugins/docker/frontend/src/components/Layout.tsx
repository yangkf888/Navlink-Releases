/**
 * Docker 插件布局组件
 * 管理侧边栏显示和移动端顶部栏
 */
import { ReactNode, useState } from 'react';
import { Sidebar, DockerView } from './Sidebar';
import { DockerServer } from '../types/docker';

interface LayoutProps {
    children: ReactNode;
    activeView: DockerView;
    onViewChange: (view: DockerView) => void;
    selectedServer: DockerServer | null;
    servers: DockerServer[];
    onSelectServer: (server: DockerServer) => void;
}

export function Layout({
    children,
    activeView,
    onViewChange,
    selectedServer,
    servers,
    onSelectServer
}: LayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false);

    // 注意：postMessage 空侧边栏配置现在由 App.tsx 处理，避免重复发送

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* 桌面端侧边栏 */}
            <div className="hidden lg:flex w-60 flex-shrink-0 border-r border-gray-200">
                <Sidebar
                    activeView={activeView}
                    onViewChange={onViewChange}
                    selectedServer={selectedServer}
                    servers={servers}
                    onSelectServer={onSelectServer}
                />
            </div>

            {/* 移动端侧边栏抽屉 */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-2xl">
                        <Sidebar
                            activeView={activeView}
                            onViewChange={onViewChange}
                            selectedServer={selectedServer}
                            servers={servers}
                            onSelectServer={onSelectServer}
                            isMobile={true}
                            onCloseMobile={() => setMobileOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* 主内容区域 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 移动端顶部栏 */}
                <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <i className="fas fa-bars text-lg"></i>
                            </button>
                            <h1 className="text-lg font-bold text-gray-800">Docker管理</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedServer && (
                                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                    <span className={`w-2 h-2 rounded-full ${selectedServer.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="max-w-[100px] truncate">{selectedServer.name}</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
