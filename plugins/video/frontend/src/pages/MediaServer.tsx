import { useState, useEffect, useRef } from 'react';
import { apiGet } from '../utils/api';
import { useAppNavigate } from '../contexts/NavigationContext';

interface MediaServerProps {
    serverId?: number;
    categoryId?: string;
    categoryName?: string;
    theme?: 'light' | 'dark';
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

interface MediaItem {
    Id: string;
    Name: string;
    Type: string;
    ImageTags: {
        Primary: string;
        Thumb?: string;
    };
    ProductionYear?: number;
    Overview?: string;
    MediaType?: string;
    Container?: string;
    CommunityRating?: number;
    RunTimeTicks?: number;
    UserData?: {
        PlayedPercentage?: number;
    };
    SeriesName?: string;
    IndexNumber?: number;
}

interface HomeSection {
    title: string;
    id: string;
    type: string;
    items: MediaItem[];
}

/**
 * 🎬 Emby 首页动态视图组件
 * 核心：不再死板，Emby 首页有什么板块，这里同步拉取并展示什么板块
 */
function MediaServerHomeView({ server, onPlay, onNavigate }: { server: any, onPlay: (item: any) => void, onNavigate: (view: string, params?: any) => void }) {
    const [resumeItems, setResumeItems] = useState<MediaItem[]>([]);
    const [sections, setSections] = useState<HomeSection[]>([]);
    const [loading, setLoading] = useState(true);

    // 🎨 引用控制：用于横向滚动
    const resumeScrollRef = useRef<HTMLDivElement>(null);
    const sectionsScrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleScroll = (ref: React.RefObject<HTMLDivElement> | HTMLDivElement | null, direction: 'left' | 'right') => {
        const el = (ref && 'current' in ref) ? ref.current : ref;
        if (el) {
            el.scrollBy({ left: direction === 'right' ? 600 : -600, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (server) {
            loadHomeData();
        }
    }, [server]);

    const loadHomeData = async () => {
        setLoading(true);
        try {
            // 1. 获取动态聚合首页数据
            const homeRes = await apiGet<{ resume: MediaItem[], sections: HomeSection[] }>(`/media-servers/${server.id}/home`);
            if (homeRes.success && homeRes.data) {
                setResumeItems(homeRes.data.resume || []);
                setSections(homeRes.data.sections || []);
            }
        } catch (error) {
            console.error('Failed to load dynamic home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPosterUrl = (item: any, type: 'Primary' | 'Thumb' = 'Primary', width = 300) => {
        const tag = type === 'Thumb' ? (item.ImageTags?.Thumb || item.ImageTags?.Primary) : item.ImageTags?.Primary;
        if (!tag || !server) return '';
        return `${server.url}/emby/Items/${item.Id}/Images/${type}?maxWidth=${width}&tag=${tag}&api_key=${server.api_key}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[2000px] mx-auto">
            {/* 2. 继续观看 (横海报) */}
            {resumeItems.length > 0 && (
                <section className="space-y-4">
                    <h3 className="text-xl font-black text-primary flex items-center gap-2">
                        <i className="fas fa-history text-blue-500"></i>
                        继续观看
                    </h3>
                    <div className="relative group/scroll">
                        <div ref={resumeScrollRef} className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar scroll-smooth">
                            {resumeItems.map(item => (
                                <div key={item.Id} className="flex-shrink-0 w-[280px] group cursor-pointer" onClick={() => onPlay(item)}>
                                    <div className="aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg relative">
                                        <img src={getPosterUrl(item, 'Thumb', 400)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        {item.UserData?.PlayedPercentage !== undefined && (
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                                <div className="h-full bg-blue-500" style={{ width: `${item.UserData.PlayedPercentage}%` }}></div>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                            <p className="text-white text-xs font-bold truncate">{item.SeriesName || item.Name}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* 向右引导按钮 - 功能化升级，修复点击穿透 */}
                        <div className="absolute top-0 right-0 bottom-4 w-24 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10 opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300"></div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleScroll(resumeScrollRef, 'right');
                            }}
                            className="absolute top-1/2 right-4 -translate-y-1/2 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-500/40 border border-white/20 flex items-center justify-center text-white z-20 opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 scale-75 group-hover/scroll:scale-100 active:scale-90"
                        >
                            <i className="fas fa-chevron-right text-lg"></i>
                        </button>
                    </div>
                </section>
            )}

            {/* 3. 动态 Section 列表 (同步 Emby 排序) */}
            {sections.map(section => (
                <section key={section.id} className="space-y-4">
                    <h3
                        className="text-xl font-black text-primary flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors group/title w-fit"
                        onClick={() => onNavigate('media_server', {
                            serverId: server.id,
                            categoryId: section.id,
                            _t: Date.now()
                        })}
                    >
                        <i className={`fas ${section.type === 'tvshows' ? 'fa-tv' : 'fa-film'} opacity-50 text-sm`}></i>
                        最新{section.title}
                        <i className="fas fa-chevron-right text-xs opacity-0 group-hover/title:opacity-100 transition-opacity"></i>
                    </h3>
                    <div className="relative group/scroll">
                        <div
                            ref={el => sectionsScrollRefs.current[section.id] = el}
                            className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar scroll-smooth"
                        >
                            {section.items.map(item => (
                                <div
                                    key={item.Id}
                                    className={`flex-shrink-0 group cursor-pointer ${section.type === 'movies' || section.type === 'tvshows' ? 'w-[160px]' : 'w-[240px]'}`}
                                    onClick={() => onPlay(item)}
                                >
                                    <div className={`${section.type === 'movies' || section.type === 'tvshows' ? 'aspect-[2/3]' : 'aspect-video'} rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg relative`}>
                                        <img
                                            src={getPosterUrl(item, (section.type === 'movies' || section.type === 'tvshows') ? 'Primary' : 'Thumb')}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                            <p className="text-white text-[10px] font-bold truncate">{item.Name}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-xs font-bold text-primary truncate group-hover:text-blue-500 transition-colors">{item.Name}</p>
                                        <p className="text-[10px] text-secondary opacity-50">{item.ProductionYear || ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* 向右引导按钮 - 功能化升级，修复点击穿透 */}
                        <div className="absolute top-0 right-0 bottom-4 w-24 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10 opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300"></div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleScroll(sectionsScrollRefs.current[section.id], 'right');
                            }}
                            className="absolute top-1/2 right-4 -translate-y-1/2 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-500/40 border border-white/20 flex items-center justify-center text-white z-20 opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 scale-75 group-hover/scroll:scale-100 active:scale-90"
                        >
                            <i className="fas fa-chevron-right text-lg"></i>
                        </button>
                    </div>
                </section>
            ))}

            {!loading && resumeItems.length === 0 && sections.length === 0 && (
                <div className="py-20 text-center opacity-20">
                    <i className="fas fa-ghost text-6xl mb-4"></i>
                    <p>Emby 首页暂无内容同步</p>
                </div>
            )}
        </div>
    );
}

export function MediaServer({ serverId, categoryId, categoryName, theme = 'dark' }: MediaServerProps) {
    const onNavigate = useAppNavigate();

    console.info(`[MediaServer] Active. Server: ${serverId}, Library: ${categoryId}`);

    const [loading, setLoading] = useState(false);
    const [server, setServer] = useState<any>(null);
    const [items, setItems] = useState<MediaItem[]>([]);

    // 🎨 增强状态：排序与视图
    const [sortBy, setSortBy] = useState('DateCreated,SortName'); // 默认按加入日期排序
    const [sortOrder, setSortOrder] = useState('Descending'); // 默认降序（最新在前）
    const [viewType, setViewType] = useState<'poster' | 'list'>('poster');
    const [showSortMenu, setShowSortMenu] = useState(false);

    useEffect(() => {
        if (serverId) {
            loadServerData();
        }
    }, [serverId]);

    useEffect(() => {
        if (serverId && categoryId) {
            loadItems(categoryId);
        } else {
            setItems([]);
        }
    }, [serverId, categoryId, sortBy, sortOrder]); // 监听排序变化

    const loadServerData = async () => {
        try {
            const serversRes = await apiGet<any[]>('/media-servers');
            if (serversRes.success && serversRes.data) {
                const s = serversRes.data.find(item => item.id === serverId);
                setServer(s);
            }
        } catch (error) {
            console.error('Failed to load server data:', error);
        }
    };

    const loadItems = async (libraryId: string) => {
        try {
            setLoading(true);
            console.log(`[MediaServer] Loading items with SortBy: ${sortBy}, SortOrder: ${sortOrder}`);
            const res = await apiGet<any>(`/media-servers/${serverId}/items`, {
                parentId: libraryId,
                sortBy,
                sortOrder
            });
            if (res.success && res.data) {
                setItems(res.data.Items || []);
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (item: MediaItem) => {
        try {
            const res = await apiGet<any>(`/media-servers/${serverId}/playback/${item.Id}`);
            if (res.success && res.data.streamUrl) {
                onNavigate('media_server_play', {
                    mediaServerId: serverId,
                    vodId: item.Id,
                    title: item.Name,
                    url: res.data.streamUrl,
                    cover: getPosterUrl(item)
                });
            } else {
                alert(res.error || '获取播放地址失败');
            }
        } catch (error) {
            console.error('Failed to get playback info:', error);
        }
    };

    const getPosterUrl = (item: MediaItem) => {
        if (!item.ImageTags?.Primary || !server) return '';
        return `${server.url}/emby/Items/${item.Id}/Images/Primary?maxWidth=300&tag=${item.ImageTags.Primary}&api_key=${server.api_key}`;
    };

    const formatRuntime = (ticks: number) => {
        if (!ticks) return '';
        const minutes = Math.floor(ticks / 600000000);
        return `${minutes} 分钟`;
    };

    if (!serverId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-secondary">
                <i className="fas fa-film text-6xl opacity-10 mb-4"></i>
                <p>请在左侧选择一个影视库</p>
            </div>
        );
    }

    const sortOptions = [
        { label: '加入日期', value: 'DateCreated,SortName' },
        { label: '上映日期', value: 'PremiereDate,SortName' },
        { label: 'IMDb 评分', value: 'CommunityRating,SortName' },
        { label: '分辨率', value: 'VideoBitDepth,Width,SortName' },
        { label: '添加日期', value: 'DateCreated,SortName' },
        { label: '媒体容器', value: 'Container,SortName' },
        { label: '家长评分', value: 'OfficialRating,SortName' },
        { label: '导演', value: 'Director,SortName' },
        { label: '帧率', value: 'VideoFrameRate,SortName' },
        { label: '年份', value: 'ProductionYear,SortName' },
        { label: '影评人评分', value: 'CriticRating,SortName' },
        { label: '播放日期', value: 'DatePlayed,SortName' },
        { label: '播放时长', value: 'Runtime,SortName' },
        { label: '播放次数', value: 'PlayCount,SortName' },
        { label: '文件名', value: 'Path,SortName' },
        { label: '文件尺寸', value: 'Size,SortName' },
        { label: '标题', value: 'SortName' },
        { label: '比特率', value: 'TotalBitrate,SortName' },
    ];

    return (
        <div className="p-6 space-y-6">
            {!categoryId ? (
                <MediaServerHomeView server={server} onPlay={handlePlay} onNavigate={onNavigate} />
            ) : (
                <>
                    {/* 🛠 顶部增强工具栏 */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => onNavigate('media_server', { serverId })}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-secondary hover:bg-white/10 hover:text-primary transition-all group"
                                title="返回首页"
                            >
                                <i className="fas fa-chevron-left text-sm group-hover:-translate-x-0.5 transition-transform"></i>
                            </button>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-primary truncate tracking-tight">
                                    {categoryName || server?.name || '影视库'}
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end">
                            {/* 🏆 高级排序菜单 (Emby 原生级复刻，响应式设计) */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm text-secondary transition-all shadow-md active:scale-95 ${theme === 'dark' ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-white border border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <i className="fas fa-filter text-blue-500 text-xs"></i>
                                    <span className="max-w-[80px] truncate font-medium">{sortOptions.find(o => o.value === sortBy)?.label || '排序'}</span>
                                    <i className={`fas fa-chevron-down text-[10px] opacity-40 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}></i>
                                </button>

                                {showSortMenu && (
                                    <>
                                        {/* 背景遮罩 - 仅在移动端显示 */}
                                        <div className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${theme === 'dark' ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/20'}`} onClick={() => setShowSortMenu(false)}></div>
                                        {/* 桌面端透明点击层 */}
                                        <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setShowSortMenu(false)}></div>

                                        {/* 桌面端下拉 & 移动端抽屉 */}
                                        <div className={`
                                            fixed md:absolute z-50 overflow-hidden shadow-2xl transition-all duration-300
                                            left-0 right-0 bottom-0 top-auto rounded-t-3xl md:h-auto max-h-[85vh]
                                            md:left-auto md:right-0 md:bottom-auto md:top-full md:mt-2 md:w-56 md:rounded-2xl md:translate-y-0
                                            flex flex-col
                                            ${theme === 'dark' ? 'bg-secondary border-t md:border border-white/10' : 'bg-white border-t md:border border-gray-100'}
                                            ${showSortMenu ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:opacity-100'}
                                        `}>
                                            {/* 移动端顶部把手 */}
                                            <div className="md:hidden flex justify-center py-3">
                                                <div className="w-12 h-1.5 bg-secondary/20 rounded-full"></div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                                <div className="px-4 py-3 text-[10px] font-black text-secondary tracking-widest uppercase opacity-40 flex items-center justify-between">
                                                    <span>排序字段</span>
                                                    <span className="md:hidden text-[9px] font-normal italic">选择一个维度以刷新</span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {sortOptions.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            className={`w-full text-left px-4 py-3 md:py-2.5 text-sm rounded-xl transition-all flex items-center justify-between group/opt ${sortBy === opt.value ? 'active-brand-item shadow-blue-500/20' : `text-secondary hover:text-primary ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}`}
                                                            onClick={() => {
                                                                setSortBy(opt.value);
                                                                setShowSortMenu(false);
                                                            }}
                                                        >
                                                            <span className="truncate">{opt.label}</span>
                                                            {sortBy === opt.value ? (
                                                                <i className="fas fa-check text-[10px]"></i>
                                                            ) : (
                                                                <i className="fas fa-chevron-right text-[10px] opacity-0 group-hover/opt:opacity-40 -translate-x-2 group-hover/opt:translate-x-0 transition-all"></i>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className={`p-3 md:p-2 border-t ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-50 bg-gray-50/50'}`}>
                                                <button
                                                    className={`w-full h-12 md:h-10 px-4 rounded-xl text-xs text-secondary hover:text-primary transition-all flex items-center justify-between ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-white'}`}
                                                    onClick={() => setSortOrder(sortOrder === 'Ascending' ? 'Descending' : 'Ascending')}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-transform active:scale-90 ${sortOrder === 'Ascending' ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500'}`}>
                                                            <i className={`fas ${sortOrder === 'Ascending' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up'} text-sm md:text-xs`}></i>
                                                        </div>
                                                        <span className="font-bold">{sortOrder === 'Ascending' ? '升序 (A-Z)' : '降序 (Z-A)'}</span>
                                                    </div>
                                                    <i className="fas fa-exchange-alt opacity-20 text-[10px] transform rotate-90 md:rotate-0"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 视图切换 */}
                            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                                <button
                                    className={`w-9 h-8 flex items-center justify-center rounded-lg transition-all ${viewType === 'poster' ? 'bg-blue-500 text-white' : 'text-secondary hover:text-primary'}`}
                                    onClick={() => setViewType('poster')}
                                    title="海报模式"
                                >
                                    <i className="fas fa-th-large text-sm"></i>
                                </button>
                                <button
                                    className={`w-9 h-8 flex items-center justify-center rounded-lg transition-all ${viewType === 'list' ? 'bg-blue-500 text-white' : 'text-secondary hover:text-primary'}`}
                                    onClick={() => setViewType('list')}
                                    title="列表模式"
                                >
                                    <i className="fas fa-list text-sm"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm text-secondary animate-pulse font-medium">正在深度同步 Emby 数据...</p>
                        </div>
                    ) : viewType === 'poster' ? (
                        /* 🖼 海报网格视图 */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-4 gap-y-6">
                            {items.map(item => (
                                <div key={item.Id} className="group relative cursor-pointer" onClick={() => handlePlay(item)}>
                                    <div className={`aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all active:scale-95 ${theme === 'dark' ? 'shadow-xl' : 'shadow-md border-gray-100'}`}>
                                        {item.ImageTags?.Primary ? (
                                            <img src={getPosterUrl(item)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-secondary opacity-20">
                                                <i className="fas fa-image text-4xl"></i>
                                            </div>
                                        )}
                                        {/* 评分角标 */}
                                        {item.CommunityRating && (
                                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-yellow-500 text-black text-[10px] font-black flex items-center gap-1 shadow-lg">
                                                <i className="fas fa-star text-[8px]"></i>
                                                {item.CommunityRating.toFixed(1)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3">
                                        <p className="text-sm font-bold text-primary truncate group-hover:text-blue-500 transition-colors">{item.Name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-secondary opacity-50 font-mono italic">{item.ProductionYear || 'N/A'}</span>
                                            {item.Type === 'Series' && <span className="text-[9px] px-1 bg-blue-500/10 text-blue-500 rounded font-bold uppercase scale-90 origin-left">剧集</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* 📋 列表详细视图 */
                        <div className="space-y-2">
                            {items.map(item => (
                                <div
                                    key={item.Id}
                                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5"
                                    onClick={() => handlePlay(item)}
                                >
                                    <div className="w-16 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                                        <img src={getPosterUrl(item)} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-primary truncate group-hover:text-blue-500 transition-colors">{item.Name}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-secondary opacity-60">
                                            <span className="font-mono">{item.ProductionYear || '未知年份'}</span>
                                            <span>•</span>
                                            <span>{item.Type === 'Series' ? '剧集' : '电影'}</span>
                                            {item.RunTimeTicks && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatRuntime(item.RunTimeTicks)}</span>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-xs text-secondary mt-2 line-clamp-1 opacity-40">{item.Overview || '暂无简介'}</p>
                                    </div>
                                    {item.CommunityRating && (
                                        <div className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-bold flex items-center gap-1.5">
                                            <i className="fas fa-star text-[10px]"></i>
                                            {item.CommunityRating.toFixed(1)}
                                        </div>
                                    )}
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-secondary opacity-0 group-hover:opacity-100 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <i className="fas fa-play text-xs ml-0.5"></i>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="py-32 text-center glass-effect rounded-[40px] border border-dashed border-border-color">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <i className="fas fa-inbox text-4xl opacity-10"></i>
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">空空如也</h3>
                            <p className="text-sm text-secondary opacity-40 max-w-xs mx-auto">Emby 此分类下暂无内容，或者同步出现了一点小问题</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default MediaServer;
