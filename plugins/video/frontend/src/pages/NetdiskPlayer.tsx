import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '../utils/api';

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
    director?: string;
    actor?: string;
    area?: string;
    tagline?: string;
    studio?: string;
    extra_metadata?: Record<string, any>;
}

interface NetdiskPlayerProps {
    mediaId: number;
    sourceId: number;
    initialVideoIndex?: number;
    onNavigate: (view: any, params?: any) => void;
    onGoBack?: () => void;
}

// 扩展元数据标签映射字典 (覆盖电影、剧集、VR、成人等多种场景)
const METADATA_LABELS: Record<string, string> = {
    original_title: '原始标题',
    originaltitle: '原始标题',
    director: '导演',
    area: '国家/地区',
    country: '国家/地区',
    year: '发行年份',
    premiered: '首播日期',
    studio: '制作公司',
    tagline: '看点',
    mpaa: '分级',
    runtime: '片长',
    status: '状态',
    set: '系列',
    budget: '预算',
    revenue: '营收',
    trailer: '预告片',
    website: '官网',
    imdbid: 'IMDB ID',
    tmdbid: 'TMDB ID',
    tmbdid: 'TMDB ID',
    tvdbid: 'TVDB ID',
    writer: '编剧',
    producer: '制片',
    musicby: '配乐',
    // 针对特定类型 (如 VR/Label) 的补全
    maker: '片商',
    label: '发行商',
    publisher: '出版商',
    series: '系列',
    number: '番号/编号',
    code: '特征码',
    user_rating: '个人评分',
    outline: '大纲',
    plot: '详情'
};

export function NetdiskPlayer({ mediaId, sourceId, initialVideoIndex = 0, onNavigate, onGoBack }: NetdiskPlayerProps) {
    const [media, setMedia] = useState<MediaItem | null>(null);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState(initialVideoIndex);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playUrl, setPlayUrl] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [transcodingSessionId, setTranscodingSessionId] = useState<string | null>(null);
    const [isTranscoding, setIsTranscoding] = useState(false);

    const playerRef = useRef<HTMLDivElement>(null);
    const artPlayerRef = useRef<any>(null);
    const progressTimerRef = useRef<any>(null);
    const transcodingSessionIdRef = useRef<string | null>(null); // 用于追踪最新的 sessionId，避免闭包问题
    const hlsRef = useRef<any>(null); // 用于追踪 HLS.js 实例，确保正确销毁

    // 当 mediaId 变化时，先清理旧的播放器和转码会话
    useEffect(() => {
        // 先销毁旧的 HLS.js 实例，这是关键！
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        // 然后销毁旧播放器
        if (artPlayerRef.current) {
            artPlayerRef.current.destroy();
            artPlayerRef.current = null;
        }
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
        // 停止旧的转码会话 (使用 ref 获取最新值，避免闭包问题)
        if (transcodingSessionIdRef.current) {
            const url = `/api/plugins/video/api/transcode/${transcodingSessionIdRef.current}/stop`;
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
            } else {
                apiPost(`/transcode/${transcodingSessionId}/stop`, {}).catch(() => { });
            }
            setTranscodingSessionId(null);
            transcodingSessionIdRef.current = null;
        }
        // 重置状态
        setPlayUrl(null);
        setIsTranscoding(false);

        loadMediaDetail();
        checkFavoriteStatus();
    }, [mediaId, sourceId]);

    useEffect(() => {
        if (media) {
            getPlayUrl(selectedVideoIndex);
        }
    }, [media, selectedVideoIndex]);

    useEffect(() => {
        if (playUrl) {
            initPlayer();
        }
        return () => {
            // 先销毁 HLS 实例，停止所有网络请求
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (artPlayerRef.current) {
                saveHistory(artPlayerRef.current);
                artPlayerRef.current.destroy();
                artPlayerRef.current = null;
            }
            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
            }
            // 不要在这里直接停止转码，因为切换 playUrl 会触发这个清理，
            // 而新 session 可能还没建立。停止逻辑放在 getPlayUrl 中。
        };
    }, [playUrl]);

    // 组件卸载或页面关闭时确保停止转码
    useEffect(() => {
        const stopTranscoding = () => {
            if (transcodingSessionId) {
                // 使用 sendBeacon 或同步 xhr 确保请求发出
                const url = `/api/plugins/video/api/transcode/${transcodingSessionId}/stop`;
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
                } else {
                    apiPost(`/transcode/${transcodingSessionId}/stop`, {}).catch(() => { });
                }
            }
        };

        window.addEventListener('beforeunload', stopTranscoding);
        return () => {
            stopTranscoding();
            window.removeEventListener('beforeunload', stopTranscoding);
        };
    }, [transcodingSessionId]);

    const loadMediaDetail = async () => {
        setLoading(true);
        try {
            const res = await apiGet<MediaItem>(`/netdisk/media/${mediaId}`);
            if (res.success && res.data) {
                setMedia(res.data);
            } else {
                setError(res.error || '获取媒体详情失败');
            }
        } catch (err) {
            setError('网络错误');
        } finally {
            setLoading(false);
        }
    };

    const checkFavoriteStatus = async () => {
        try {
            const res = await apiGet<{ isFavorite: boolean }>('/favorites/check', {
                source_id: sourceId,
                vod_id: mediaId.toString(),
                source_type: 'netdisk'
            });
            if (res.success && res.data) {
                setIsFavorite(res.data.isFavorite);
            }
        } catch (err) {
            console.error('Failed to check favorite status:', err);
        }
    };

    const getPlayUrl = async (index: number) => {
        // 如果已有转码会话，先停止旧的
        if (transcodingSessionId) {
            apiPost(`/transcode/${transcodingSessionId}/stop`, {}).catch(() => { });
            setTranscodingSessionId(null);
            transcodingSessionIdRef.current = null;
        }

        // 立即销毁旧播放器，防止 HLS.js 继续请求旧的会话 URL
        if (artPlayerRef.current) {
            artPlayerRef.current.destroy();
            artPlayerRef.current = null;
        }

        // 🚀 核心优化：如果媒体标题或文件名暗示是 STRM，先给个加载提示
        if (media?.video_files?.[index]?.includes('|')) {
            setIsTranscoding(true);
        }

        setPlayUrl(null);

        try {
            const res = await apiPost<{ playUrl: string, isStrm?: boolean, transcodeAvailable?: boolean, sessionId?: string }>(`/netdisk/media/${mediaId}/play`, { videoIndex: index });
            if (res.success && res.data) {
                setPlayUrl(res.data.playUrl);
                if (res.data.sessionId) {
                    setTranscodingSessionId(res.data.sessionId);
                    transcodingSessionIdRef.current = res.data.sessionId;
                    setIsTranscoding(true);
                }
            }
        } catch (err) {
            console.error('Failed to get play URL:', err);
        }
    };

    const saveHistory = async (player: any) => {
        if (!media || !player) return;
        const currentTime = player.currentTime;
        const duration = player.duration;
        if (currentTime <= 0) return;

        try {
            await apiPost('/history', {
                source_id: sourceId,
                source_type: 'netdisk',
                vod_id: mediaId.toString(),
                title: media.title,
                cover: media.poster_url,
                episode: selectedVideoIndex + 1,
                episode_name: media.video_files[selectedVideoIndex],
                progress: currentTime,
                duration: duration
            });
        } catch (err) {
            console.error('Failed to save history:', err);
        }
    };

    const initPlayer = async () => {
        if (!playerRef.current || !playUrl || !media) return;

        if (artPlayerRef.current) {
            artPlayerRef.current.destroy();
            artPlayerRef.current = null;
        }

        try {
            const [ArtplayerModule, HlsModule] = await Promise.all([
                import('artplayer'),
                import('hls.js')
            ]);
            const Artplayer = ArtplayerModule.default;
            const Hls = HlsModule.default;

            const playerConfig: any = {
                container: playerRef.current,
                url: playUrl,
                autoplay: true,
                fullscreen: true,
                fullscreenWeb: true,
                setting: true,
                playbackRate: true,
                aspectRatio: true,
                pip: true,
                theme: '#ef4444',
                moreVideoAttr: {
                    crossOrigin: 'anonymous',
                },
            };

            const isM3U8 = playUrl.includes('.m3u8') || playUrl.includes('playlist.m3u8');
            if (isM3U8) {
                playerConfig.type = 'm3u8';
                playerConfig.customType = {
                    m3u8: function (video: any, url: any) {
                        if (Hls.isSupported()) {
                            // 先销毁旧的 HLS 实例
                            if (hlsRef.current) {
                                hlsRef.current.destroy();
                                hlsRef.current = null;
                            }

                            const hls = new Hls({
                                // 深度优化实时转码流参数
                                maxBufferLength: 20,
                                maxMaxBufferLength: 40,
                                enableWorker: true,
                                lowLatencyMode: true,
                                fragLoadingMaxRetry: 10,
                                manifestLoadingMaxRetry: 10,
                                // 针对转码流，如果分片 404，可能是 FFmpeg 还没写完，增加重试
                                fragLoadingRetryDelay: 1000,
                            });

                            // 保存 HLS 实例引用，用于后续清理
                            hlsRef.current = hls;

                            hls.loadSource(url);
                            hls.attachMedia(video);

                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                setIsTranscoding(false);
                                video.play().catch(() => { });
                            });

                            // 针对转码初期的 404 错误优化处理
                            hls.on(Hls.Events.ERROR, (_, data) => {
                                if (data.fatal) {
                                    switch (data.type) {
                                        case Hls.ErrorTypes.NETWORK_ERROR:
                                            // 如果是网络错误且正在转码，说明文件还没写好，让他自动重试
                                            console.warn('HLS Network Error, retrying...', data);
                                            hls.startLoad();
                                            break;
                                        default:
                                            setIsTranscoding(false);
                                            console.error('HLS Fatal Error:', data);
                                            hls.destroy();
                                            initPlayer(); // 再次重试或回退
                                            break;
                                    }
                                }
                            });
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                            video.addEventListener('loadedmetadata', () => {
                                setIsTranscoding(false);
                            });
                        }
                    }
                };
            }

            const player = new Artplayer(playerConfig);
            artPlayerRef.current = player;

            // 如果不是 M3U8，在播放开始时关闭加载提示
            player.on('play', () => {
                setIsTranscoding(false);
            });

            // 定时保存进度 (每 30 秒)
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            progressTimerRef.current = setInterval(() => {
                saveHistory(player);
            }, 30000);

            player.on('destroy', () => {
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            });

        } catch (err) {
            console.error('Failed to init Artplayer:', err);
            setIsTranscoding(false);
        }
    };

    const toggleFavorite = async () => {
        if (!media) return;
        try {
            if (isFavorite) {
                const res = await apiDelete('/favorites', {
                    source_id: sourceId,
                    vod_id: mediaId.toString(),
                    source_type: 'netdisk'
                });
                if (res.success) setIsFavorite(false);
            } else {
                const res = await apiPost('/favorites', {
                    source_id: sourceId,
                    source_type: 'netdisk',
                    vod_id: mediaId.toString(),
                    title: media.title,
                    cover: media.poster_url,
                    year: media.year?.toString()
                });
                if (res.success) setIsFavorite(true);
            }
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    };

    // 动态渲染元数据行 (全量读取策略)
    const renderMetadataRows = () => {
        if (!media) return null;

        const rows: { label: string, value: any, key: string }[] = [];
        const processedKeys = new Set<string>();

        // 1. 核心显示字段 (手动排序以固定常见布局)
        const coreDisplays = [
            { k: 'originaltitle', l: METADATA_LABELS.originaltitle },
            { k: 'genre', l: '类型' },
            { k: 'director', l: METADATA_LABELS.director },
            { k: 'maker', l: METADATA_LABELS.maker },
            { k: 'studio', l: METADATA_LABELS.studio },
            { k: 'publisher', l: METADATA_LABELS.publisher },
            { k: 'label', l: METADATA_LABELS.label },
            { k: 'series', l: METADATA_LABELS.series },
            { k: 'area', l: METADATA_LABELS.area },
            { k: 'year', l: METADATA_LABELS.year },
            { k: 'premiered', l: METADATA_LABELS.premiered },
            { k: 'rating', l: '社区评分' },
            { k: 'tagline', l: METADATA_LABELS.tagline },
            { k: 'number', l: METADATA_LABELS.number },
            { k: 'code', l: METADATA_LABELS.code },
        ];

        const data = media.extra_metadata || {};

        coreDisplays.forEach(core => {
            const val = data[core.k];
            if (val) {
                let displayVal = val;
                if (core.k === 'genre') {
                    const genres = typeof val === 'string' ? val.split(', ') : val;
                    displayVal = (
                        <div className="flex flex-wrap gap-1">
                            {Array.isArray(genres) ? genres.map(g => (
                                <span key={g} className="text-blue-400">#{g}</span>
                            )) : <span className="text-blue-400">#{genres}</span>}
                        </div>
                    );
                } else if (core.k === 'rating') {
                    displayVal = (
                        <span className="text-yellow-500 font-bold flex items-center gap-1">
                            <i className="fas fa-star text-xs"></i>
                            {parseFloat(val).toFixed(1)}
                        </span>
                    );
                } else if (core.k === 'tagline') {
                    displayVal = <span className="text-gray-400 italic">{val}</span>;
                }

                rows.push({ label: core.l, value: displayVal, key: core.k });
                processedKeys.add(core.k);
            }
        });

        // 2. 及其它所有定义的元数据 (非核心但在标签字典里的)
        Object.keys(METADATA_LABELS).forEach(key => {
            if (!processedKeys.has(key) && data[key]) {
                rows.push({ label: METADATA_LABELS[key], value: data[key], key });
                processedKeys.add(key);
            }
        });

        // 3. 兜底策略：没有任何映射但在数据里有的字段 (全量透显)
        const skipKeys = [
            'title', 'plot', 'outline', 'summary', 'poster', 'fanart', 'thumb',
            'actor', 'credits', 'cast', 'uniqueid', 'id', 'user_rating'
        ];
        Object.entries(data).forEach(([key, val]) => {
            if (!processedKeys.has(key) && !skipKeys.includes(key)) {
                // 排除一些格式复杂的标签
                if (typeof val === 'string' && val.length < 200 && !val.includes('<')) {
                    rows.push({ label: key.toUpperCase(), value: val, key });
                }
            }
        });

        return rows.map((row, idx) => (
            <div key={idx} className="flex items-start gap-2">
                <span className="text-gray-500 w-20 flex-shrink-0">{row.label}:</span>
                <div className="text-gray-300 break-words flex-1 min-w-0">{row.value}</div>
            </div>
        ));
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse bg-gray-950 min-h-full">
                <div className="aspect-video bg-gray-800 rounded-xl mb-6"></div>
                <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-800 rounded w-2/3"></div>
            </div>
        );
    }

    if (error || !media) {
        return (
            <div className="p-6 text-center bg-gray-950 min-h-full">
                <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p className="text-gray-400">{error || '媒体不存在'}</p>
                <button
                    onClick={() => onNavigate('netdisk')}
                    className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                >
                    返回媒体库
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-4 bg-gray-950 min-h-full overflow-y-auto custom-scrollbar">
            {/* 顶部区域：播放器 + 剧集面板 */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* 左侧：播放器 */}
                <div className="flex-1 min-w-0">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                        <div className="w-full h-full" ref={playerRef}></div>

                        {/* 转码加载层 */}
                        {isTranscoding && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-white font-medium">正在启动实时转码...</p>
                                <p className="text-gray-400 text-sm mt-2">首次转码可能需要 5-10 秒，请稍候</p>
                            </div>
                        )}
                    </div>

                    {/* 控制条 */}
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => onGoBack ? onGoBack() : onNavigate('netdisk')}
                                className="px-3 py-2 sm:py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <i className="fas fa-arrow-left"></i>
                                <span className="hidden sm:inline">返回</span>
                            </button>
                            <div className="text-gray-400 text-sm flex-1 min-w-0">
                                <span className="hidden sm:inline">正在播放：</span>
                                <span className="text-white font-medium">{media.title}</span>
                            </div>
                        </div>

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
                                onClick={loadMediaDetail}
                                className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-sync-alt"></i>
                                刷新
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧：剧集网格面板 */}
                <div className="lg:w-72 xl:w-80 flex-shrink-0">
                    <div className="bg-gray-800/50 rounded-xl p-4 h-full max-h-[400px] lg:max-h-[calc(56.25vw*0.5+60px)] flex flex-col border border-white/5">
                        <h3 className="text-white font-medium mb-3 flex items-center justify-between">
                            <span>
                                <i className="fas fa-list-ol mr-2 text-red-400"></i>
                                剧集选集 ({media.video_files.length})
                            </span>
                        </h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {media.video_files.map((file, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedVideoIndex(idx)}
                                        className={`px-2 py-2.5 rounded text-sm transition-colors truncate ${selectedVideoIndex === idx
                                            ? 'bg-red-500 text-white font-medium shadow-lg'
                                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        title={file}
                                    >
                                        {file.includes('|') ? file.split('|')[0] : file}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 下方：NFO 信息 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-800/30 rounded-xl p-5 border border-white/5 space-y-4">
                        <h3 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-2">
                            <i className="fas fa-info-circle text-blue-400"></i>
                            媒体详情
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                            {renderMetadataRows()}
                        </div>

                        {media.actor && (
                            <div className="pt-4 border-t border-white/5">
                                <div className="text-gray-500 mb-2 flex items-center gap-2">
                                    <i className="fas fa-users text-xs"></i>
                                    主演阵容:
                                </div>
                                <p className="text-gray-300 leading-relaxed text-sm">{media.actor}</p>
                            </div>
                        )}
                    </div>

                    {media.overview && (
                        <div className="bg-gray-800/30 rounded-xl p-5 border border-white/5">
                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                <i className="fas fa-align-left text-green-400"></i>
                                剧情简介
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                                {media.overview}
                            </p>
                        </div>
                    )}
                </div>

                <div className="hidden lg:block">
                    <div className="bg-gray-800/30 rounded-xl p-2 border border-white/5 overflow-hidden">
                        {media.poster_url ? (
                            <img
                                src={media.poster_url.startsWith('http') ? `/api/plugins/video/api/proxy/image?url=${encodeURIComponent(media.poster_url)}` : media.poster_url}
                                alt={media.title}
                                className="w-full h-auto rounded-lg shadow-2xl filter brightness-90 hover:brightness-100 transition-all"
                                onError={e => (e.target as HTMLImageElement).src = '/poster-fallback.png'}
                            />
                        ) : (
                            <div className="aspect-[2/3] bg-gray-900 rounded-lg flex items-center justify-center text-gray-700">
                                <i className="fas fa-film text-6xl"></i>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
