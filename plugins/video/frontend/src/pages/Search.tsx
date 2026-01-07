import { useState, useEffect } from 'react';
import { Video, VideoSource } from '../types';
import { VideoCard } from '../components/VideoCard';

interface SearchProps {
    initialKeyword?: string;
    sourceId?: number | null;  // 新增：指定视频源，null 表示全部
    sources?: VideoSource[];   // 新增：用于显示来源名称
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

export function Search({ initialKeyword, sourceId, sources = [], onNavigate }: SearchProps) {
    const [results, setResults] = useState<Video[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [currentKeyword, setCurrentKeyword] = useState(initialKeyword || '');
    const [searchingSource, setSearchingSource] = useState<string>('');
    const [isFinished, setIsFinished] = useState(false);
    const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });

    // 执行搜索
    const doSearch = async (kw: string, srcId: number | null) => {
        if (!kw.trim()) return;

        setLoading(true);
        setSearched(true);
        setIsFinished(false);
        setResults([]);
        setSearchProgress({ current: 0, total: sources.length || 1 });
        setSearchingSource('正在初始化搜索...');
        setCurrentKeyword(kw);

        try {
            const token = localStorage.getItem('auth_token');
            let adminPassword = '';
            try {
                const authData = localStorage.getItem('video_admin_auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
                        adminPassword = parsed.password || '';
                    }
                }
            } catch (e) { /* ignore */ }

            // 修正 API 路径，确保与 api.ts 一致
            const url = new URL(`${window.location.origin}/api/plugins/video/api/videos/search`);
            url.searchParams.append('keyword', kw.trim());
            url.searchParams.append('stream', 'true');
            if (srcId !== null && srcId !== undefined) {
                url.searchParams.append('source_id', String(srcId));
            }

            const response = await fetch(url.toString(), {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {}),
                    'X-No-Compression': 'true' // 核心：告诉后端不要压缩，防止 SSE 缓冲
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
                            setIsFinished(true);
                            setSearchingSource('');
                            continue;
                        }

                        try {
                            const message = JSON.parse(dataStr);
                            if (message.type === 'results' && Array.isArray(message.data)) {
                                setResults(prev => [...prev, ...message.data]);
                                setSearchingSource(`正在从 ${message.source} 获取结果...`);
                                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
                            } else if (message.type === 'error') {
                                console.warn(`[Search] Error from source ${message.source}:`, message.error);
                                setSearchingSource(`${message.source} 搜索失败，继续其它源...`);
                                setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
                            }
                        } catch (e) {
                            console.error('[Search] Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Search] Failed:', error);
            setSearchingSource('搜索出错');
        } finally {
            setLoading(false);
            setSearchingSource('');
        }
    };

    // 当关键词或源变化时执行搜索
    useEffect(() => {
        if (initialKeyword) {
            doSearch(initialKeyword, sourceId ?? null);
        }
    }, [initialKeyword, sourceId]);

    const handleVideoClick = (video: Video) => {
        onNavigate('play', {
            sourceId: video.source_id,
            vodId: video.vod_id
        });
    };

    // 获取视频源名称
    const getSourceName = (srcId: number) => {
        const source = sources.find(s => s.id === srcId);
        return source?.name || `源${srcId}`;
    };

    // 获取当前搜索范围描述
    const getSearchScope = () => {
        if (sourceId === null || sourceId === undefined) {
            return '全部视频源';
        }
        return getSourceName(sourceId);
    };

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* 正在搜索状态 */}
            {(loading || searchingSource) && !isFinished && (
                <div className="glass-effect border border-border-color rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-5 h-5 border-2 border-blue-500/20 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <span className="text-primary font-bold text-sm tracking-tight">{searchingSource}</span>
                        </div>
                        <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                            <span className="text-blue-400 text-xs font-black">
                                已发现 {results.length}
                            </span>
                        </div>
                    </div>
                    {/* 进度条 */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                            style={{
                                width: sources.length ? `${(results.length > 0 ? (searchProgress.current / sources.length) * 100 : 5)}%` : '5%'
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {/* 搜索状态提示 */}
            {currentKeyword && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-secondary opacity-60">搜索范围</span>
                        <span className="px-2.5 py-0.5 bg-secondary/40 text-primary rounded-lg border border-border-color font-bold text-xs">
                            {getSearchScope()}
                        </span>
                        <div className="h-3 w-px bg-white/10 mx-1"></div>
                        <span className="text-secondary opacity-60">关键词</span>
                        <span className="text-blue-500 font-black">"{currentKeyword}"</span>
                    </div>
                    {isFinished && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary opacity-40">
                            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                            COMPLETED
                        </div>
                    )}
                </div>
            )}

            {/* 搜索结果 */}
            {loading && results.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-secondary/20 rounded-2xl border border-border-color animate-pulse overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        </div>
                    ))}
                </div>
            ) : searched ? (
                results.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-secondary">
                            找到 <span className="text-primary font-medium">{results.length}</span> 个相关结果
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {results.map((video, idx) => (
                                <VideoCard
                                    key={`${video.source_id}-${video.vod_id}-${idx}`}
                                    video={video}
                                    onClick={() => handleVideoClick(video)}
                                    showSource
                                    sourceName={video.source_id ? getSourceName(video.source_id) : undefined}
                                />
                            ))}
                        </div>
                        {!isFinished && results.length > 0 && (
                            <div className="flex justify-center py-8">
                                <div className="flex items-center gap-2 text-secondary bg-secondary/30 px-4 py-2 rounded-full border border-border-color">
                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm italic">更多结果正在加载中...</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : !loading && isFinished ? (
                    <div className="text-center py-32 glass-effect rounded-3xl border border-border-color space-y-4">
                        <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center border border-border-color mb-2">
                            <i className="fas fa-search-minus text-3xl text-secondary opacity-30"></i>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-primary">未找到结果</h3>
                            <p className="text-secondary text-sm opacity-50">尝试更换关键词或检查视频源状态</p>
                        </div>
                    </div>
                ) : null
            ) : (
                <div className="text-center py-40 space-y-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full"></div>
                        <i className="fas fa-compass text-7xl text-blue-500/40 relative z-10 animate-bounce"></i>
                    </div>
                    <div className="space-y-2">
                        <p className="text-primary text-2xl font-black tracking-tight">探索精彩内容</p>
                        <p className="text-secondary text-sm opacity-60">支持全网 50+ 资源站同步搜索</p>
                    </div>
                </div>
            )}
        </div>
    );
}

