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
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-gray-200 font-medium">{searchingSource}</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                            已找到 {results.length} 个结果
                        </span>
                    </div>
                    {/* 进度条 */}
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500 ease-out"
                            style={{
                                width: sources.length ? `${(results.length > 0 ? (searchProgress.current / sources.length) * 100 : 5)}%` : '5%'
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {/* 搜索状态提示 */}
            {currentKeyword && (
                <div className="flex items-center justify-between text-gray-400">
                    <div className="flex items-center gap-2">
                        <span>在</span>
                        <span className="text-blue-400 font-medium">{getSearchScope()}</span>
                        <span>中搜索</span>
                        <span className="text-white font-medium">"{currentKeyword}"</span>
                    </div>
                    {isFinished && (
                        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-500">
                            搜索完成
                        </span>
                    )}
                </div>
            )}

            {/* 搜索结果 */}
            {loading && results.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                    ))}
                </div>
            ) : searched ? (
                results.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-gray-400">
                            找到 <span className="text-white font-medium">{results.length}</span> 个相关结果
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
                                <div className="flex items-center gap-2 text-gray-500 bg-gray-800/30 px-4 py-2 rounded-full border border-gray-800">
                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm italic">更多结果正在加载中...</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : !loading && isFinished ? (
                    <div className="text-center py-20 bg-gray-800/20 rounded-2xl border border-dashed border-gray-800">
                        <i className="fas fa-search text-5xl mb-4 text-gray-700"></i>
                        <p className="text-gray-400 text-lg">未找到相关结果</p>
                        <p className="text-sm text-gray-600 mt-2">尝试更换关键词或检查视频源状态</p>
                    </div>
                ) : null
            ) : (
                <div className="text-center py-20 opacity-50">
                    <i className="fas fa-search text-6xl mb-6 text-gray-800"></i>
                    <p className="text-gray-500 text-lg font-medium">输入关键词并按回车开始探索</p>
                    <p className="text-gray-600 text-sm mt-2">支持全网 50+ 资源站同步搜索</p>
                </div>
            )}
        </div>
    );
}

