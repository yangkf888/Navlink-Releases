/**
 * 网盘媒体库页面
 * 三级视图结构：
 * 1. 全部网盘视图（类似 SourceOverview）：各网盘源作为板块，每板块显示部分媒体 + "更多"
 * 2. 网盘源视图（类似 Category 子分类概览）：扫描目录作为板块，22个媒体+1个加载更多卡片，点击扩展
 * 3. 扫描目录视图（类似 Category 列表）：显示该目录下的全部媒体，支持无限滚动
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { NetdiskSource } from '../types';
import { apiGet, apiPost } from '../utils/api';
import { NetdiskFilter } from '../components/NetdiskFilter';

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
    const [activeFilters, setActiveFilters] = useState<{ genres?: string; year?: number; area?: string }>({});
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
        if (currentLevel === 'all' && sources.length > 0) {
            loadAllSourcesSections();
        } else if (currentLevel === 'source' && currentSourceId) {
            loadDirectorySections(currentSourceId, activeFilters);
            pollScanStatus(currentSourceId);
        } else if (currentLevel === 'directory' && currentSourceId && currentPath) {
            loadMediaByPath(currentSourceId, currentPath, 1, true);
            pollScanStatus(currentSourceId);
        }
    }, [currentLevel, currentSourceId, currentPath, sources]);

    // 无限滚动监听（仅三级视图）
    useEffect(() => {
        if (currentLevel !== 'directory' || !hasMore || loadingMore) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    loadMoreMedia();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [currentLevel, hasMore, loadingMore, page]);

    const loadSources = async () => {
        try {
            const res = await apiGet<NetdiskSource[]>('/netdisk/sources');
            if (res.success && res.data) {
                setSources(res.data.filter(s => s.enabled));
            }
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
                const res = await apiGet<MediaItem[]>(`/netdisk/media?sourceId=${source.id}&limit=${SOURCE_PREVIEW_COUNT}`);
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
    const loadDirectorySections = async (srcId: number, filters?: { genres?: string; year?: number; area?: string }) => {
        setLoading(true);
        try {
            // 构建查询参数
            let url = `/netdisk/media/grouped?sourceId=${srcId}&limit=${INITIAL_COUNT}`;
            if (filters?.genres) url += `&genres=${encodeURIComponent(filters.genres)}`;
            if (filters?.year) url += `&year=${filters.year}`;
            if (filters?.area) url += `&area=${encodeURIComponent(filters.area)}`;

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

    const handlePlay = async (item: MediaItem, videoIndex: number = 0) => {
        try {
            const res = await apiPost<{ playUrl: string; fileName: string }>(`/netdisk/media/${item.id}/play`, { videoIndex });
            if (res.success && res.data?.playUrl) {
                if (onPlay) {
                    onPlay(item.id, item.source_id, videoIndex);
                }
            }
        } catch (err) {
            console.error('Failed to get play URL:', err);
        }
    };

    // 导航到二级视图（网盘源）
    const navigateToSource = (srcId: number) => {
        setCurrentLevel('source');
        setCurrentSourceId(srcId);
        setCurrentPath(null);
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

    // 渲染媒体卡片
    const renderMediaCard = (item: MediaItem) => (
        <div
            key={item.id}
            onClick={() => handlePlay(item)}
            className="group cursor-pointer"
        >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
                {item.poster_url ? (
                    <img
                        src={item.poster_url.startsWith('http') ? `/api/plugins/video/api/proxy/image?url=${encodeURIComponent(item.poster_url)}` : item.poster_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
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

                {(!item.poster_url || item.poster_url) && (
                    <div className="poster-fallback w-full h-full flex flex-col items-center justify-center p-4" style={{ display: item.poster_url ? 'none' : 'flex' }}>
                        <i className={`fas ${item.media_type === 'tvshow' ? 'fa-tv text-purple-400' : 'fa-film text-blue-400'} text-5xl mb-3`}></i>
                        <p className="text-gray-400 text-sm text-center line-clamp-3">{item.title}</p>
                    </div>
                )}

                {/* 悬停播放按钮 */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <i className="fas fa-play text-white text-xl ml-1"></i>
                    </div>
                </div>

                {/* 类型标签 */}
                <div className={`absolute top-2 left-2 rounded px-2 py-0.5 text-xs text-white font-bold ${item.media_type === 'tvshow' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                    {item.media_type === 'tvshow' ? '剧集' : '电影'}
                </div>

                {/* 评分 */}
                {item.rating && item.rating > 0 && (
                    <div className="absolute top-2 right-2 bg-yellow-500 rounded px-2 py-0.5 text-xs text-black font-bold flex items-center gap-1">
                        <i className="fas fa-star text-[10px]"></i>
                        {item.rating.toFixed(1)}
                    </div>
                )}

                {/* 年份 */}
                {item.year && (
                    <div className="absolute bottom-2 left-2 bg-black/70 rounded px-2 py-0.5 text-xs text-gray-300">
                        {item.year}
                    </div>
                )}
            </div>

            {/* 标题 */}
            <div className="mt-2 px-1">
                <p className="text-sm text-gray-200 font-medium truncate" title={item.title}>
                    {item.title}
                </p>
                {item.video_files.length > 1 && (
                    <p className="text-xs text-gray-500">{item.video_files.length} 个视频</p>
                )}
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
                <p className="text-lg">暂无网盘源</p>
                <p className="text-sm mt-2">请到后台管理添加网盘源</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 animate-pulse space-y-8">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-6 bg-gray-800 rounded w-32"></div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
        <div className="flex flex-col h-full bg-gray-900">
            {/* 顶部工具栏 */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800 bg-gray-950 flex-wrap">
                {/* 当前位置标题 */}
                <span className="text-white font-medium">
                    {currentLevel === 'all'
                        ? '全部网盘'
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
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-8">
                {currentLevel === 'all' ? (
                    /* 一级视图：全部网盘（类似 SourceOverview） */
                    sourceSections.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <i className="fas fa-film text-4xl mb-4 opacity-50"></i>
                            <p>暂无媒体内容</p>
                            <p className="text-sm mt-2">请先在后台扫描网盘媒体库</p>
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                            <p className="text-sm mt-2">请先在后台扫描此网盘源的媒体库</p>
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
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            <i className="fas fa-folder text-yellow-400"></i>
                                            {section.name}
                                            <span className="text-sm text-gray-500 font-normal">
                                                ({section.items.length}{section.hasMore ? '+' : ''})
                                            </span>
                                        </h2>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {media.map(item => renderMediaCard(item))}
                                </div>

                                {/* 无限滚动加载触发器 */}
                                <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
                                    {loadingMore && (
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <i className="fas fa-spinner animate-spin"></i>
                                            <span>加载更多...</span>
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
        </div>
    );
}
