import { useState, useEffect } from 'react';
import { Video, VideoSource } from '../types';
import { apiGet } from '../utils/api';
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

    // 执行搜索
    const doSearch = async (kw: string, srcId: number | null) => {
        if (!kw.trim()) return;

        setLoading(true);
        setSearched(true);
        setCurrentKeyword(kw);

        try {
            const params: Record<string, unknown> = {
                keyword: kw.trim()
            };
            // 如果指定了视频源，添加 source_id 参数
            if (srcId !== null && srcId !== undefined) {
                params.source_id = srcId;
            }

            const res = await apiGet<Video[]>('/videos/search', params);

            if (res.success && res.data) {
                setResults(res.data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error('[Search] Failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
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
            {/* 搜索状态提示 */}
            {currentKeyword && (
                <div className="flex items-center gap-2 text-gray-400">
                    <span>在</span>
                    <span className="text-blue-400 font-medium">{getSearchScope()}</span>
                    <span>中搜索</span>
                    <span className="text-white font-medium">"{currentKeyword}"</span>
                </div>
            )}

            {/* 搜索结果 */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                    ))}
                </div>
            ) : searched ? (
                results.length > 0 ? (
                    <div>
                        <p className="text-gray-400 mb-4">
                            找到 <span className="text-white">{results.length}</span> 个相关结果
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {results.map(video => (
                                <VideoCard
                                    key={`${video.source_id}-${video.vod_id}`}
                                    video={video}
                                    onClick={() => handleVideoClick(video)}
                                    showSource
                                    sourceName={video.source_id ? getSourceName(video.source_id) : undefined}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                        <p>未找到相关结果</p>
                        <p className="text-sm mt-2">尝试搜索其他关键词或切换视频源</p>
                    </div>
                )
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                    <p>使用顶部搜索栏开始搜索</p>
                </div>
            )}
        </div>
    );
}

