import { useState, useEffect } from 'react';
import { Favorite } from '../types';
import { apiGet, apiDelete } from '../utils/api';

interface FavoritesProps {
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

export function Favorites({ onNavigate }: FavoritesProps) {
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        setLoading(true);
        const res = await apiGet<Favorite[]>('/favorites');
        if (res.success && res.data) {
            setFavorites(res.data);
        }
        setLoading(false);
    };

    const handleRemove = async (id: number) => {
        const res = await apiDelete(`/favorites/${id}`);
        if (res.success) {
            setFavorites(prev => prev.filter(f => f.id !== id));
        }
    };

    const handleClick = (fav: Favorite) => {
        onNavigate('play', {
            sourceId: fav.source_id,
            vodId: fav.vod_id
        });
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-8 bg-gray-800 rounded w-32 mb-6"></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-white">我的收藏</h1>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {favorites.map(fav => (
                        <div
                            key={fav.id}
                            className="video-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
                        >
                            <div
                                className="relative"
                                onClick={() => handleClick(fav)}
                            >
                                <img
                                    src={fav.cover}
                                    alt={fav.title}
                                    className="video-cover w-full"
                                    loading="lazy"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,...';
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                                              transition-opacity flex items-center justify-center">
                                    <i className="fas fa-play text-3xl text-white"></i>
                                </div>
                                {fav.source_name && (
                                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 
                                                   text-xs text-white rounded">
                                        {fav.source_name}
                                    </span>
                                )}
                            </div>
                            <div className="p-3">
                                <h3 className="text-white text-sm font-medium line-clamp-1">
                                    {fav.title}
                                </h3>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-gray-500 text-xs">{fav.year}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(fav.id);
                                        }}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <i className="fas fa-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-heart text-4xl mb-4 opacity-50"></i>
                    <p>暂无收藏</p>
                    <p className="text-sm mt-2">浏览视频时点击爱心图标添加收藏</p>
                </div>
            )}
        </div>
    );
}
