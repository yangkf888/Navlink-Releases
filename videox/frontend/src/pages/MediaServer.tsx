import { useState, useEffect } from 'react';
import { apiGet } from '../utils/api';

interface MediaServerProps {
    serverId?: number;
    categoryId?: string;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

interface Library {
    Id: string;
    Name: string;
    CollectionType: string;
}

interface MediaItem {
    Id: string;
    Name: string;
    Type: string;
    ImageTags: {
        Primary: string;
    };
    ProductionYear?: number;
    Overview?: string;
    MediaType?: string;
    Container?: string;
}

export function MediaServer({ serverId, categoryId, onNavigate }: MediaServerProps) {
    const [loading, setLoading] = useState(false);
    const [server, setServer] = useState<any>(null);
    const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
    const [items, setItems] = useState<MediaItem[]>([]);

    // 1. 监听 serverId 变化，加载服务器信息和分类列表
    useEffect(() => {
        if (serverId) {
            loadServerData();
        }
    }, [serverId]);

    // 2. 监听外部传入的 categoryId 变化
    useEffect(() => {
        if (categoryId) {
            setSelectedLibraryId(categoryId);
        }
    }, [categoryId]);

    // 3. 监听内部选中的 selectedLibraryId 变化，加载具体项目
    useEffect(() => {
        if (serverId && selectedLibraryId) {
            loadItems(selectedLibraryId);
        }
    }, [serverId, selectedLibraryId]);

    const loadServerData = async () => {
        setLoading(true);
        try {
            // 获取所有媒体服务器并找到当前选中的
            const serversRes = await apiGet<any[]>('/media-servers');
            if (serversRes.success && serversRes.data) {
                const s = serversRes.data.find(item => item.id === serverId);
                setServer(s);
            }

            // 获取分类列表（之前用于展示 Tab，现在主要由侧边栏控制）
            const libRes = await apiGet<Library[]>(`/media-servers/${serverId}/libraries`);
            if (libRes.success && libRes.data) {
                // 如果外部没有传 categoryId，则默认选中第一个
                if (!categoryId && libRes.data.length > 0) {
                    setSelectedLibraryId(libRes.data[0].Id);
                }
            }
        } catch (error) {
            console.error('Failed to load server data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadItems = async (libraryId: string) => {
        try {
            setLoading(true);
            const res = await apiGet<any>(`/media-servers/${serverId}/items?parentId=${libraryId}&limit=100`);
            if (res.success && res.data) {
                console.log('[MediaServer] Loaded items. Types in list:', [...new Set(res.data.Items?.map((i: any) => i.Type))]);
                setItems(res.data.Items || []);
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (item: MediaItem) => {
        try {
            const res = await apiGet<any>(`/media-servers/${serverId}/playback/${item.Id}`);
            if (res.success && res.data.streamUrl) {
                onNavigate('media_server_play', {
                    mediaServerId: serverId,
                    vodId: item.Id,
                    title: item.Name,
                    url: res.data.streamUrl,
                    cover: getPosterUrl(item)
                });
            } else {
                alert(res.error || '获取播放地址失败');
            }
        } catch (error) {
            console.error('Failed to get playback info:', error);
        }
    };

    const getPosterUrl = (item: MediaItem) => {
        if (!item.ImageTags.Primary || !server) return '';
        return `${server.url}/emby/Items/${item.Id}/Images/Primary?maxWidth=300&tag=${item.ImageTags.Primary}&api_key=${server.api_key}`;
    };

    if (!serverId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-secondary">
                <i className="fas fa-film text-6xl opacity-10 mb-4"></i>
                <p>请在左侧选择一个影视库</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <i className={`fas ${server?.type === 'emby' ? 'fa-play-circle' : 'fa-server'} text-2xl`}></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-primary">{server?.name || '影视库'}</h2>
                        <div className="text-secondary opacity-60 flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] uppercase font-black tracking-widest border border-white/10">{server?.type}</span>
                            <span className="text-xs truncate max-w-[200px]">{server?.url}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Poster Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-[40vh]">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                    {items.map(item => (
                        <div
                            key={item.Id}
                            className="group relative cursor-pointer"
                            title={item.Name}
                            onClick={() => handlePlay(item)}
                        >
                            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg group-hover:shadow-blue-500/10 active:scale-95">
                                {item.ImageTags.Primary ? (
                                    <img
                                        src={getPosterUrl(item)}
                                        alt={item.Name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-secondary opacity-20">
                                        <i className="fas fa-image text-4xl"></i>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <p className="text-white text-[10px] font-bold line-clamp-2">{item.Name}</p>
                                </div>
                            </div>
                            <div className="mt-2 px-1">
                                <p className="text-xs font-bold text-primary truncate group-hover:text-blue-500 transition-colors uppercase tracking-tight">{item.Name}</p>
                                <p className="text-[10px] text-secondary opacity-50">{item.ProductionYear || '未知年份'}</p>
                            </div>
                        </div>
                    ))}

                    {items.length === 0 && (
                        <div className="col-span-full py-20 text-center glass-effect rounded-3xl border border-dashed border-border-color">
                            <i className="fas fa-inbox text-4xl opacity-10 mb-4 block"></i>
                            <p className="text-secondary opacity-40">此媒体库暂无内容</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
