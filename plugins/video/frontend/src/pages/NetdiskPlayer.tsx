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

    useEffect(() => {
        if (isTranscoding && transcodingSessionIdRef.current && playMethod === 'hls') {
            const poll = async () => {
                try {
                    const res = await apiGet<{ maxContinuousSegment: number }>(`/transcode/${transcodingSessionIdRef.current}/status`);
                    if (res.success && res.data) {
                        maxCompletedIdxRef.current = res.data.maxContinuousSegment;
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
        } catch (err) { }
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
        } catch (err) { }
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
                theme: '#3b82f6',
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
                                maxBufferLength: 60,
                                maxMaxBufferLength: 120,
                                enableWorker: true,
                                fragLoadingMaxRetry: 10,
                                fragLoadingRetryDelay: 2000,
                                fragLoadingMaxRetryTimeout: 60000,
                                manifestLoadingMaxRetry: 5,
                                levelLoadingMaxRetry: 5,
                                startLevel: 0,
                                fragLoadingTimeOut: 60000,
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
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        }
                    }
                };
            }

            const player = new Artplayer(playerConfig);
            artPlayerRef.current = player;

            player.on('video:timeupdate', () => {
                const currentTime = player.currentTime;
                const targetIdx = Math.floor(currentTime / 10);
                const maxIdx = maxCompletedIdxRef.current;

                if (maxIdx === -1) {
                    if (targetIdx === 0) lastValidTimeRef.current = currentTime;
                } else if (targetIdx <= maxIdx) {
                    lastValidTimeRef.current = currentTime;
                }
            });

            player.on('seeking', () => {
                if (playMethod === 'hls' && transcodingSessionIdRef.current) {
                    const currentTime = player.currentTime;
                    const targetIdx = Math.floor(currentTime / 10);
                    const maxIdx = maxCompletedIdxRef.current;
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
        } catch (err) { }
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
                <span className="text-secondary/50 w-20 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider">{row.label}</span>
                <div className="text-primary break-words flex-1 min-w-0 text-sm font-medium">{row.value}</div>
            </div>
        ));
    };

    if (loading) return <div className="p-6 text-primary text-center">加载中...</div>;
    if (error || !media) return (
        <div className="p-6 text-red-500 text-center space-y-4">
            <p>{error || '加载失败'}</p>
            <button onClick={() => onNavigate('netdisk')} className="px-6 py-2 bg-secondary text-primary rounded-xl">
                返回
            </button>
        </div>
    );

    return (
        <div className="relative h-full overflow-hidden bg-primary">
            {/* 氛围感背景层 */}
            {media.poster_url && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
                    <img
                        src={media.poster_url}
                        className="w-full h-full object-cover blur-[100px] scale-125 transition-opacity duration-1000"
                        alt="bg"
                    />
                </div>
            )}

            <div className="relative z-10 p-4 lg:p-6 h-full overflow-y-auto custom-scrollbar space-y-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
                            <div className="w-full h-full" ref={playerRef}></div>
                            {isTranscoding && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-primary font-medium">正在建立智能极速播放链路...</p>
                                    <p className="text-secondary text-sm mt-2 opacity-60">
                                        {playMethod === 'hls' ? '服务器正在准备转推流数据' : '正在解析远程加速地址'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:w-80 xl:w-96 flex-shrink-0">
                        <div className="bg-secondary/40 backdrop-blur-xl rounded-2xl p-5 h-full max-h-[400px] lg:max-h-[calc(56.25vw*0.5+80px)] flex flex-col border border-border-color shadow-xl transition-all duration-300">
                            <h3 className="text-primary font-bold mb-4 flex items-center gap-2">
                                <i className="fas fa-list-ul text-blue-400 text-sm"></i>
                                选集 ({media.video_files.length})
                            </h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                                <div className="grid grid-cols-1 gap-2.5">
                                    {media.video_files.map((file, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setSelectedVideoIndex(idx);
                                                setIsTranscoding(true);
                                            }}
                                            className={`px-4 py-4 text-left rounded-xl text-xs font-semibold transition-all duration-300 ${selectedVideoIndex === idx
                                                    ? 'bg-blue-600 text-primary shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
                                                    : 'bg-white/5 text-secondary hover:bg-white/10 hover:text-primary border border-border-color'
                                                }`}
                                        >
                                            <span className="opacity-40 mr-3 text-[10px]">P{idx + 1}</span>
                                            {file.split('|')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border-color">
                        <div className="flex items-center gap-4">
                            <button onClick={() => onGoBack ? onGoBack() : onNavigate('netdisk')} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-secondary hover:text-primary transition-all border border-border-color">
                                <i className="fas fa-arrow-left"></i>
                            </button>
                            <h1 className="text-2xl font-bold text-primary tracking-tight">{media.title}</h1>
                        </div>
                        <button onClick={toggleFavorite} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all border ${isFavorite ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-white/5 border-border-color text-secondary hover:text-primary'}`}>
                            <i className={`${isFavorite ? 'fas' : 'far'} fa-heart text-sm`}></i>
                        </button>
                    </div>

                    <div className="bg-secondary/30 backdrop-blur-md rounded-2xl p-6 border border-border-color shadow-lg space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
                            {renderMetadataRows()}
                        </div>
                        {media.overview && (
                            <div className="pt-6 border-t border-border-color">
                                <p className="opacity-40 font-bold text-[11px] uppercase tracking-wider mb-2">简介</p>
                                <p className="text-secondary text-sm leading-relaxed font-medium opacity-80">{media.overview}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
