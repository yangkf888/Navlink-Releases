import { useState, useEffect } from 'react';
import { VideoSource, TvSource, TvChannel, Category } from '../types';
import { apiPost, apiGet } from '../utils/api';
import { AppModule } from '../App';

interface NavParams {
    sourceId?: number;
    categoryId?: string;
    categoryName?: string;
    vodId?: string;
    keyword?: string;
    platform?: string;
}

interface SidebarProps {
    sources: VideoSource[];
    categoriesMap: Record<number, Category[]>;
    selectedSourceId: number | null;
    onSourceChange: (id: number) => void;

    // TV Props
    tvSources?: TvSource[];
    selectedTvSourceId?: number | null;
    onTvSourceChange?: (id: number) => void;
    onPlayChannel?: (channel: TvChannel) => void;

    tvRefreshKey?: number; // New prop
    currentChannelUrl?: string; // Current playing channel URL
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    activeView: string;
    navParams: NavParams;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    isMobile?: boolean; // 是否为移动端模式
    onCloseMobile?: () => void;
    activeModule?: AppModule; // 当前激活的模块
    onModuleChange?: (module: AppModule) => void; // 模块切换回调
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;
}

export function Sidebar({
    sources,
    // categoriesMap,
    selectedSourceId,
    onSourceChange,

    tvSources = [],
    selectedTvSourceId,
    onTvSourceChange,
    onPlayChannel,
    tvRefreshKey,
    currentChannelUrl,

    onNavigate,
    activeView,
    navParams,
    collapsed = false,
    onToggleCollapse,
    isMobile = false,
    onCloseMobile,
    activeModule,
    onModuleChange
}: SidebarProps) {
    const [isSourcesOpen, setIsSourcesOpen] = useState(true);

    // TV State
    // const [tvChannels, setTvChannels] = useState<TvChannel[]>([]);
    const [groupedChannels, setGroupedChannels] = useState<Record<string, TvChannel[]>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [tvSearch, setTvSearch] = useState('');

    // 加载电视频道
    useEffect(() => {
        if (activeModule === 'tv' && selectedTvSourceId) {
            loadTvChannels(selectedTvSourceId);
        }
    }, [activeModule, selectedTvSourceId, tvRefreshKey]);

    const loadTvChannels = async (sourceId: number) => {
        try {
            const res = await apiGet<TvChannel[]>(`/tv/playlist/${sourceId}`);
            if (res.success && res.data) {
                // setTvChannels(res.data);
                // Group channels
                const groups: Record<string, TvChannel[]> = {};
                res.data.forEach(ch => {
                    const g = ch.group || '其他';
                    if (!groups[g]) groups[g] = [];
                    groups[g].push(ch);
                });
                setGroupedChannels(groups);
                // Default expand all or some? expanded '央视' and '卫视' maybe?
                const initExpanded: Record<string, boolean> = {};
                Object.keys(groups).forEach(g => {
                    if (g.includes('央视') || g.includes('卫视') || g.includes('CCTV')) initExpanded[g] = true;
                });
                setExpandedGroups(initExpanded);
            }
        } catch (e) {
            console.error('Failed to load TV channels', e);
        }
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const isActive = (id: string) => {
        if (id === 'home' && activeView === 'home') return true;
        if (id.startsWith('source-')) {
            const sid = parseInt(id.split('-')[1]);
            return sid === selectedSourceId && activeView !== 'category';
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
                        <i className={`fas ${activeModule === 'tv' ? 'fa-tv' : 'fa-play-circle'} text-blue-500`}></i>
                        {activeModule === 'tv' ? '电视直播' : '视频中心'}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {activeModule === 'tv'
                            ? (tvSources.find(s => s.id === selectedTvSourceId)?.name || '直播源')
                            : (sources.find(s => s.id === selectedSourceId)?.name || '多源视频聚合')
                        }
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

    const renderLiveSidebar = () => {
        const platforms = [
            { key: 'all', label: '全部直播', icon: 'fas fa-broadcast-tower' },
            { key: 'bilibili', label: 'B站', icon: 'fab fa-lg fa-product-hunt' }, // Roughly matches B站 icon or use generic
            { key: 'douyu', label: '斗鱼', icon: 'fas fa-fish' },
            { key: 'huya', label: '虎牙', icon: 'fas fa-tiger' },
            { key: 'douyin', label: '抖音', icon: 'fab fa-tiktok' },
            { key: 'youtube', label: 'YouTube', icon: 'fab fa-youtube' },
        ];

        return (
            <div className="w-full space-y-1 mt-2">
                {!collapsed && <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">平台</div>}
                {platforms.map(p => (
                    <SidebarItem
                        key={p.key}
                        icon={p.icon}
                        label={p.label}
                        isActive={navParams.platform === p.key || (!navParams.platform && p.key === 'all')}
                        onClick={() => {
                            onNavigate('live', { platform: p.key });
                            if (isMobile && onCloseMobile) onCloseMobile();
                        }}
                        activeColor="text-blue-400"
                        collapsed={collapsed}
                    />
                ))}
            </div>
        );
    };

    const renderVideoSidebar = () => (
        <>
            {/* 首页 (桌面端) */}
            {!isMobile && (
                <SidebarItem
                    icon="fas fa-home"
                    label="首页"
                    isActive={isActive('home')}
                    onClick={() => handleNavigate('home')}
                    collapsed={collapsed}
                />
            )}

            {/* 视频源 (折叠组) */}
            <div className="w-full mt-2">
                {!collapsed ? (
                    <div
                        className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white hover:bg-white/5 transition-colors"
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
                                icon="fas fa-server"
                                label={source.name}
                                isActive={source.id === selectedSourceId}
                                onClick={() => {
                                    onSourceChange(source.id);
                                    // 触发后台异步同步分类（不阻塞UI）
                                    apiPost(`/sources/${source.id}/background-sync`).catch(() => { });
                                    if (onCloseMobile) onCloseMobile();
                                }}
                                activeColor="text-blue-400"
                                collapsed={collapsed}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    const renderTvSidebar = () => {
        // 源选择器
        const sourceSelector = !collapsed && (
            <div className="px-3 mb-2">
                <select
                    className="w-full bg-gray-800 text-gray-300 text-xs rounded border border-gray-700 p-1 focus:outline-none focus:border-blue-500"
                    value={selectedTvSourceId || ''}
                    onChange={(e) => onTvSourceChange?.(parseInt(e.target.value))}
                >
                    {tvSources.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
        );

        // 搜索框
        const searchBox = !collapsed && (
            <div className="px-3 mb-2">
                <div className="relative">
                    <input
                        type="text"
                        className="w-full bg-gray-800 text-gray-200 text-xs rounded-full border border-gray-700 py-1.5 pl-8 pr-3 focus:outline-none focus:border-blue-500"
                        placeholder="搜索频道..."
                        value={tvSearch}
                        onChange={(e) => setTvSearch(e.target.value)}
                    />
                    <i className="fas fa-search absolute left-3 top-2 text-gray-500 text-xs"></i>
                </div>
            </div>
        );

        // 过滤频道
        let displayGroups: Record<string, TvChannel[]> = groupedChannels;
        if (tvSearch) {
            displayGroups = {};
            Object.entries(groupedChannels).forEach(([group, channels]) => {
                const filtered = channels.filter(ch => ch.name.toLowerCase().includes(tvSearch.toLowerCase()));
                if (filtered.length > 0) {
                    displayGroups[group] = filtered;
                }
            });
        }

        // 确保搜索时自动展开有结果的组
        const currentExpanded: Record<string, boolean> = tvSearch ?
            Object.keys(displayGroups).reduce((acc: Record<string, boolean>, g) => ({ ...acc, [g]: true }), {})
            : expandedGroups;

        return (
            <div className="flex flex-col h-full">
                {sourceSelector}
                {searchBox}

                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1">
                    {Object.entries(displayGroups).map(([group, channels]) => (
                        <div key={group}>
                            {!collapsed ? (
                                <>
                                    <div
                                        className="flex items-center px-2 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                                        onClick={() => toggleGroup(group)}
                                    >
                                        <i className={`fas fa-caret-right mr-1.5 transition-transform ${currentExpanded[group] ? 'rotate-90' : ''}`}></i>
                                        {group}
                                        <span className="ml-auto text-[10px] opacity-50">{channels.length}</span>
                                    </div>
                                    {currentExpanded[group] && (
                                        <div className="space-y-0.5 ml-1">
                                            {channels.map((ch, idx) => (
                                                <div
                                                    key={`${idx}-${ch.name}`}
                                                    className={`px-3 py-1.5 rounded text-sm cursor-pointer truncate flex items-center transition-colors ${ch.url === currentChannelUrl
                                                        ? 'bg-gray-800 text-blue-400 border-l-[3px] border-blue-500'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                                                        }`}
                                                    onClick={() => {
                                                        onPlayChannel?.(ch);
                                                        if (isMobile && onCloseMobile) onCloseMobile();
                                                    }}
                                                >
                                                    {ch.logo && <img src={ch.logo} className="w-4 h-4 mr-2 object-contain bg-white/10 rounded-sm" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />}
                                                    <span className="truncate">{ch.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Collapsed view (just icons or skipped)
                                <div className="flex justify-center py-2 relative group" title={group}>
                                    <span className="text-[10px] text-gray-500 font-mono border border-gray-700 rounded px-1">{group.substring(0, 2)}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-950 text-gray-300 select-none pb-safe">
            {renderHeader()}

            <div className={`flex-1 w-full min-w-full sidebar-scrollbar scrollbar-overlay space-y-0.5 ${collapsed ? 'py-4' : 'py-2'}`}>
                {/* 移动端导航菜单 */}
                {isMobile && onModuleChange && (
                    <div className="px-2 pb-3 mb-2 border-b border-gray-800">
                        <div className="text-xs text-gray-500 px-2 mb-2">导航</div>
                        {[
                            { key: 'home', label: '首页', icon: 'fa-home' },
                            { key: 'sources', label: '资源站', icon: 'fa-database' },
                            { key: 'tv', label: '电视', icon: 'fa-tv' },
                            { key: 'live', label: '直播', icon: 'fa-broadcast-tower' },
                            { key: 'netdisk', label: '网盘', icon: 'fa-cloud' },
                        ].map(item => (
                            <button
                                key={item.key}
                                onClick={() => {
                                    onModuleChange(item.key as AppModule);
                                    if (onCloseMobile) onCloseMobile();
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                    ${activeModule === item.key
                                        ? 'bg-red-500 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <i className={`fas ${item.icon} w-5 text-center`}></i>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {activeModule === 'tv' ? renderTvSidebar() : (activeModule === 'live' ? renderLiveSidebar() : renderVideoSidebar())}
            </div>

            {/* 底部功能按钮 */}
            <div className="p-3 border-t border-gray-800 space-y-1">

                {!isMobile && onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        className={`
                            flex items-center w-full px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-colors
                            ${collapsed ? 'justify-center' : 'justify-start'}
                        `}
                        title={collapsed ? "展开" : "收起"}
                    >
                        <i className={`fas fa-angle-double-${collapsed ? 'right' : 'left'} w-4 text-center`}></i>
                        {!collapsed && <span className="ml-2">收起侧边栏</span>}
                    </button>
                )}
            </div>
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
                    : 'hover:bg-white/5 border-l-[3px] border-transparent text-gray-400 hover:text-gray-200'
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
