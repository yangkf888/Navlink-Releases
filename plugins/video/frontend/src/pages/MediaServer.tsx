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
    ImageTags?: {
        Primary?: string;
    };
}

interface MediaItem {
    Id: string;
    Name: string;
    Type: string;
    ImageTags: {
        Primary: string;
        Thumb?: string;
    };
    ProductionYear?: number;
    Overview?: string;
    MediaType?: string;
    Container?: string;
    UserData?: {
        PlayedPercentage?: number;
    };
    SeriesName?: string;
    IndexNumber?: number;
}

interface HomeSection {
    title: string;
    id: string;
    type: string;
    items: MediaItem[];
}

/**
 * 🎬 Emby 首页动态视图组件
 * 核心：不再死板，Emby 首页有什么板块，这里同步拉取并展示什么板块
 */
function MediaServerHomeView({ server, onPlay }: { server: any, onPlay: (item: any) => void }) {
    const [resumeItems, setResumeItems] = useState<MediaItem[]>([]);
    const [sections, setSections] = useState<HomeSection[]>([]);
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (server) {
            loadHomeData();
        }
    }, [server]);

    const loadHomeData = async () => {
        setLoading(true);
        try {
            // 1. 获取动态聚合首页数据
            const homeRes = await apiGet<{ resume: MediaItem[], sections: HomeSection[] }>(`/media-servers/${server.id}/home`);
            if (homeRes.success && homeRes.data) {
                setResumeItems(homeRes.data.resume || []);
                setSections(homeRes.data.sections || []);
            }

            // 2. 获取媒体库列表（用于顶部入口方格）
            const libRes = await apiGet<Library[]>(`/media-servers/${server.id}/libraries`);
            if (libRes.success) {
                setLibraries(libRes.data || []);
            }
        } catch (error) {
            console.error('Failed to load dynamic home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPosterUrl = (item: any, type: 'Primary' | 'Thumb' = 'Primary', width = 300) => {
        const tag = type === 'Thumb' ? (item.ImageTags?.Thumb || item.ImageTags?.Primary) : item.ImageTags?.Primary;
        if (!tag || !server) return '';
        return `${server.url}/emby/Items/${item.Id}/Images/${type}?maxWidth=${width}&tag=${tag}&api_key=${server.api_key}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[2000px] mx-auto">

            {/* 1. 顶部媒体库彩色入口 (同步 Emby) */}
            {libraries.length > 0 && (
                <section className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {libraries.map(lib => (
                            <div
                                key={lib.Id}
                                className="group relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-blue-500/50 transition-all shadow-lg active:scale-95"
                                onClick={() => {
                                    // 点击媒体库方格，相当于侧边栏点击具体库
                                    window.location.hash = `#media_server?serverId=${server.id}&categoryId=${lib.Id}`;
                                    // 实际上应该通过 onNavigate，但这里简单起见，且由于是在 MediaServer 内部，
                                    // 我们需要确保点击后组件重绘。父组件 MediaServer 会通过 useEffect(categoryId) 监听到。
                                    // 我们可以直接操作 URL 或者更好的方式是通过 Props 传回。
                                    // 这里我们给它一个更直接的体验
                                }}
                            >
                                {lib.ImageTags?.Primary ? (
                                    <img
                                        src={getPosterUrl(lib, 'Primary', 400)}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-60"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                                        <i className="fas fa-folder text-3xl opacity-20"></i>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                                    <span className="text-white font-black text-lg tracking-widest drop-shadow-md">{lib.Name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 2. 继续观看 (横海报) */}
            {resumeItems.length > 0 && (
                <section className="space-y-4">
                    <h3 className="text-xl font-black text-primary flex items-center gap-2">
                        <i className="fas fa-history text-blue-500"></i>
                        继续观看
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {resumeItems.map(item => (
                            <div key={item.Id} className="flex-shrink-0 w-[280px] group cursor-pointer" onClick={() => onPlay(item)}>
                                <div className="aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg relative">
                                    <img src={getPosterUrl(item, 'Thumb', 400)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    {item.UserData?.PlayedPercentage !== undefined && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                            <div className="h-full bg-blue-500" style={{ width: `${item.UserData.PlayedPercentage}%` }}></div>
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-xs font-bold truncate">{item.SeriesName || item.Name}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 3. 动态 Section 列表 (同步 Emby 排序) */}
            {sections.map(section => (
                <section key={section.id} className="space-y-4">
                    <h3 className="text-xl font-black text-primary flex items-center gap-2">
                        <i className={`fas ${section.type === 'tvshows' ? 'fa-tv' : 'fa-film'} opacity-50 text-sm`}></i>
                        最新{section.title}
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {section.items.map(item => (
                            <div
                                key={item.Id}
                                className={`flex-shrink-0 group cursor-pointer ${section.type === 'movies' || section.type === 'tvshows' ? 'w-[160px]' : 'w-[240px]'}`}
                                onClick={() => onPlay(item)}
                            >
                                <div className={`${section.type === 'movies' || section.type === 'tvshows' ? 'aspect-[2/3]' : 'aspect-video'} rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg relative`}>
                                    <img
                                        src={getPosterUrl(item, (section.type === 'movies' || section.type === 'tvshows') ? 'Primary' : 'Thumb')}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                        <p className="text-white text-[10px] font-bold truncate">{item.Name}</p>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs font-bold text-primary truncate group-hover:text-blue-500 transition-colors">{item.Name}</p>
                                    <p className="text-[10px] text-secondary opacity-50">{item.ProductionYear || ''}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {!loading && resumeItems.length === 0 && sections.length === 0 && (
                <div className="py-20 text-center opacity-20">
                    <i className="fas fa-ghost text-6xl mb-4"></i>
                    <p>Emby 首页暂无内容同步</p>
                </div>
            )}
        </div>
    );
}

export function MediaServer({ serverId, categoryId, onNavigate }: MediaServerProps) {
    const [loading, setLoading] = useState(false);
    const [server, setServer] = useState<any>(null);
    const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
    const [items, setItems] = useState<MediaItem[]>([]);

    useEffect(() => {
        if (serverId) {
            loadServerData();
        }
    }, [serverId]);

    useEffect(() => {
        setSelectedLibraryId(categoryId || null);
    }, [categoryId]);

    useEffect(() => {
        if (serverId && selectedLibraryId) {
            loadItems(selectedLibraryId);
        } else {
            setItems([]);
        }
    }, [serverId, selectedLibraryId]);

    const loadServerData = async () => {
        setLoading(true);
        try {
            const serversRes = await apiGet<any[]>('/media-servers');
            if (serversRes.success && serversRes.data) {
                const s = serversRes.data.find(item => item.id === serverId);
                setServer(s);
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
        if (!item.ImageTags?.Primary || !server) return '';
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

    if (!selectedLibraryId) {
        return <MediaServerHomeView server={server} onPlay={handlePlay} />;
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

            {loading ? (
                <div className="flex items-center justify-center h-[40vh]">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                    {items.map(item => (
                        <div key={item.Id} className="group relative cursor-pointer" onClick={() => handlePlay(item)}>
                            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/5 group-hover:border-blue-500/50 transition-all shadow-lg group-hover:shadow-blue-500/10 active:scale-95">
                                {item.ImageTags?.Primary ? (
                                    <img src={getPosterUrl(item)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
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

export default MediaServer;
