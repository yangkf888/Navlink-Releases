import { useState, useEffect, useMemo } from 'react';
import { PlayHistory, VideoSource, NetdiskSource } from '../types';
import { apiGet, apiDelete } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface HistoryProps {
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    sources: VideoSource[];
    netdiskSources: NetdiskSource[];
}

export function History({ onNavigate, sources, netdiskSources }: HistoryProps) {
    const { isAuthenticated } = useAuth();
    const [history, setHistory] = useState<PlayHistory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        const res = await apiGet<PlayHistory[]>('/history', { limit: 50 });
        if (res.success && res.data) {
            setHistory(res.data);
        }
        setLoading(false);
    };

    // 过滤观看历史内容：未登录时隐藏来自“隐藏源”的内容
    const filteredHistory = useMemo(() => {
        if (isAuthenticated) return history;

        // 获取所有隐藏源的 ID
        const hiddenCmsIds = new Set(sources.filter(s => s.hidden).map(s => s.id));
        const hiddenNetdiskIds = new Set(netdiskSources.filter(s => s.hidden).map(s => s.id));

        return history.filter(item => {
            if (item.source_type === 'netdisk') {
                return !hiddenNetdiskIds.has(item.source_id);
            }
            // 默认为 cms 资源站
            return !hiddenCmsIds.has(item.source_id);
        });
    }, [history, isAuthenticated, sources, netdiskSources]);

    const clearAll = async () => {
        if (!confirm('确定要清空所有播放记录吗？')) return;

        const res = await apiDelete('/history');
        if (res.success) {
            setHistory([]);
        }
    };

    const handleClick = (item: PlayHistory) => {
        if (item.source_type === 'netdisk') {
            onNavigate('netdisk_play', {
                sourceId: item.source_id,
                mediaId: parseInt(item.vod_id),
                videoIndex: item.episode - 1
            });
        } else {
            onNavigate('play', {
                sourceId: item.source_id,
                vodId: item.vod_id
            });
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString();
    };

    const formatProgress = (progress: number, duration: number) => {
        if (!duration) return '';
        const percent = Math.round((progress / duration) * 100);
        return `${percent}%`;
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-8 bg-gray-800 rounded w-32 mb-6"></div>
                <div className="space-y-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="w-32 h-20 bg-gray-800 rounded"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-5 bg-gray-800 rounded w-1/3"></div>
                                <div className="h-4 bg-gray-800 rounded w-1/4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 未登录硬拦截
    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                    <i className="fas fa-lock text-3xl"></i>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">访问受限</h2>
                <p className="mb-6">请先登录管理员账号以查看播放记录</p>
                <button
                    onClick={() => onNavigate('home')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    返回首页
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">播放历史</h1>
                {filteredHistory.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-gray-400 hover:text-red-400 text-sm"
                    >
                        <i className="fas fa-trash mr-1"></i>
                        清空全部
                    </button>
                )}
            </div>

            {filteredHistory.length > 0 ? (
                <div className="space-y-3">
                    {filteredHistory.map(item => (
                        <div
                            key={item.id}
                            onClick={() => handleClick(item)}
                            className="flex gap-4 p-3 bg-gray-800/50 rounded-lg cursor-pointer 
                                     hover:bg-gray-800 transition-colors"
                        >
                            {/* 封面 */}
                            <div className="relative w-28 flex-shrink-0">
                                <img
                                    src={item.cover}
                                    alt={item.title}
                                    className="w-full aspect-video object-cover rounded"
                                    loading="lazy"
                                />
                                {/* 进度条 */}
                                {item.duration > 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                                        <div
                                            className="h-full bg-red-500"
                                            style={{ width: `${(item.progress / item.duration) * 100}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>

                            {/* 信息 */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium line-clamp-1">
                                    {item.title}
                                </h3>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                                    {item.episode_name && (
                                        <span>看到 {item.episode_name}</span>
                                    )}
                                    {item.duration > 0 && (
                                        <span>{formatProgress(item.progress, item.duration)}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    {item.source_name && <span>{item.source_name}</span>}
                                    <span>{formatTime(item.updated_at)}</span>
                                </div>
                            </div>

                            {/* 继续播放 */}
                            <div className="flex items-center">
                                <i className="fas fa-play-circle text-2xl text-gray-500 group-hover:text-red-400"></i>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-history text-4xl mb-4 opacity-50"></i>
                    <p>暂无播放记录</p>
                </div>
            )}
        </div>
    );
}
