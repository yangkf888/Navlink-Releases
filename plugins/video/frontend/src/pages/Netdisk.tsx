/**
 * 网盘媒体库页面
 * 三级视图结构：
 * 1. 全部网盘视图（类似 SourceOverview）：各网盘源作为板块，每板块显示部分媒体 + "更多"
 * 2. 网盘源视图（类似 Category 子分类概览）：扫描目录作为板块，22个媒体+1个加载更多卡片，点击扩展
 * 3. 扫描目录视图（类似 Category 列表）：显示该目录下的全部媒体，支持无限滚动
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NetdiskSource } from '../types';
import { apiGet } from '../utils/api';
import { NetdiskFilter } from '../components/NetdiskFilter';
import { useAuth } from '../contexts/AuthContext';

interface MediaItem {
    id: number;
    source_id: number;
    path: string;
    title: string;
    original_title?: string;
    year?: number;
    overview?: string;
    poster_url?: string;
    fanart_url?: string;
    rating?: number;
    genres: string[];
    media_type: string;
    tmdb_id?: number;
    video_files: string[];
    nfo_parsed: number;
    actor?: string;
}

interface ScanStatus {
    scanning: boolean;
    progress: number;
    total: number;
    message?: string;
}

interface MediaGroup {
    name: string;
    path: string;
    items: MediaItem[];
    total: number;
}

// 网盘源板块数据（全部网盘视图用）
interface SourceSection {
    sourceId: number;
    sourceName: string;
    sourceType: string;
    items: MediaItem[];
    total: number;
}

// 扫描目录板块数据（支持分页扩展）
interface DirectorySection {
    path: string;
    name: string;
    items: MediaItem[];
    total: number;
    offset: number;
    hasMore: boolean;
    loading: boolean;
}

interface NetdiskProps {
    sourceId?: number;
    selectedPath?: string;
    onPlay?: (mediaId: number, sourceId: number, videoIndex?: number) => void;
}

// 每行显示的视频数量（6列布局）
const VIDEOS_PER_ROW = 6;
// 初始显示行数（4行，23个位置，22个视频+1个加载更多）
const INITIAL_ROWS = 4;
// 初始显示数量：4行 * 6 - 1 = 23（实际显示22个视频+1个加载更多卡片）
const INITIAL_COUNT = INITIAL_ROWS * VIDEOS_PER_ROW - 1;
// 每次加载更多的数量
const LOAD_MORE_COUNT = 12;
// 全部网盘视图每个网盘源显示的数量
const SOURCE_PREVIEW_COUNT = 6;

// 视图层级
type ViewLevel = 'all' | 'source' | 'directory';

export function Netdisk({ sourceId, selectedPath, onPlay }: NetdiskProps) {
    const [sources, setSources] = useState<NetdiskSource[]>([]);
    const [sourcesLoaded, setSourcesLoaded] = useState(false);
    const [sourceSections, setSourceSections] = useState<SourceSection[]>([]);
    const [directorySections, setDirectorySections] = useState<DirectorySection[]>([]);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // 当前视图层级
    const [currentLevel, setCurrentLevel] = useState<ViewLevel>('all');
    const [currentSourceId, setCurrentSourceId] = useState<number | null>(null);

    // 筛选状态
    const [activeFilters, setActiveFilters] = useState<{ genres?: string; year?: number; area?: string; actor?: string; studio?: string }>({});
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // 监听窗口大小变化及全局同步消息
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        // 监听同步消息
        const channel = new BroadcastChannel('video-plugin-sync');
        channel.onmessage = (event) => {
            if (event.data === 'sources-updated') {
                // 同步网盘源
                loadSources();
            }
        };

        return () => {
            window.removeEventListener('resize', handleResize);
            channel.close();
        };
    }, []);
    const [currentPath, setCurrentPath] = useState<string | null>(null);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);



    // 同步外部 props 到内部状态
    useEffect(() => {
        if (sourceId !== undefined) {
            if (selectedPath) {
                setCurrentLevel('directory');
                setCurrentSourceId(sourceId);
                setCurrentPath(selectedPath);
            } else {
                setCurrentLevel('source');
                setCurrentSourceId(sourceId);
                setCurrentPath(null);
            }
        } else {
            setCurrentLevel('all');
            setCurrentSourceId(null);
            setCurrentPath(null);
        }
    }, [sourceId, selectedPath]);

    // 加载网盘源
    useEffect(() => {
        loadSources();
    }, []);

    // 根据层级加载数据
    useEffect(() => {
        if (currentLevel === 'all' && sourcesLoaded && sources.length > 0) {
            loadAllSourcesSections();
        } else if (currentLevel === 'source' && currentSourceId) {
            loadDirectorySections(currentSourceId, activeFilters);
            pollScanStatus(currentSourceId);
        } else if (currentLevel === 'directory' && currentSourceId && currentPath) {
            loadMediaByPath(currentSourceId, currentPath, 1, true);
            pollScanStatus(currentSourceId);
        }
    }, [currentLevel, currentSourceId, currentPath, sources, sourcesLoaded, activeFilters]);


    const { isAuthenticated } = useAuth();
    const loadSources = async () => {
        try {
            const res = await apiGet<NetdiskSource[]>('/netdisk/sources');
            if (res.success && res.data) {
                setSources(res.data.filter(s => s.enabled && (isAuthenticated || !s.hidden)));
            }
            setSourcesLoaded(true);
        } catch (err) {
            console.error('Failed to load netdisk sources:', err);
        }
    };

    // 加载全部网盘源的板块数据（类似 SourceOverview）
    const loadAllSourcesSections = async () => {
        setLoading(true);
        try {
            const enabledSources = sources.filter(s => s.enabled);
            const promises = enabledSources.map(async (source) => {
                // 构建筛选参数
                let url = `/netdisk/media?sourceId=${source.id}&limit=${SOURCE_PREVIEW_COUNT}`;
                if (activeFilters.genres) url += `&genres=${encodeURIComponent(activeFilters.genres)}`;
                if (activeFilters.year) url += `&year=${activeFilters.year}`;
                if (activeFilters.area) url += `&area=${encodeURIComponent(activeFilters.area)}`;
                if (activeFilters.actor) url += `&actor=${encodeURIComponent(activeFilters.actor)}`;
                if (activeFilters.studio) url += `&studio=${encodeURIComponent(activeFilters.studio)}`;

                const res = await apiGet<MediaItem[]>(url);
                if (res.success && res.data && res.data.length > 0) {
                    return {
                        sourceId: source.id,
                        sourceName: source.name,
                        sourceType: source.type || 'alist',
                        items: res.data,
                        total: (res as any).total || res.data.length
                    } as SourceSection;
                }
                return null;
            });

            const results = await Promise.all(promises);
            const validSections = results.filter((s): s is SourceSection => s !== null);
            setSourceSections(validSections);
        } catch (err) {
            console.error('Failed to load all sources sections:', err);
        } finally {
            setLoading(false);
        }
    };

    // 加载网盘源的扫描目录板块（类似 Category 子分类概览）
    const loadDirectorySections = async (srcId: number, filters?: { genres?: string; year?: number; area?: string; actor?: string; studio?: string }) => {
        setLoading(true);
        try {
            // 构建查询参数
            let url = `/netdisk/media/grouped?sourceId=${srcId}&limit=${INITIAL_COUNT}`;
            if (filters?.genres) url += `&genres=${encodeURIComponent(filters.genres)}`;
            if (filters?.year) url += `&year=${filters.year}`;
            if (filters?.area) url += `&area=${encodeURIComponent(filters.area)}`;
            if (filters?.actor) url += `&actor=${encodeURIComponent(filters.actor)}`;
            if (filters?.studio) url += `&studio=${encodeURIComponent(filters.studio)}`;

            const res = await apiGet<{ groups: MediaGroup[] }>(url);
            if (res.success && res.data) {
                const sections: DirectorySection[] = res.data.groups.map(group => ({
                    path: group.path,
                    name: group.name,
                    items: group.items.slice(0, INITIAL_COUNT),
                    total: group.total,
                    offset: group.items.length,
                    hasMore: group.total > INITIAL_COUNT,
                    loading: false
                }));
                setDirectorySections(sections);
            }
        } catch (err) {
            console.error('Failed to load directory sections:', err);
        } finally {
            setLoading(false);
        }
    };

    // 扫描目录板块加载更多（原地扩展）
    const loadMoreForDirectory = async (path: string) => {
        if (!currentSourceId) return;

        // 标记该 section 为加载中
        setDirectorySections(prev => prev.map(s =>
            s.path === path ? { ...s, loading: true } : s
        ));

        const section = directorySections.find(s => s.path === path);
        if (!section) return;

        try {
            const res = await apiGet<MediaItem[]>(
                `/netdisk/media?sourceId=${currentSourceId}&path=${encodeURIComponent(path)}&type=all&limit=${LOAD_MORE_COUNT + 1}&offset=${section.offset}`
            );

            if (res.success && res.data) {
                const hasMore = res.data.length > LOAD_MORE_COUNT;
                const newItems = res.data.slice(0, LOAD_MORE_COUNT);

                setDirectorySections(prev => prev.map(s =>
                    s.path === path
                        ? {
                            ...s,
                            items: [...s.items, ...newItems],
                            offset: s.offset + newItems.length,
                            hasMore,
                            loading: false
                        }
                        : s
                ));
            }
        } catch (err) {
            console.error('Failed to load more for directory:', err);
            setDirectorySections(prev => prev.map(s =>
                s.path === path ? { ...s, loading: false } : s
            ));
        }
    };

    // 加载目录下的媒体（类似 Category 列表模式）
    const loadMediaByPath = async (srcId: number, path: string, pageNum: number, reset: boolean = false) => {
        if (reset) {
            setLoading(true);
            setMedia([]);
            setPage(1);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await apiGet<MediaItem[]>(`/netdisk/media?sourceId=${srcId}&path=${encodeURIComponent(path)}&type=all&limit=${PAGE_SIZE}&offset=${(pageNum - 1) * PAGE_SIZE}`);
            if (res.success && res.data) {
                if (reset) {
                    setMedia(res.data);
                } else {
                    setMedia(prev => [...prev, ...res.data!]);
                }
                setHasMore(res.data.length >= PAGE_SIZE);
                setPage(pageNum);
            }
        } catch (err) {
            console.error('Failed to load media:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMoreMedia = useCallback(() => {
        if (currentSourceId && currentPath && !loadingMore && hasMore) {
            loadMediaByPath(currentSourceId, currentPath, page + 1, false);
        }
    }, [currentSourceId, currentPath, page, loadingMore, hasMore]);

    // 使用 ref 追踪状态，避免 IntersectionObserver 频繁重建
    const stateRef = useRef({
        currentLevel,
        hasMore,
        loadingMore,
        loadMoreMedia: () => { }
    });

    // 更新状态 ref
    useEffect(() => {
        stateRef.current = { currentLevel, hasMore, loadingMore, loadMoreMedia };
    }, [currentLevel, hasMore, loadingMore, loadMoreMedia, media.length]);


    // 无限滚动监听（仅三级视图）
    useEffect(() => {
        if (currentLevel !== 'directory' || !hasMore) return;

        // 等待 sentinel 节点渲染完成
        if (!loadMoreRef.current) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                const state = stateRef.current;

                if (entry.isIntersecting && state.hasMore && !state.loadingMore) {
                    state.loadMoreMedia();
                }
            },
            {
                threshold: 0,
                rootMargin: '100px'
            }
        );

        observerRef.current.observe(loadMoreRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [currentLevel, hasMore, loadingMore, page, media.length]);


    const pollScanStatus = async (srcId: number) => {
        try {
            const res = await apiGet<ScanStatus>(`/netdisk/scan/${srcId}/status`);
            if (res.success && res.data) {
                setScanStatus(res.data);
                if (res.data.scanning) {
                    setTimeout(() => pollScanStatus(srcId), 2000);
                }
            }
        } catch (err) {
            console.error('Failed to get scan status:', err);
        }
    };

    const handlePlay = (item: MediaItem, videoIndex: number = 0) => {
        if (onPlay) {
            onPlay(item.id, item.source_id, videoIndex);
        }
    };

    // 导航到二级视图（网盘源）
    const navigateToSource = (srcId: number) => {
        setCurrentLevel('source');
        setCurrentSourceId(srcId);
        setCurrentPath(null);
    };

    // 导航到三级视图（具体目录）
    const navigateToDirectory = (srcId: number, path: string) => {
        setCurrentLevel('directory');
        setCurrentSourceId(srcId);
        setCurrentPath(path);
    };


    // 获取当前源名称
    const getCurrentSourceName = () => {
        if (!currentSourceId) return '';
        const source = sources.find(s => s.id === currentSourceId);
        return source?.name || '';
    };

    // 获取当前目录名称
    const getCurrentDirectoryName = () => {
        if (!currentPath) return '';
        const section = directorySections.find(s => s.path === currentPath);
        return section?.name || currentPath.split('/').filter(Boolean).pop() || '';
    };

    // 渲染媒体卡片 (统一样式：对齐视频站 VideoCard)
    const renderMediaCard = (item: MediaItem) => (
        <div
            key={item.id}
            onClick={() => handlePlay(item)}
            className="video-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
        >
            {/* 封面部分 */}
            <div className="relative">
                <div className="aspect-[2/3] overflow-hidden bg-gray-900">
                    {item.poster_url ? (
                        <img
                            src={item.poster_url.startsWith('http') ? `/api/plugins/video/api/proxy/image?url=${encodeURIComponent(item.poster_url)}` : item.poster_url}
                            alt={item.title}
                            className="video-cover w-full h-full object-cover"
                            loading="lazy"
                            onError={e => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                if (img.parentElement) {
                                    const fallback = img.parentElement.querySelector('.poster-fallback');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }
                            }}
                        />
                    ) : null}

                    {/* 降级文字封面 (暂无图片时显示) */}
                    <div className="poster-fallback w-full h-full flex flex-col items-center justify-center p-4 bg-gray-800"
                        style={{ display: item.poster_url ? 'none' : 'flex' }}>
                        <i className={`fas ${item.media_type === 'tvshow' ? 'fa-tv text-purple-400/60' : 'fa-film text-blue-400/60'} text-4xl mb-3`}></i>
                        <p className="text-gray-500 text-[11px] text-center line-clamp-3 px-2 leading-relaxed">{item.title}</p>
                    </div>
                </div>

                {/* 悬停遮罩 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                              transition-opacity flex items-center justify-center border-b-2 border-red-500">
                    <i className="fas fa-play-circle text-4xl text-white"></i>
                </div>

                {/* 评分 (右上角) */}
                {item.rating && item.rating > 0 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 
                                   text-[10px] text-yellow-400 rounded flex items-center gap-1 font-bold">
                        <i className="fas fa-star"></i>
                        {item.rating.toFixed(1)}
                    </span>
                )}

                {/* 年份/备注 (右下角) */}
                {item.year && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-red-500/90 
                                   text-[10px] text-white rounded font-medium">
                        {item.year}
                    </span>
                )}
            </div>

            {/* 信息部分 (底部) */}
            <div className="p-3">
                <h3 className="text-white text-sm font-medium truncate" title={item.title}>
                    {item.title}
                </h3>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-[11px] truncate flex-1 mr-2" title={item.actor}>
                        {item.actor ? item.actor.split(/[,，/\s]/)[0].trim() : (item.media_type === 'tvshow' ? '剧集系列' : '电影视频')}
                    </span>
                    {item.video_files.length > 1 && (
                        <span className="text-red-500/80 text-[10px] font-bold">
                            {item.video_files.length}P
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    // 渲染"加载更多"卡片
    const renderLoadMoreCard = (path: string, isLoading: boolean) => (
        <button
            key={`load-more-${path}`}
            onClick={() => loadMoreForDirectory(path)}
            disabled={isLoading}
            className="aspect-[2/3] bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 
                     hover:border-red-500 hover:bg-gray-800 transition-all duration-300
                     flex flex-col items-center justify-center gap-3 group
                     disabled:opacity-50 disabled:cursor-wait"
        >
            {isLoading ? (
                <>
                    <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                        <i className="fas fa-spinner fa-spin text-2xl text-red-400"></i>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">加载中...</span>
                </>
            ) : (
                <>
                    <div className="w-14 h-14 rounded-full bg-gray-700 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                        <i className="fas fa-plus text-2xl text-gray-400 group-hover:text-red-400 transition-colors"></i>
                    </div>
                    <span className="text-gray-400 group-hover:text-white text-sm font-medium transition-colors">
                        加载更多
                    </span>
                </>
            )}
        </button>
    );

    if (sources.length === 0 && !loading && currentLevel === 'all') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <i className="fas fa-cloud text-6xl mb-4 opacity-50"></i>
                <p className="text-lg">暂无媒体库</p>
                <p className="text-sm mt-2">请到后台管理添加媒体库</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 animate-pulse space-y-8">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-6 bg-gray-800 rounded w-32"></div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                            {[...Array(currentLevel === 'source' ? INITIAL_COUNT + 1 : 6)].map((_, j) => (
                                <div key={j} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gray-900">
            {/* 顶部工具栏 - 使用 sticky 定位以保持原本的顶部停留效果，或者直接随页面滚动 */}
            <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 border-b border-gray-800 bg-gray-950 flex-wrap">
                {/* 当前位置标题 */}
                <span className="text-white font-medium">
                    {currentLevel === 'all'
                        ? '全部媒体'
                        : currentLevel === 'source'
                            ? getCurrentSourceName()
                            : getCurrentDirectoryName()}
                </span>


                {/* 筛选组件（所有视图层级显示） */}
                {(currentSourceId || (sources.length > 0 && sources[0]?.id)) && (
                    <div className="flex-1">
                        <NetdiskFilter
                            sourceId={currentSourceId || sources[0]?.id}
                            onFilterChange={(filters) => {
                                setActiveFilters(filters);
                                // 根据当前视图层级重新加载数据
                                if (currentLevel === 'all') {
                                    loadAllSourcesSections();
                                } else if (currentLevel === 'source' && currentSourceId) {
                                    loadDirectorySections(currentSourceId, filters);
                                } else if (currentLevel === 'directory' && currentSourceId && currentPath) {
                                    loadMediaByPath(currentSourceId, currentPath, 1, true);
                                }
                            }}
                            isMobile={isMobile}
                        />
                    </div>
                )}

                {/* 扫描状态 */}
                {scanStatus?.scanning && (
                    <div className="flex items-center gap-2 text-sm text-blue-400 ml-auto">
                        <i className="fas fa-sync-alt animate-spin"></i>
                        <span>{scanStatus.message} ({scanStatus.progress}/{scanStatus.total})</span>
                    </div>
                )}
            </div>

            {/* 内容区域 */}
            <div className="p-4 lg:p-6 space-y-8">
                {currentLevel === 'all' ? (
                    /* 一级视图：全部网盘（类似 SourceOverview） */
                    sourceSections.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <i className="fas fa-film text-4xl mb-4 opacity-50"></i>
                            <p>暂无媒体内容</p>
                            <p className="text-sm mt-2">请先在后台扫描媒体库</p>
                        </div>
                    ) : (
                        sourceSections.map(section => (
                            <section key={section.sourceId}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <i className={`fas ${section.sourceType === 'local' ? 'fa-hdd text-green-400' : section.sourceType === 'webdav' ? 'fa-server text-orange-400' : 'fa-cloud text-blue-400'}`}></i>
                                        {section.sourceName}
                                        <span className="text-sm font-normal text-gray-500">({section.total})</span>
                                    </h2>
                                    <button
                                        onClick={() => navigateToSource(section.sourceId)}
                                        className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        更多
                                        <i className="fas fa-chevron-right text-xs"></i>
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                                    {section.items.slice(0, SOURCE_PREVIEW_COUNT).map(item => renderMediaCard(item))}
                                </div>
                            </section>
                        ))
                    )
                ) : currentLevel === 'source' ? (
                    /* 二级视图：网盘源的扫描目录（类似 Category 子分类概览） */
                    directorySections.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <i className="fas fa-folder-open text-4xl mb-4 opacity-50"></i>
                            <p>暂无媒体内容</p>
                            <p className="text-sm mt-2">请先在后台扫描此媒体库</p>
                        </div>
                    ) : (
                        <>
                            {/* 网盘源标题 */}
                            <div className="flex items-center gap-2">
                                <i className="fas fa-hdd text-blue-400"></i>
                                <h1 className="text-xl font-bold text-white">{getCurrentSourceName()}</h1>
                            </div>

                            {/* 扫描目录板块 */}
                            {directorySections.map(section => (
                                <section key={section.path}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2
                                            className="text-lg font-bold text-white flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors group"
                                            onClick={() => navigateToDirectory(currentSourceId!, section.path)}
                                        >
                                            <i className="fas fa-folder text-yellow-400 group-hover:scale-110 transition-transform"></i>
                                            {section.name}
                                            <span className="text-sm text-gray-500 font-normal">
                                                ({section.items.length}{section.hasMore ? '+' : ''})
                                            </span>
                                            <i className="fas fa-chevron-right text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-1"></i>
                                        </h2>
                                        {section.hasMore && (
                                            <button
                                                onClick={() => navigateToDirectory(currentSourceId!, section.path)}
                                                className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                                            >
                                                查看全部
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                                        {section.items.map(item => renderMediaCard(item))}
                                        {/* "加载更多"卡片 - 始终显示在最后位置 */}
                                        {section.hasMore && renderLoadMoreCard(section.path, section.loading)}
                                    </div>
                                </section>
                            ))}
                        </>
                    )
                ) : (
                    /* 三级视图：目录下的媒体列表（类似 Category 列表模式） */
                    <>
                        {/* 目录标题 */}
                        <div className="flex items-center gap-2">
                            <i className="fas fa-folder text-yellow-400"></i>
                            <h1 className="text-xl font-bold text-white">{getCurrentDirectoryName()}</h1>
                        </div>

                        {media.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <i className="fas fa-film text-4xl mb-4 opacity-50"></i>
                                <p>暂无媒体内容</p>
                                <p className="text-sm mt-2">此目录下还没有扫描到影视内容</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                                    {media.map(item => renderMediaCard(item))}
                                </div>

                                {/* 无限滚动加载触发器 */}
                                <div
                                    ref={loadMoreRef}
                                    className="h-16 flex items-center justify-center mt-4 cursor-pointer hover:bg-gray-800/30 rounded-lg transition-colors"
                                    onClick={() => {
                                        if (hasMore && !loadingMore) {
                                            loadMoreMedia();
                                        }
                                    }}
                                >
                                    {(loadingMore || hasMore) && (
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            {loadingMore ? (
                                                <>
                                                    <i className="fas fa-spinner animate-spin text-blue-400"></i>
                                                    <span>正在加载...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-arrow-down animate-bounce text-gray-500"></i>
                                                    <span>加载更多 (点击或滚动)</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {!hasMore && media.length > 0 && (
                                        <span className="text-gray-500 text-sm">已加载全部内容</span>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div >
    );
}
