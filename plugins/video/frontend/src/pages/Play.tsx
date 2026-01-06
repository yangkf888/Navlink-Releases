import { useState, useEffect, useRef } from 'react';
import { VideoDetail } from '../types';
import { apiGet, apiPost, apiDelete } from '../utils/api';

// 替代视频源类型
interface AlternativeSource {
    source_id: number;
    source_name: string;
    response_time?: number;
    quality?: string;
    vod_id: string;
    vod_name: string;
    vod_pic: string;
    total_episodes: number;
    current_episode_available: boolean;
    episodes: Array<{
        source: string;
        list: Array<{ name: string; url: string }>;
    }>;
}

interface PlayProps {
    sourceId: number;
    vodId: string;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    onGoBack?: () => void;
}

export function Play({ sourceId, vodId, onNavigate, onGoBack }: PlayProps) {
    const [video, setVideo] = useState<VideoDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 播放状态
    const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
    const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);

    // 多源搜索状态
    const [alternativeSources, setAlternativeSources] = useState<AlternativeSource[]>([]);
    const [searchingAlternatives, setSearchingAlternatives] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(true);


    const playerRef = useRef<HTMLDivElement>(null);
    const artPlayerRef = useRef<any>(null);

    // 加载视频详情
    useEffect(() => {
        loadVideoDetail();
        checkFavorite();
    }, [sourceId, vodId]);

    // 视频加载后，后台搜索其他源
    useEffect(() => {
        if (video && video.vod_name) {
            searchAlternativeSources();
        }
    }, [video?.vod_name]);

    // 初始化播放器
    useEffect(() => {
        if (video && video.episodes.length > 0) {
            initPlayer();
        }

        return () => {
            if (artPlayerRef.current) {
                artPlayerRef.current.destroy();
            }
        };
    }, [video, selectedSourceIndex, selectedEpisodeIndex]);

    const loadVideoDetail = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await apiGet<VideoDetail>(`/videos/${vodId}`, { source_id: sourceId });

            if (res.success && res.data) {
                setVideo(res.data);
            } else {
                setError(res.error || '获取视频信息失败');
            }
        } catch (err) {
            setError('网络错误');
        } finally {
            setLoading(false);
        }
    };

    const checkFavorite = async () => {
        try {
            console.log('[Play] Checking favorite status for:', { sourceId, vodId });
            const res = await apiGet<{ isFavorite: boolean }>('/videos/favorites/check', {
                source_id: sourceId,
                vod_id: vodId
            });
            console.log('[Play] Favorite check result:', res);
            if (res.success && res.data) {
                setIsFavorite(res.data.isFavorite);
            }
        } catch (err) {
            console.error('[Play] Failed to check favorite:', err);
        }
    };

    const initPlayer = async () => {
        if (!playerRef.current || !video) return;

        const currentSource = video.episodes[selectedSourceIndex];
        if (!currentSource || !currentSource.list[selectedEpisodeIndex]) return;

        const episode = currentSource.list[selectedEpisodeIndex];
        const videoUrl = episode.url;


        // 清除旧播放器和 HLS 实例
        if (artPlayerRef.current) {
            // 清理 HLS
            if (artPlayerRef.current.video?.hls) {
                artPlayerRef.current.video.hls.destroy();
            }
            artPlayerRef.current.destroy();
            artPlayerRef.current = null;
        }

        try {
            // 预加载 Artplayer 和 HLS.js
            const [ArtplayerModule, HlsModule] = await Promise.all([
                import('artplayer'),
                import('hls.js')
            ]);
            const Artplayer = ArtplayerModule.default;
            const Hls = HlsModule.default;

            // 由于很多视频源 URL 没有 m3u8 标识但实际返回 HLS 流
            // 我们默认对所有视频都尝试使用 HLS.js 处理
            // HLS.js 会在加载时检测是否为有效的 HLS 流

            console.log('[Play] Video URL:', videoUrl);

            // 构建代理 URL
            const getProxyUrl = (url: string, absolute = false) => {
                const proxyParam = video.source_proxy_enabled ? '&proxy=1' : '';
                const path = `/api/plugins/video/api/proxy/hls?url=${encodeURIComponent(url)}${proxyParam}`;
                // 如果是 iframe 使用，需要绝对路径
                return absolute ? `${window.location.origin}${path}` : path;
            };

            // 检查是否需要使用代理 - 完全由后台配置决定
            const needsProxy = () => {
                return !!video.source_proxy_enabled;
            };

            // 决定初始使用的 URL
            const initialUrl = needsProxy() ? getProxyUrl(videoUrl) : videoUrl;
            console.log('[Play] Using URL:', initialUrl, needsProxy() ? '(proxied)' : '(direct)');

            // 创建播放器配置
            const playerConfig: any = {
                container: playerRef.current,
                url: initialUrl,
                type: 'm3u8',  // 默认使用 m3u8 类型
                autoplay: true,
                autoSize: false,
                aspectRatio: false,
                fullscreen: true,
                flip: true,
                fullscreenWeb: true,
                setting: true,
                playbackRate: true,
                pip: true,
                mutex: true,
                theme: '#ef4444',
                volume: 0.7,
                moreVideoAttr: {
                    crossOrigin: 'anonymous',
                },
            };

            // 使用 HLS.js 处理所有视频（如果支持）
            if (Hls.isSupported()) {
                playerConfig.customType = {
                    m3u8: function (videoElement: HTMLVideoElement, url: string) {
                        // 清理旧的 HLS 实例
                        if ((videoElement as any).hls) {
                            (videoElement as any).hls.destroy();
                        }

                        const hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: false,  // 关闭低延迟模式，提高兼容性
                            maxBufferLength: 30,
                            backBufferLength: 30,
                        });

                        hls.loadSource(url);
                        hls.attachMedia(videoElement);

                        // 保存 HLS 实例以便后续清理
                        (videoElement as any).hls = hls;

                        // 记录是否已经尝试过代理
                        let triedProxy = url.includes('/api/proxy/hls');

                        // 记录连续非致命错误次数（如片段加载失败）
                        let fragErrorCount = 0;
                        const MAX_FRAG_ERRORS = 3;

                        // 错误处理
                        hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
                            console.error('[HLS] Error:', data.type, data.details, data);

                            // 针对特定的网络解析问题（如终端日志中的 ERR_NAME_NOT_RESOLVED）
                            // 即使 fatal 为 false，如果发生了 fragLoadError，由于 Hls.js 会自动重试，
                            // 我们在这里计数，如果连续多次失败，则判断该域名连通性差，强制切换代理。
                            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
                                data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                                fragErrorCount++;
                                console.warn(`[HLS] Fragment load error count: ${fragErrorCount}/${MAX_FRAG_ERRORS}`);
                            }

                            const shouldSwitchToProxy = data.fatal || fragErrorCount >= MAX_FRAG_ERRORS;

                            if (shouldSwitchToProxy) {
                                if (data.type === Hls.ErrorTypes.NETWORK_ERROR || fragErrorCount >= MAX_FRAG_ERRORS) {
                                    // 只有还没试过代理的情况下才尝试代理
                                    if (!triedProxy) {
                                        console.log('[HLS] Significant network issue detected, switching to proxy fallback...');
                                        triedProxy = true;
                                        fragErrorCount = 0; // 重置计数
                                        hls.destroy();

                                        const proxyUrl = getProxyUrl(videoUrl);
                                        const newHls = new Hls({
                                            enableWorker: true,
                                            lowLatencyMode: false,
                                        });
                                        newHls.loadSource(proxyUrl);
                                        newHls.attachMedia(videoElement);
                                        (videoElement as any).hls = newHls;

                                        // 对新的 HLS 实例也绑定错误处理（递归或简化处理）
                                        newHls.on(Hls.Events.ERROR, (_e2, d2) => {
                                            if (d2.fatal) {
                                                console.error('[HLS Proxy] Fatal proxy error, falling back to direct video element src');
                                                newHls.destroy();
                                                videoElement.src = videoUrl;
                                                videoElement.load();
                                            }
                                        });
                                    } else {
                                        // 代理也失败了，尝试直接使用 video 标签播放（绕过 Hls.js 的某些复杂逻辑）
                                        console.log('[HLS] Proxy failed or already tried, final fallback to direct video src');
                                        hls.destroy();
                                        videoElement.src = url;
                                        videoElement.load();
                                    }
                                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                                    console.log('[HLS] Media error, trying to recover...');
                                    hls.recoverMediaError();
                                } else {
                                    console.log('[HLS] Unhandled fatal error, trying direct video src');
                                    hls.destroy();
                                    videoElement.src = url;
                                }
                            }
                        });
                    },
                };
            } else if (document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
                // Safari 原生支持 HLS
                console.log('[Play] Using native HLS support');
                // Safari 直接播放，不需要 customType
                delete playerConfig.type;
            } else {
                // 不支持 HLS，直接播放
                delete playerConfig.type;
            }

            const art = new Artplayer(playerConfig);

            // 保存进度
            art.on('video:timeupdate', () => {
                const currentTime = art.currentTime;
                const duration = art.duration;

                // 每30秒保存一次进度
                if (Math.floor(currentTime) % 30 === 0 && currentTime > 0) {
                    saveProgress(currentTime, duration);
                }
            });

            // 视频结束
            art.on('video:ended', () => {
                // 自动播放下一集
                const currentSrc = video.episodes[selectedSourceIndex];
                if (currentSrc && selectedEpisodeIndex < currentSrc.list.length - 1) {
                    setSelectedEpisodeIndex(prev => prev + 1);
                }
            });

            artPlayerRef.current = art;
        } catch (err) {
            console.error('[Play] Failed to initialize player:', err);
            setError('播放器初始化失败');
        }
    };

    const saveProgress = async (progress: number, duration: number) => {
        if (!video) return;

        const currentSource = video.episodes[selectedSourceIndex];
        const episode = currentSource?.list[selectedEpisodeIndex];

        await apiPost('/history', {
            source_id: sourceId,
            vod_id: vodId,
            title: video.vod_name,
            cover: video.vod_pic,
            episode: selectedEpisodeIndex + 1,
            episode_name: episode?.name,
            progress,
            duration
        });
    };

    const toggleFavorite = async () => {
        if (!video) return;

        if (isFavorite) {
            // 取消收藏
            await apiDelete(`/favorites?source_id=${sourceId}&vod_id=${vodId}`);
            setIsFavorite(false);
        } else {
            const res = await apiPost('/favorites', {
                source_id: sourceId,
                vod_id: vodId,
                title: video.vod_name,
                cover: video.vod_pic,
                year: video.vod_year
            });
            if (res.success) {
                setIsFavorite(true);
            }
        }
    };

    const handleEpisodeClick = (sourceIdx: number, epIdx: number) => {
        setSelectedSourceIndex(sourceIdx);
        setSelectedEpisodeIndex(epIdx);
    };

    // 后台搜索其他视频源
    const searchAlternativeSources = async () => {
        if (!video?.vod_name) return;

        setSearchingAlternatives(true);
        setAlternativeSources([]); // 清空旧的替代源

        try {
            const token = localStorage.getItem('auth_token');
            const url = new URL(`${window.location.origin}/api/plugins/video/api/multi-source/search`);
            url.searchParams.append('title', video.vod_name);
            url.searchParams.append('exclude_source_id', String(sourceId));
            url.searchParams.append('episode_index', String(selectedEpisodeIndex));
            url.searchParams.append('type_name', video.type_name || '');
            url.searchParams.append('year', video.vod_year || '');
            url.searchParams.append('stream', 'true');

            const response = await fetch(url.toString(), {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    'X-No-Compression': 'true'
                }
            });

            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') {
                            setSearchingAlternatives(false);
                            continue;
                        }

                        try {
                            const altSource = JSON.parse(dataStr);
                            if (altSource && altSource.source_id) {
                                setAlternativeSources(prev => {
                                    // 防止重复（虽然由于 excludeId 理论上不会重复，但保险起见）
                                    if (prev.some(s => s.source_id === altSource.source_id)) return prev;
                                    return [...prev, altSource];
                                });
                            }
                        } catch (e) {
                            console.error('[Play] Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Play] Failed to search alternatives:', err);
        } finally {
            setSearchingAlternatives(false);
        }
    };

    // 切换到其他视频源
    const handleSwitchSource = (altSource: AlternativeSource) => {
        // 导航到新的播放页面，使用替代源的信息
        onNavigate('play', {
            sourceId: altSource.source_id,
            vodId: altSource.vod_id,
            // 保持当前集数（如果可用）
            episodeIndex: altSource.current_episode_available ? selectedEpisodeIndex : 0
        });
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="aspect-video bg-gray-800 rounded-xl mb-6"></div>
                <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-800 rounded w-2/3"></div>
            </div>
        );
    }

    if (error || !video) {
        return (
            <div className="p-6 text-center">
                <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p className="text-gray-400">{error || '视频不存在'}</p>
                <button
                    onClick={() => onNavigate('home')}
                    className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                >
                    返回首页
                </button>
            </div>
        );
    }

    const currentSource = video.episodes[selectedSourceIndex];

    return (
        <div className="p-4 lg:p-6 space-y-4">
            {/* 顶部区域：播放器 + 剧集面板 */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* 左侧：播放器 */}
                <div className="flex-1 min-w-0">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                        <div className="w-full h-full" ref={playerRef}></div>
                    </div>

                    {/* 当前播放信息 */}
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* 左侧：返回按钮 + 播放信息 */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => onGoBack ? onGoBack() : onNavigate('home')}
                                className="px-3 py-2 sm:py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <i className="fas fa-arrow-left"></i>
                                <span className="hidden sm:inline">返回</span>
                            </button>
                            <div className="text-gray-400 text-sm flex-1 min-w-0">
                                <span className="hidden sm:inline">正在播放：</span>
                                <span className="text-white">{video.vod_name}</span>
                                {currentSource && currentSource.list[selectedEpisodeIndex] && (
                                    <span className="text-red-400 ml-2">
                                        {currentSource.list[selectedEpisodeIndex].name}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* 右侧：收藏 + 刷新按钮 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleFavorite}
                                className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${isFavorite
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-red-400'
                                    }`}
                            >
                                <i className="fas fa-heart"></i>
                                {isFavorite ? '已收藏' : '收藏'}
                            </button>
                            <button
                                onClick={loadVideoDetail}
                                className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-sync-alt"></i>
                                刷新
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧：剧集面板 */}
                <div className="lg:w-72 xl:w-80 flex-shrink-0">
                    <div className="bg-gray-800/50 rounded-xl p-4 h-full max-h-[400px] lg:max-h-[calc(56.25vw*0.5+60px)] flex flex-col">
                        <h3 className="text-white font-medium mb-3 flex items-center justify-between">
                            <span>
                                <i className="fas fa-list-ol mr-2 text-red-400"></i>
                                选集 ({currentSource?.list.length || 0}集)
                            </span>
                        </h3>

                        {/* 剧集网格 - 可滚动 */}
                        {currentSource && (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                    {currentSource.list.map((ep, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleEpisodeClick(selectedSourceIndex, idx)}
                                            className={`px-2 py-2.5 rounded text-sm transition-colors truncate ${selectedEpisodeIndex === idx
                                                ? 'bg-red-500 text-white font-medium'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                            title={ep.name}
                                        >
                                            {ep.name.length > 4 ? `${idx + 1}` : ep.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 视频源切换 */}
            {video.episodes.length > 1 && (
                <div className="bg-gray-800/50 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center">
                        <i className="fas fa-server mr-2 text-blue-400"></i>
                        播放线路 ({video.episodes.length}个源)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {video.episodes.map((source, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setSelectedSourceIndex(idx);
                                    setSelectedEpisodeIndex(0);
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedSourceIndex === idx
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <i className="fas fa-play-circle mr-2"></i>
                                {source.source}
                            </button>
                        ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                        💡 如果当前线路卡顿，可尝试切换其他播放源
                    </p>
                </div>
            )}

            {/* 其他视频源 - 多源切换 */}
            <div className="bg-gray-800/50 rounded-xl p-4">
                <h3
                    className="text-white font-medium mb-3 flex items-center justify-between cursor-pointer"
                    onClick={() => setShowAlternatives(!showAlternatives)}
                >
                    <span>
                        <i className="fas fa-exchange-alt mr-2 text-green-400"></i>
                        全部视频源
                        {searchingAlternatives ? (
                            <span className="text-gray-500 text-sm ml-2">
                                <i className="fas fa-spinner fa-spin mr-1"></i>搜索中...
                            </span>
                        ) : (
                            <span className="text-gray-500 text-sm ml-2">
                                ({alternativeSources.length + 1}个)
                            </span>
                        )}
                    </span>
                    <i className={`fas fa-chevron-${showAlternatives ? 'up' : 'down'} text-gray-500`}></i>
                </h3>

                {showAlternatives && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {/* 当前播放的源 - 始终显示在第一位 */}
                            <div
                                className="bg-green-600 rounded-lg p-3 text-left relative ring-2 ring-green-400"
                            >
                                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full z-10">
                                    当前
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="text-white font-medium text-sm truncate flex-1">
                                        {video.source_name || `源 ${sourceId}`}
                                    </div>
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-green-200 text-xs">
                                        {video.episodes.reduce((sum, ep) => sum + (ep.list?.length || 0), 0)}集
                                    </span>
                                    {video.vod_remarks && (
                                        <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] rounded font-medium">
                                            {video.vod_remarks.length > 8 ? video.vod_remarks.substring(0, 8) + '...' : video.vod_remarks}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 其他可用的源 */}
                            {alternativeSources.map((alt) => (
                                <button
                                    key={`${alt.source_id}-${alt.vod_id}`}
                                    onClick={() => handleSwitchSource(alt)}
                                    className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-all hover:scale-[1.02] group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="text-white font-medium text-sm truncate flex-1 group-hover:text-green-400">
                                            {alt.source_name}
                                        </div>
                                        {alt.response_time !== undefined && (
                                            <span
                                                className={`flex-shrink-0 w-2 h-2 rounded-full ${alt.response_time < 500 ? 'bg-green-500' :
                                                    alt.response_time < 1200 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                title={`延迟: ${alt.response_time}ms`}
                                            ></span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-gray-400 text-xs">
                                            {alt.total_episodes}集
                                        </span>
                                        {alt.quality && (
                                            <span className="px-1.5 py-0.5 bg-blue-500/80 text-white text-[10px] rounded font-medium">
                                                {alt.quality}
                                            </span>
                                        )}
                                        {alt.current_episode_available && (
                                            <span className="text-green-400 text-[10px] font-bold">✓</span>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {/* 搜索中的占位符 */}
                            {searchingAlternatives && (
                                <div className="bg-gray-700/50 rounded-lg p-3 animate-pulse">
                                    <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                                </div>
                            )}
                        </div>

                        {!searchingAlternatives && alternativeSources.length === 0 && (
                            <p className="text-gray-500 text-sm mt-2">
                                未找到其他视频源
                            </p>
                        )}

                        <p className="text-gray-500 text-xs mt-3">
                            💡 点击可快速切换到其他视频源播放同一视频
                        </p>
                    </>
                )}
            </div>

            {/* 视频详情 */}
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
                {/* 标题和基本信息 */}
                <div>
                    <h1 className="text-xl font-bold text-white">{video.vod_name}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
                        {video.vod_year && (
                            <span className="px-2 py-0.5 bg-gray-700 rounded">{video.vod_year}</span>
                        )}
                        {video.vod_area && (
                            <span className="px-2 py-0.5 bg-gray-700 rounded">{video.vod_area}</span>
                        )}
                        {video.vod_class && (
                            <span className="px-2 py-0.5 bg-gray-700 rounded">{video.vod_class}</span>
                        )}
                        {video.vod_score && parseFloat(video.vod_score) > 0 && (
                            <span className="text-yellow-400 flex items-center">
                                <i className="fas fa-star mr-1"></i>
                                {video.vod_score}
                            </span>
                        )}
                    </div>
                </div>

                {/* 演员导演 */}
                {(video.vod_director || video.vod_actor) && (
                    <div className="text-sm text-gray-400 space-y-1 border-t border-gray-700 pt-4">
                        {video.vod_director && (
                            <p><span className="text-gray-500">导演：</span>{video.vod_director}</p>
                        )}
                        {video.vod_actor && (
                            <p><span className="text-gray-500">演员：</span>{video.vod_actor}</p>
                        )}
                    </div>
                )}

                {/* 简介 */}
                {video.vod_content && (
                    <div className="text-sm text-gray-400 border-t border-gray-700 pt-4">
                        <p className="text-gray-500 mb-1">简介：</p>
                        <p className="leading-relaxed">{video.vod_content}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
