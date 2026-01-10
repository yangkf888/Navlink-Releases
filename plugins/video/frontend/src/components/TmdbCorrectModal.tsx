import { useState, useEffect } from 'react';
import { apiPost } from '../utils/api';

interface TmdbResult {
    id: number;
    title: string;
    original_title: string;
    media_type: 'movie' | 'tv';
    release_date?: string;
    first_air_date?: string;
    poster_path?: string;
    overview: string;
    vote_average: number;
}

interface TmdbCorrectModalProps {
    mediaId: number;
    initialQuery: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function TmdbCorrectModal({ mediaId, initialQuery, isOpen, onClose, onSuccess }: TmdbCorrectModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<TmdbResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState<number | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await apiPost<TmdbResult[]>(`/netdisk/media/${mediaId}/tmdb-search`, { query });
            if (res.success && res.data) {
                setResults(res.data);
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (tmdbId: number, type: string) => {
        setApplying(tmdbId);
        try {
            const res = await apiPost(`/netdisk/media/${mediaId}/tmdb-apply`, {
                tmdb_id: tmdbId,
                media_type: type
            });
            if (res.success) {
                onSuccess();
                onClose();
            } else {
                alert('应用失败: ' + res.error);
            }
        } catch (err) {
            alert('请求异常');
        } finally {
            setApplying(null);
        }
    };

    useEffect(() => {
        if (isOpen && initialQuery) {
            setQuery(initialQuery);
            handleSearch();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-secondary/95 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* 头部 */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                        <i className="fas fa-magic text-blue-400"></i>
                        识别修正
                    </h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>

                {/* 搜索栏 */}
                <div className="p-6 pb-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-secondary"></i>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="输入影视名称进行搜索..."
                                className="w-full pl-12 pr-4 py-3 bg-white/5 text-primary rounded-xl border border-white/10 
                                         focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : '搜 索'}
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-secondary/60 flex items-center gap-1">
                        <i className="fas fa-info-circle"></i>
                        提示：修正后系统将锁定该记录，不再自动更新数据。
                    </p>
                </div>

                {/* 结果列表 */}
                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 custom-scrollbar">
                    {results.length === 0 && !loading && (
                        <div className="py-20 text-center text-secondary opacity-50">
                            <i className="fas fa-search text-4xl mb-4"></i>
                            <p>输入关键词开始重新匹配</p>
                        </div>
                    )}

                    {results.map((item) => (
                        <div
                            key={`${item.media_type}-${item.id}`}
                            className="group flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/50 hover:bg-white/10 transition-all duration-300"
                        >
                            <div className="w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 bg-secondary shadow-lg">
                                {item.poster_path ? (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-secondary">
                                        <i className="fas fa-image"></i>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-primary font-bold truncate text-base sm:text-lg" title={item.title}>
                                            {item.title || item.original_title}
                                        </h3>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${item.media_type === 'movie' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                            {item.media_type === 'movie' ? '电影' : '剧集'}
                                        </span>
                                    </div>
                                    <div className="text-secondary text-xs mb-2 flex items-center gap-3">
                                        <span>{(item.release_date || item.first_air_date || '').split('-')[0]}</span>
                                        <span className="flex items-center gap-1 text-yellow-500/80">
                                            <i className="fas fa-star text-[10px]"></i>
                                            {item.vote_average.toFixed(1)}
                                        </span>
                                    </div>
                                    <p className="text-secondary/80 text-xs line-clamp-2 leading-relaxed">
                                        {item.overview || '暂无简介...'}
                                    </p>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleApply(item.id, item.media_type)}
                                        disabled={applying !== null}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all
                                                  ${applying === item.id
                                                ? 'bg-blue-600/50 text-white animate-pulse'
                                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                                    >
                                        {applying === item.id ? '正在应用...' : '应用匹配'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
