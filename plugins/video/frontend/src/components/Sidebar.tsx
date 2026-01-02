
import { useState } from 'react';
import { VideoSource, Category } from '../types';

interface NavParams {
    sourceId?: number;
    categoryId?: string;
    categoryName?: string;
    vodId?: string;
    keyword?: string;
}

interface SidebarProps {
    sources: VideoSource[];
    categoriesMap: Record<number, Category[]>;
    selectedSourceId: number | null;
    onSourceChange: (id: number) => void;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    activeView: string;
    navParams: NavParams;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    isMobile?: boolean; // 是否为移动端模式
    onCloseMobile?: () => void;
}

export function Sidebar({
    sources,
    // categoriesMap,
    selectedSourceId,
    onSourceChange,
    onNavigate,
    activeView,
    navParams,
    collapsed = false,
    onToggleCollapse,
    isMobile = false,
    onCloseMobile
}: SidebarProps) {
    const [isSourcesOpen, setIsSourcesOpen] = useState(false);



    const isActive = (id: string) => {
        if (id === 'home' && activeView === 'home') return true;
        if (id.startsWith('source-')) {
            const sid = parseInt(id.split('-')[1]);
            return sid === selectedSourceId && activeView !== 'category'; // 只是选中源不代表选中分类
        }
        if (id.startsWith('cat-') && activeView === 'category') {
            // cat-SOURCE-TYPE
            const parts = id.split('-');
            const sid = parseInt(parts[1]);
            const tid = parts.slice(2).join('-');
            return sid === navParams.sourceId && tid === navParams.categoryId;
        }
        if (id === activeView) return true;
        return false;
    };

    const handleNavigate = (view: string, params?: Record<string, unknown>) => {
        onNavigate(view, params);
        if (onCloseMobile) onCloseMobile();
    };

    // 渲染 Logo/Header
    const renderHeader = () => {
        if (collapsed) {
            return (
                <div className="h-16 flex items-center justify-center border-b border-gray-800">
                    <i className="fas fa-play-circle text-blue-500 text-xl"></i>
                </div>
            );
        }
        return (
            <div className="p-4 h-16 border-b border-gray-800 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-play-circle text-blue-500"></i>
                        视频中心
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {sources.find(s => s.id === selectedSourceId)?.name || '多源视频聚合'}
                    </p>
                </div>
                {/* 移动端关闭按钮 */}
                {isMobile && onCloseMobile && (
                    <button onClick={onCloseMobile} className="text-gray-400 hover:text-white lg:hidden">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-950 text-gray-300 select-none pb-safe">
            {renderHeader()}

            <div className={`flex-1 w-full min-w-full sidebar-scrollbar scrollbar-overlay space-y-0.5 ${collapsed ? 'py-4' : 'py-2'}`}>
                {/* 首页 */}
                <SidebarItem
                    icon="fas fa-home"
                    label="首页"
                    isActive={isActive('home')}
                    onClick={() => handleNavigate('home')}
                    collapsed={collapsed}
                />

                {/* 视频源 (折叠组) */}
                <div className="w-full mt-2">
                    {!collapsed ? (
                        <div
                            className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white hover:bg-gray-800 transition-colors"
                            onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                        >
                            <i className={`fas fa-chevron-right text-xs w-4 transition-transform ${isSourcesOpen ? 'rotate-90' : ''}`}></i>
                            <span className="flex-1 ml-2">视频源</span>
                            <i className="fas fa-server text-xs opacity-70"></i>
                        </div>
                    ) : (
                        <div className="flex justify-center py-2 text-gray-500 border-t border-gray-800 mt-2 pt-4">
                            <i className="fas fa-server text-xs" title="视频源"></i>
                        </div>
                    )}

                    {(isSourcesOpen || collapsed) && (
                        <div className={collapsed ? "w-full space-y-1" : "w-full pl-4 space-y-1 mt-1"}>
                            {sources.map(source => (
                                <SidebarItem
                                    key={source.id}
                                    icon="fas fa-database"
                                    label={source.name}
                                    isActive={source.id === selectedSourceId && activeView !== 'category'}
                                    onClick={() => {
                                        onSourceChange(source.id);
                                        if (onCloseMobile) onCloseMobile();
                                    }}
                                    activeColor="text-blue-400"
                                    collapsed={collapsed}
                                />
                            ))}
                        </div>
                    )}
                </div>


            </div>

            {/* 底部折叠按钮 (仅桌面端) */}
            {!isMobile && onToggleCollapse && (
                <div className="p-3 border-t border-gray-800">
                    <button
                        onClick={onToggleCollapse}
                        className={`
                            flex items-center w-full px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors
                            ${collapsed ? 'justify-center' : 'justify-start'}
                        `}
                        title={collapsed ? "展开" : "收起"}
                    >
                        <i className={`fas fa-angle-double-${collapsed ? 'right' : 'left'} w-4 text-center`}></i>
                        {!collapsed && <span className="ml-2">收起侧边栏</span>}
                    </button>
                </div>
            )}
        </div>
    );
}



// 辅助组件：侧边栏项 (Full Bleed 风格)
function SidebarItem({ icon, label, isActive, onClick, activeColor = 'bg-gray-800 text-blue-400', collapsed }: any) {
    return (
        <div
            className={`
            w-full min-w-full flex items-center transition-colors text-sm cursor-pointer relative
            ${collapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'}
            ${isActive
                    ? `${activeColor} font-medium border-l-[3px] border-blue-500`
                    : 'hover:bg-gray-900 border-l-[3px] border-transparent text-gray-400 hover:text-gray-200'
                }
        `}
            onClick={onClick}
            title={collapsed ? label : ''}
        >
            <i className={`${icon} ${collapsed ? 'text-lg' : 'w-5 text-center text-sm opacity-80'}`}></i>
            {!collapsed && <span className="ml-3 flex-1 truncate text-left">{label}</span>}
        </div>
    );
}
