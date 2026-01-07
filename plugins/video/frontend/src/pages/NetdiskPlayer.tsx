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
    const [playMethod, setPlayMethod] = useState<'hls' | 'proxy' | 'direct'>('hls');
    const [isFavorite, setIsFavorite] = useState(false);
    const [isTranscoding, setIsTranscoding] = useState(false);
    const [metaData, setMetaData] = useState<{ vCodec?: string, duration?: number }>({});

    // 💡 状态追踪 (使用 useRef 避免闭包陷阱!!)
    const maxCompletedIdxRef = useRef<number>(-1);
    const lastValidTimeRef = useRef<number>(0);

    const playerRef = useRef<HTMLDivElement>(null);
    const artPlayerRef = useRef<any>(null);
    const progressTimerRef = useRef<any>(null);
    const pollTimerRef = useRef<any>(null);
    const loadingTimeoutRef = useRef<any>(null);
    const transcodingSessionIdRef = useRef<string | null>(null);
    const hlsRef = useRef<any>(null);
    const isFirstFragLoadedRef = useRef(false);

    useEffect(() => {
        loadMediaDetail();
        checkFavoriteStatus();
        return () => {
            // 💡 关键修复：组件卸载（如点击返回按钮）时，通知后端停止转码
            if (transcodingSessionIdRef.current) {
                apiPost(`/transcode/${transcodingSessionIdRef.current}/stop`, {}).catch(() => { });
                transcodingSessionIdRef.current = null;
            }
            cleanupPlayer();
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [mediaId, sourceId]);

    const cleanupPlayer = () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        if (artPlayerRef.current) {
            artPlayerRef.current.destroy();
            artPlayerRef.current = null;
        }
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        isFirstFragLoadedRef.current = false;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        maxCompletedIdxRef.current = -1;
        lastValidTimeRef.current = 0;
    };

    useEffect(() => {
        if (media) {
            getPlayUrl(selectedVideoIndex);
        }
    }, [media, selectedVideoIndex]);

    useEffect(() => {
        if (playUrl) {
            initPlayer();
        }
    }, [playUrl, playMethod]);

    // 💡 每秒获取一次转码进度 (增加频率，让体验更实时)
    useEffect(() => {
        if (isTranscoding && transcodingSessionIdRef.current && playMethod === 'hls') {
            const poll = async () => {
                try {
                    const res = await apiGet<{ maxContinuousSegment: number }>(`/transcode/${transcodingSessionIdRef.current}/status`);
                    if (res.success && res.data) {
                        maxCompletedIdxRef.current = res.data.maxContinuousSegment;
                        console.log(`[Transcode Poll] maxCompletedIdx updated to: ${res.data.maxContinuousSegment}`);
                    }
                } catch (e) { }
            };
            pollTimerRef.current = setInterval(poll, 2000);
            return () => clearInterval(pollTimerRef.current);
        }
    }, [isTranscoding, playMethod, transcodingSessionIdRef.current]);

    useEffect(() => {
        const stopTranscoding = () => {
            if (transcodingSessionIdRef.current) {
                const url = `/api/plugins/video/api/transcode/${transcodingSessionIdRef.current}/stop`;
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
                } else {
                    apiPost(`/transcode/${transcodingSessionIdRef.current}/stop`, {}).catch(() => { });
                }
            }
        };

        window.addEventListener('beforeunload', stopTranscoding);
        return () => {
            stopTranscoding();
            window.removeEventListener('beforeunload', stopTranscoding);
        };
    }, []);

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
        if (transcodingSessionIdRef.current) {
            apiPost(`/transcode/${transcodingSessionIdRef.current}/stop`, {}).catch(() => { });
            transcodingSessionIdRef.current = null;
        }

        cleanupPlayer();
        setIsTranscoding(true);
        setPlayUrl(null);

        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
            setIsTranscoding(false);
        }, 12000);

        try {
            const res = await apiPost<{ playUrl: string, sessionId?: string, playMethod?: any, metadata?: any }>(`/netdisk/media/${mediaId}/play`, { videoIndex: index });
            if (res.success && res.data) {
                if (res.data.sessionId) {
                    transcodingSessionIdRef.current = res.data.sessionId;
                }
                setPlayMethod(res.data.playMethod || 'hls');
                setMetaData(res.data.metadata || {});
                setPlayUrl(res.data.playUrl);

                if (res.data.playMethod === 'proxy' || res.data.playMethod === 'direct') {
                    setIsTranscoding(false);
                    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
                }
            } else {
                setIsTranscoding(false);
                setError(res.error || '无法获取播放地址');
            }
        } catch (err) {
            console.error('Failed to get play URL:', err);
            setIsTranscoding(false);
            setError('获取播放地址网络请求失败');
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

        cleanupPlayer();

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
                    playsInline: true,
                },
                control: (playMethod === 'proxy' && metaData.vCodec && !['h264', 'avc1'].includes(metaData.vCodec.toLowerCase())) ? false : true,
            };

            if (metaData.duration) {
                playerConfig.duration = metaData.duration;
            }

            if (playMethod === 'hls') {
                playerConfig.type = 'm3u8';
                playerConfig.customType = {
                    m3u8: function (video: any, url: any) {
                        if (Hls.isSupported()) {
                            const hls = new Hls({
                                maxBufferLength: 60,  // 增加缓冲区
                                maxMaxBufferLength: 120,
                                enableWorker: true,
                                fragLoadingMaxRetry: 10,  // 增加重试次数
                                fragLoadingRetryDelay: 2000,  // 增加重试延迟
                                fragLoadingMaxRetryTimeout: 60000,  // 最大重试超时
                                manifestLoadingMaxRetry: 5,
                                levelLoadingMaxRetry: 5,
                                startLevel: 0,
                                // 💡 关键：增加分片加载超时，适应慢速转码
                                fragLoadingTimeOut: 60000,  // 60 秒超时
                                levelLoadingTimeOut: 30000,
                            });
                            hlsRef.current = hls;
                            hls.loadSource(url);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.FRAG_LOADED, () => {
                                if (!isFirstFragLoadedRef.current) {
                                    isFirstFragLoadedRef.current = true;
                                    setIsTranscoding(false);
                                }
                            });
                            // 注意：不再在 FRAG_LOADING 阶段拦截，因为会干扰正常的预加载
                            // 只通过 Artplayer 的 seek 事件拦截用户主动的拖动操作
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        }
                    }
                };
            }

            const player = new Artplayer(playerConfig);
            artPlayerRef.current = player;

            // 💡 监听播放进度，记录有效时间
            player.on('video:timeupdate', () => {
                const currentTime = player.currentTime;
                const targetIdx = Math.floor(currentTime / 10);
                const maxIdx = maxCompletedIdxRef.current;

                // 只有在已转码范围内，才更新有效位置
                if (maxIdx === -1) {
                    if (targetIdx === 0) lastValidTimeRef.current = currentTime;
                } else if (targetIdx <= maxIdx) {
                    lastValidTimeRef.current = currentTime;
                }
            });

            // 💡 简化策略：只在用户拖动到未转码区域时显示提示，不主动回弹
            // 让 HLS.js 自然处理（等待分片或超时），避免误触发导致的异常行为
            player.on('seeking', () => {
                if (playMethod === 'hls' && transcodingSessionIdRef.current) {
                    const currentTime = player.currentTime;
                    const targetIdx = Math.floor(currentTime / 10);
                    const maxIdx = maxCompletedIdxRef.current;
                    // 只显示提示，不回弹
                    if (maxIdx !== -1 && targetIdx > maxIdx + 2) {
                        player.notice.show = `⏳ 正在等待转码... (已就绪: ${(maxIdx + 1) * 10}s)`;
                    }
                }
            });

            player.on('video:canplay', () => {
                setIsTranscoding(false);
                if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            });

            player.on('ready', () => {
                if (playMethod !== 'hls') {
                    setIsTranscoding(false);
                    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
                }
            });

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

    const renderMetadataRows = () => {
        if (!media) return null;
        const rows: { label: string, value: any, key: string }[] = [];
        const data = media.extra_metadata || {};
        const coreDisplays = [
            { k: 'originaltitle', l: METADATA_LABELS.originaltitle },
            { k: 'genre', l: '类型' },
            { k: 'director', l: METADATA_LABELS.director },
            { k: 'year', l: METADATA_LABELS.year },
            { k: 'area', l: METADATA_LABELS.area },
            { k: 'rating', l: '评分' }
        ];
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
                }
                rows.push({ label: core.l, value: displayVal, key: core.k });
            }
        });
        return rows.map((row, idx) => (
            <div key={idx} className="flex items-start gap-2">
                <span className="text-gray-500 w-20 flex-shrink-0">{row.label}:</span>
                <div className="text-gray-300 break-words flex-1 min-w-0">{row.value}</div>
            </div>
        ));
    };

    if (loading) return <div className="p-6 text-white text-center">加载中...</div>;
    if (error || !media) return (
        <div className="p-6 text-red-500 text-center space-y-4">
            <p>{error || '加载失败'}</p>
            <button onClick={() => onNavigate('netdisk')} className="px-4 py-2 bg-gray-800 text-white rounded-lg">
                返回
            </button>
        </div>
    );

    return (
        <div className="p-4 lg:p-6 space-y-4 bg-gray-950 min-h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 min-w-0">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                        <div className="w-full h-full" ref={playerRef}></div>
                        {/* 💡 转码进度可视化 - 由于使用 ref，需要单独状态驱动 UI */}
                        {isTranscoding && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-white font-medium">正在建立智能极速播放链路...</p>
                                <p className="text-gray-400 text-sm mt-2">
                                    {playMethod === 'hls' ? '服务器正在准备转推流数据' : '正在解析远程加速地址'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:w-72 xl:w-80 flex-shrink-0">
                    <div className="bg-gray-800/50 rounded-xl p-4 h-full max-h-[400px] lg:max-h-[calc(56.25vw*0.5+60px)] flex flex-col border border-white/5 overflow-y-auto">
                        <h3 className="text-white font-medium mb-3">选集 ({media.video_files.length})</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {media.video_files.map((file, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedVideoIndex(idx);
                                        setIsTranscoding(true);
                                    }}
                                    className={`px-3 py-2 text-left rounded-lg text-sm transition-all ${selectedVideoIndex === idx ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    P{idx + 1}: {file.split('|')[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => onGoBack ? onGoBack() : onNavigate('netdisk')} className="p-2 text-gray-400 hover:text-white">
                            <i className="fas fa-arrow-left"></i>
                        </button>
                        <h1 className="text-2xl font-bold text-white">{media.title}</h1>
                    </div>
                    <button onClick={toggleFavorite} className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-red-500' : 'text-gray-500'}`}>
                        <i className={`fas fa-heart ${isFavorite ? 'fas' : 'far'}`}></i>
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                    {renderMetadataRows()}
                </div>
                <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {media.overview}
                </div>
            </div>
        </div>
    );
}
