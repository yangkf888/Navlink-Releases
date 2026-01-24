import { useState, useEffect, useRef } from 'react';
import { apiGet } from '../utils/api';

interface MediaServerPlayProps {
    mediaServerId: number;
    vodId: string;
    title: string;
    streamUrl: string;
    cover: string;
    onGoBack: () => void;
}

interface MediaItemDetail {
    Id: string;
    Name: string;
    OriginalTitle?: string;
    ProductionYear?: number;
    Overview?: string;
    CommunityRating?: number;
    OfficialRating?: number;
    RunTimeTicks?: number;
    Genres?: string[];
    Type: string;
    ImageTags: {
        Primary: string;
    };
    People?: Array<{ Name: string; Role: string; Type: string }>;
    Studios?: Array<{ Name: string }>;
}

interface SimilarItem {
    Id: string;
    Name: string;
    Type: string;
    ProductionYear?: number;
    ImageTags: {
        Primary: string;
    };
}

export function MediaServerPlay({ mediaServerId, vodId, title: initialTitle, streamUrl: initialStreamUrl, cover: initialCover, onGoBack }: MediaServerPlayProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const artRef = useRef<any>(null);

    // 状态管理
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [mediaDetail, setMediaDetail] = useState<MediaItemDetail | null>(null);
    const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
    const [similarLoading, setSimilarLoading] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    // 3. 🚀 关键：本地克隆播放参数，支持“点击推荐切换”
    const [currentVodId, setCurrentVodId] = useState(vodId);
    const [currentTitle, setCurrentTitle] = useState(initialTitle);
    const [currentPlayUrl, setCurrentPlayUrl] = useState(initialStreamUrl);
    const [currentCover, setCurrentCover] = useState(initialCover);

    // 1. 统一初始化逻辑：加载媒体详情 & 相似内容 & 收藏状态 & 启动播放器
    useEffect(() => {
        let isMounted = true;

        const bootstrap = async () => {
            setLoading(true);
            setDetailLoading(true);
            setLoadError(null);

            try {
                // 并行获取详情、相似内容和收藏状态
                const [detailRes, similarRes] = await Promise.all([
                    apiGet<MediaItemDetail>(`/media-servers/${mediaServerId}/items/${currentVodId}`),
                    apiGet<SimilarItem[]>(`/media-servers/${mediaServerId}/items/${currentVodId}/similar`),
                    checkFavoriteStatus(currentVodId)
                ]);

                if (!isMounted) return;

                if (detailRes.success && detailRes.data) setMediaDetail(detailRes.data);
                if (similarRes.success && similarRes.data) setSimilarItems(similarRes.data);

                // 🚀 核心关键：检查并获取播放地址
                let targetUrl = currentPlayUrl;
                if (!targetUrl) {
                    const playRes = await apiGet<any>(`/media-servers/${mediaServerId}/playback/${currentVodId}`);
                    if (playRes.success && playRes.data.streamUrl) {
                        targetUrl = playRes.data.streamUrl;
                        setCurrentPlayUrl(targetUrl);
                    } else {
                        throw new Error(playRes.error || '无法解析播放地址');
                    }
                }

                // 启动播放器内核
                if (isMounted) await initPlayer(targetUrl);

            } catch (err: any) {
                if (isMounted) {
                    setLoadError(err.message);
                    setLoading(false);
                }
            } finally {
                if (isMounted) setDetailLoading(false);
            }
        };

        bootstrap();

        return () => {
            isMounted = false;
            if (artRef.current) {
                artRef.current.destroy(true);
                artRef.current = null;
            }
        };
    }, [mediaServerId, currentVodId]);

    const checkFavoriteStatus = async (id: string) => {
        try {
            const res = await apiGet<{ isFavorite: boolean }>('/favorites/check', {
                source_id: mediaServerId,
                vod_id: id,
                source_type: 'media_server'
            });
            if (res.success && res.data) {
                setIsFavorite(res.data.isFavorite);
            }
        } catch (err) {
            console.error('Failed to check favorite status:', err);
        }
    };

    const toggleFavorite = async () => {
        if (!mediaDetail) return;
        try {
            if (isFavorite) {
                const delRes = await fetch(`/api/favorites?source_id=${mediaServerId}&vod_id=${currentVodId}&source_type=media_server`, { method: 'DELETE' });
                const data = await delRes.json();
                if (data.success) setIsFavorite(false);
            } else {
                const addRes = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source_id: mediaServerId,
                        source_type: 'media_server',
                        vod_id: currentVodId,
                        title: mediaDetail.Name,
                        cover: currentCover,
                        year: mediaDetail.ProductionYear?.toString()
                    })
                });
                const data = await addRes.json();
                if (data.success) setIsFavorite(true);
            }
        } catch (err) {
            console.error('Toggle favorite failed:', err);
        }
    };

    const loadSimilarItems = async (id: string) => {
        setSimilarLoading(true);
        try {
            const res = await apiGet<SimilarItem[]>(`/media-servers/${mediaServerId}/items/${id}/similar`);
            if (res.success && res.data) {
                setSimilarItems(res.data);
            }
        } catch (err) {
            console.error('[MediaServerPlay] Failed to load similar items:', err);
        } finally {
            setSimilarLoading(false);
        }
    };

    const handleRefresh = async () => {
        // 直接触发当前 currentVodId 的重新加载
        const id = currentVodId;
        setLoading(true);
        setDetailLoading(true);

        try {
            const [detailRes] = await Promise.all([
                apiGet<MediaItemDetail>(`/media-servers/${mediaServerId}/items/${id}`),
                loadSimilarItems(id), // 🚀 直接调用以复用逻辑并解决 warning
                checkFavoriteStatus(id)
            ]);

            if (detailRes.success && detailRes.data) setMediaDetail(detailRes.data);
            // similarRes 由 loadSimilarItems 内部处理了

            // 重新请求播放地址
            const playRes = await apiGet<any>(`/media-servers/${mediaServerId}/playback/${id}`);
            if (playRes.success && playRes.data.streamUrl) {
                setCurrentPlayUrl(playRes.data.streamUrl);
                await initPlayer(playRes.data.streamUrl);
            }
        } catch (err) {
            console.error('Refresh failed:', err);
        } finally {
            setLoading(false);
            setDetailLoading(false);
        }
    };

    // 独立出播放器初始化引擎
    const initPlayer = async (url: string) => {
        if (!wrapperRef.current) return;

        // 物理隔离清理
        if (artRef.current) {
            try { artRef.current.destroy(true); } catch (e) { }
            artRef.current = null;
        }
        wrapperRef.current.innerHTML = '';

        const mountPoint = document.createElement('div');
        mountPoint.style.width = '100%';
        mountPoint.style.height = '100%';
        wrapperRef.current.appendChild(mountPoint);

        await new Promise(r => setTimeout(r, 100));

        const isM3U8 = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('master');

        const [ArtplayerModule, HlsModule] = await Promise.all([
            import('artplayer'),
            import('hls.js')
        ]);
        const Artplayer = ArtplayerModule.default;
        const Hls = HlsModule.default;

        const playerConfig: any = {
            container: mountPoint,
            url: url,
            autoplay: true,
            autoMini: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            mutex: true,
            theme: '#3B82F6',
            moreVideoAttr: {
                crossOrigin: 'anonymous',
                playsInline: true,
                preload: 'auto',
            },
        };

        if (isM3U8) {
            playerConfig.type = 'm3u8';
            playerConfig.customType = {
                m3u8: (video: HTMLVideoElement, url: string) => {
                    if (Hls.isSupported()) {
                        const hls = new Hls({ enableWorker: true, manifestLoadingTimeOut: 30000 });
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        (video as any).hls = hls;
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    }
                }
            };
        }

        const art = new Artplayer(playerConfig);
        artRef.current = art;

        art.on('ready', () => setLoading(false));
        art.on('video:canplay', () => setLoading(false));
        art.on('video:error', () => {
            setLoadError(`播放器错误: ${art.video.error?.code || '未知'}`);
            setLoading(false);
        });
    };

    // 处理切换推荐内容
    const handleSwitchItem = async (item: SimilarItem) => {
        setLoading(true);
        setLoadError(null);
        try {
            // 需要先获取该项目的播放地址
            const playRes = await apiGet<any>(`/media-servers/${mediaServerId}/playback/${item.Id}`);
            if (playRes.success && playRes.data.streamUrl) {
                setCurrentVodId(item.Id);
                setCurrentTitle(item.Name);
                setCurrentPlayUrl(playRes.data.streamUrl);

                // 获取海报地址
                const serverRes = await apiGet<any[]>('/media-servers');
                const server = serverRes.data?.find(s => s.id === mediaServerId);
                if (server && item.ImageTags.Primary) {
                    const poster = `${server.url}/emby/Items/${item.Id}/Images/Primary?maxWidth=300&tag=${item.ImageTags.Primary}&api_key=${server.api_key}`;
                    setCurrentCover(poster);
                }
            } else {
                alert('获取推荐内容播放地址失败');
            }
        } catch (err) {
            console.error('Failed to switch item:', err);
        }
    };

    const formatDuration = (ticks?: number) => {
        if (!ticks) return '';
        const minutes = Math.floor(ticks / 10000000 / 60);
        return `${minutes} 分钟`;
    };

    return (
        <div className="p-4 lg:p-6 space-y-4 bg-primary min-h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
                {/* 左侧：播放器区域 (固定高度或按比例) */}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="relative flex-1 bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 min-h-[300px]">
                        <div className="w-full h-full" ref={wrapperRef}></div>

                        {loading && !loadError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 backdrop-blur-sm">
                                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <div className="text-white/40 text-[10px] uppercase tracking-widest font-black">Connecting...</div>
                            </div>
                        )}

                        {loadError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6 text-center">
                                <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-4"></i>
                                <h3 className="text-white font-bold mb-2">流媒体载入异常</h3>
                                <p className="text-white/40 text-xs mb-6">{loadError}</p>
                                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500 text-white rounded-full text-xs font-bold">重试</button>
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={onGoBack}
                                className="px-3 py-1.5 bg-secondary text-secondary hover:text-primary rounded-lg text-xs transition-colors flex items-center gap-2 border border-border-color shadow-sm"
                            >
                                <i className="fas fa-arrow-left"></i>
                                <span>返回</span>
                            </button>
                            <div className="text-secondary text-sm flex-1 min-w-0">
                                <span className="text-primary font-bold">{mediaDetail?.Name || currentTitle}</span>
                                {mediaDetail?.ProductionYear && (
                                    <span className="ml-2 text-xs opacity-40">({mediaDetail.ProductionYear})</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleFavorite}
                                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-2 font-bold ${isFavorite
                                    ? 'bg-red-500 text-white shadow-lg'
                                    : 'bg-secondary text-secondary hover:text-primary border border-border-color shadow-sm'
                                    }`}
                            >
                                <i className="fas fa-heart"></i>
                                {isFavorite ? '已收藏' : '收藏'}
                            </button>
                            <button
                                onClick={handleRefresh}
                                className="flex-1 sm:flex-none px-4 py-1.5 bg-secondary text-secondary hover:text-primary rounded-lg text-xs transition-all flex items-center justify-center gap-2 border border-border-color shadow-sm"
                            >
                                <i className="fas fa-sync-alt"></i>
                                刷新
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧：相似内容推荐 (对标网盘布局) */}
                <div className="lg:w-72 xl:w-80 flex-shrink-0 flex flex-col">
                    <div className="bg-secondary rounded-xl p-4 h-full flex flex-col border border-border-color shadow-xl overflow-hidden">
                        <h3 className="text-primary font-bold mb-3 flex items-center justify-between">
                            <span>
                                <i className="fas fa-magic mr-2 text-blue-500"></i>
                                其它类似
                            </span>
                        </h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {similarLoading ? (
                                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                            ) : similarItems.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 p-1">
                                    {similarItems.map((item) => (
                                        <button
                                            key={item.Id}
                                            onClick={() => handleSwitchItem(item)}
                                            className="group flex flex-col bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden transition-all border border-white/5 text-left"
                                        >
                                            <div className="aspect-[2/3] relative overflow-hidden bg-black">
                                                {item.ImageTags.Primary ? (
                                                    <img
                                                        src={`${initialCover.split('/emby/Items/')[0]}/emby/Items/${item.Id}/Images/Primary?maxWidth=200&tag=${item.ImageTags.Primary}&api_key=${initialCover.split('api_key=')[1]}`}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        alt={item.Name}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center opacity-20"><i className="fas fa-film text-xl"></i></div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                                    <span className="text-[9px] text-blue-400 font-black uppercase tracking-tighter">Play Now</span>
                                                </div>
                                            </div>
                                            <div className="p-2 min-w-0">
                                                <div className="text-primary font-bold text-[10px] truncate leading-tight group-hover:text-blue-400 transition-colors">{item.Name}</div>
                                                <div className="text-white/30 text-[9px] mt-0.5 flex justify-between items-center">
                                                    <span>{item.ProductionYear}</span>
                                                    <span className="px-1 bg-white/5 rounded text-[8px]">{item.Type === 'Movie' ? '电影' : item.Type}</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-white/20 text-xs italic">暂无推荐内容</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 下方：媒体详情 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-secondary rounded-xl p-5 border border-border-color space-y-4 shadow-sm">
                        <h3 className="text-primary font-bold flex items-center gap-2 border-b border-border-color pb-2">
                            <i className="fas fa-info-circle text-blue-400"></i>
                            媒体详情
                        </h3>

                        {detailLoading ? (
                            <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">影片名称:</span>
                                    <div className="text-primary text-xs sm:text-sm font-bold">{mediaDetail?.Name}</div>
                                </div>
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">发行年份:</span>
                                    <div className="text-primary text-xs sm:text-sm">{mediaDetail?.ProductionYear}</div>
                                </div>
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">分级:</span>
                                    <div className="text-primary text-xs sm:text-sm">{mediaDetail?.OfficialRating || '无'}</div>
                                </div>
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">时长:</span>
                                    <div className="text-primary text-xs sm:text-sm">{formatDuration(mediaDetail?.RunTimeTicks)}</div>
                                </div>
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">类型:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {mediaDetail?.Genres?.map(g => (
                                            <span key={g} className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-500/20">#{g}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.05]">
                                    <span className="text-secondary w-20 flex-shrink-0 text-xs font-semibold">评分:</span>
                                    <div className="text-yellow-500 font-bold">★ {mediaDetail?.CommunityRating || '0'}</div>
                                </div>
                            </div>
                        )}

                        {!detailLoading && mediaDetail?.People && (
                            <div className="pt-4 border-t border-border-color">
                                <div className="text-secondary mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
                                    <i className="fas fa-users text-blue-500"></i>
                                    主演阵容
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {mediaDetail.People.slice(0, 10).map((person, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <span className="text-primary text-xs font-bold">{person.Name}</span>
                                            <span className="text-white/30 text-[9px] uppercase">{person.Role || person.Type}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {!detailLoading && mediaDetail?.Overview && (
                        <div className="bg-secondary rounded-xl p-5 border border-border-color shadow-sm">
                            <h3 className="text-primary font-bold mb-3 flex items-center gap-2">
                                <i className="fas fa-align-left text-green-400"></i>
                                剧情简介
                            </h3>
                            <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap opacity-80">
                                {mediaDetail.Overview}
                            </p>
                        </div>
                    )}
                </div>

                <div className="hidden lg:block">
                    <div className="bg-secondary rounded-xl p-2 border border-border-color overflow-hidden shadow-lg sticky top-6 w-full">
                        <img
                            src={currentCover}
                            alt={currentTitle}
                            className="w-full h-auto rounded-lg shadow-2xl filter brightness-90 hover:brightness-100 transition-all"
                            onError={e => (e.target as HTMLImageElement).src = '/poster-fallback.png'}
                        />
                    </div>
                </div>
            </div>

            <div
                className="fixed inset-0 -z-10 opacity-[0.03] blur-[150px] scale-150 pointer-events-none"
                style={{ backgroundImage: `url(${currentCover})`, backgroundSize: 'cover' }}
            ></div>
        </div>
    );
}
