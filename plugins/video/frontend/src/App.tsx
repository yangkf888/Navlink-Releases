import { useState, useEffect } from 'react';
import { VideoSource, TvSource, LiveSource, NetdiskSource, Category } from './types';
import { apiGet } from './utils/api';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Category as CategoryPage } from './pages/Category';
import { SourceOverview } from './pages/SourceOverview';
import { Play } from './pages/Play';
import { TvPlayer } from './pages/TvPlayer';
import { Live } from './pages/Live'; // New component
import { LivePlayer } from './pages/LivePlayer'; // New component
import { Netdisk } from './pages/Netdisk'; // Netdisk module
import { NetdiskPlayer } from './pages/NetdiskPlayer'; // Netdisk Player
import { Search } from './pages/Search';
import { Admin } from './pages/Admin';
import { Favorites } from './pages/Favorites';
import { History } from './pages/History';
import { NavigationProvider } from './contexts/NavigationContext';

// 视图类型
type ViewType = 'home' | 'source' | 'category' | 'play' | 'tv_play' | 'live' | 'live_play' | 'netdisk' | 'netdisk_play' | 'search' | 'favorites' | 'history' | 'admin';

// 模块类型（顶部导航）
export type AppModule = 'home' | 'sources' | 'tv' | 'live' | 'netdisk';

// 导航参数
interface NavParams {
    sourceId?: number;
    categoryId?: string;
    categoryName?: string;
    subCategories?: Category[];  // 子分类列表
    vodId?: string;
    keyword?: string;
    platform?: string;
    liveSourceId?: number; // For Live
    tvSourceId?: number; // For TV
    channelUrl?: string; // For TV
    mediaId?: number; // For Netdisk
    videoIndex?: number; // For Netdisk
    netdiskSourceId?: number; // For Netdisk source selection
}

// localStorage key
const SELECTED_SOURCE_KEY = 'video_selected_source';
const SELECTED_TV_SOURCE_KEY = 'video_selected_tv_source';

function VideoApp() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [activeView, setActiveView] = useState<ViewType>('home');
    const [navParams, setNavParams] = useState<NavParams>({});

    // 导航历史记录栈
    const [navHistory, setNavHistory] = useState<Array<{ view: ViewType; params: NavParams }>>([]);

    // 当前激活的模块（顶部导航）
    const [activeModule, setActiveModule] = useState<AppModule>('home');

    // 视频源和分类
    const [sources, setSources] = useState<VideoSource[]>([]);
    const [categoriesMap, setCategoriesMap] = useState<Record<number, Category[]>>({});

    // 电视源
    const [tvSources, setTvSources] = useState<TvSource[]>([]);

    // 直播源
    const [liveSources, setLiveSources] = useState<LiveSource[]>([]);

    // 网盘源
    const [netdiskSources, setNetdiskSources] = useState<NetdiskSource[]>([]);
    const [selectedNetdiskSourceId, setSelectedNetdiskSourceId] = useState<number | null>(null);

    // 直播状态数据
    const [liveStatuses, setLiveStatuses] = useState<Record<number, any>>({});

    // 当前选中的视频源
    const [selectedSourceId, setSelectedSourceId] = useState<number | null>(() => {
        const saved = localStorage.getItem(SELECTED_SOURCE_KEY);
        return saved ? parseInt(saved) : null;
    });

    // 当前选中的电视源
    const [selectedTvSourceId, setSelectedTvSourceId] = useState<number | null>(() => {
        const saved = localStorage.getItem(SELECTED_TV_SOURCE_KEY);
        return saved ? parseInt(saved) : null;
    });

    // 导航函数（带历史记录）
    const navigate = (view: string, params: Record<string, unknown> = {}) => {
        // 将当前视图推入历史栈（不推入 play 页面避免重复）
        if (activeView !== 'play' && activeView !== 'tv_play') {
            setNavHistory(prev => [...prev, { view: activeView, params: navParams }]);
        }
        setActiveView(view as ViewType);
        setNavParams(params as NavParams);
    };

    // 返回上一级
    const goBack = () => {
        if (navHistory.length > 0) {
            const prev = navHistory[navHistory.length - 1];
            setNavHistory(h => h.slice(0, -1));
            setActiveView(prev.view);
            setNavParams(prev.params);
        } else {
            // 没有历史记录时回到首页
            setActiveView('home');
            setNavParams({});
        }
    };

    // 模块切换函数
    const handleModuleChange = (module: AppModule) => {
        setActiveModule(module);
        // 根据模块切换默认视图
        if (module === 'home') {
            setActiveView('home');
            setNavParams({});
        } else if (module === 'sources') {
            // 资源站模块：显示第一个源的概览
            const firstSource = sources.find(s => s.enabled);
            if (firstSource) {
                setSelectedSourceId(firstSource.id);
                setActiveView('source');
                setNavParams({ sourceId: firstSource.id });
            }
        } else if (module === 'tv') {
            // 电视模块：显示电视播放页
            setActiveView('tv_play');
            if (selectedTvSourceId) {
                setNavParams({ tvSourceId: selectedTvSourceId });
            }
        } else if (module === 'live') {
            // 直播模块
            setActiveView('live');
            setNavParams({});
        } else if (module === 'netdisk') {
            // 网盘模块
            setActiveView('netdisk');
            setNavParams({});
            setSelectedNetdiskSourceId(null);  // 清空选中的网盘源，显示全部网盘视图
        } else {
            // 预留模块：显示占位页面
            setActiveView('home'); // 临时使用 home 视图
            setNavParams({});
        }
    };

    // TV 刷新 Key
    const [tvRefreshKey, setTvRefreshKey] = useState(0);

    // 加载视频源和分类
    useEffect(() => {
        loadSourcesAndCategories();
    }, []);

    const loadSourcesAndCategories = async () => {
        try {
            // 加载视频源
            const sourcesRes = await apiGet<VideoSource[]>('/sources');
            if (sourcesRes.success && sourcesRes.data) {
                const enabledSources = sourcesRes.data.filter(s => s.enabled);
                setSources(enabledSources);

                // 如果没有选中的源，默认选择第一个
                if (!selectedSourceId && enabledSources.length > 0) {
                    const firstSourceId = enabledSources[0].id;
                    setSelectedSourceId(firstSourceId);
                    localStorage.setItem(SELECTED_SOURCE_KEY, String(firstSourceId));
                }

                // 加载每个源的分类
                const catMap: Record<number, Category[]> = {};
                for (const source of enabledSources) {
                    const catRes = await apiGet<Category[]>('/categories', { source_id: source.id });
                    if (catRes.success && catRes.data) {
                        catMap[source.id] = catRes.data;
                    }
                }
                setCategoriesMap(catMap);
            }

            // 加载电视源
            const tvRes = await apiGet<TvSource[]>('/tv/sources');
            if (tvRes.success && tvRes.data) {
                const enabledTv = tvRes.data.filter(s => s.enabled);
                setTvSources(enabledTv);

                // 刷新 Sidebar 频道列表
                setTvRefreshKey(prev => prev + 1);

                if (!selectedTvSourceId && enabledTv.length > 0) {
                    setSelectedTvSourceId(enabledTv[0].id);
                    localStorage.setItem(SELECTED_TV_SOURCE_KEY, String(enabledTv[0].id));
                }
            }

            // 加载直播源
            const liveRes = await apiGet<LiveSource[]>('/live/sources');
            if (liveRes.success && liveRes.data) {
                setLiveSources(liveRes.data.filter(s => s.enabled === 1));
            }

            // 加载网盘源
            const netdiskRes = await apiGet<NetdiskSource[]>('/netdisk/sources');
            if (netdiskRes.success && netdiskRes.data) {
                setNetdiskSources(netdiskRes.data);
            }

        } catch (error) {
            console.error('[App] Failed to load sources:', error);
        } finally {
            setIsLoaded(true);
        }
    };

    // 加载直播状态
    const loadLiveStatuses = async () => {
        try {
            const res = await apiGet<any[]>('/live/status');
            if (res.success && res.data) {
                const statusMap: Record<number, any> = {};
                res.data.forEach(s => {
                    statusMap[s.source_id] = s;
                });
                setLiveStatuses(statusMap);
            }
        } catch (e) {
            console.error('[App] Failed to fetch live statuses', e);
        }
    };

    // 定期刷新直播状态 (60s)
    useEffect(() => {
        loadLiveStatuses();
        const timer = setInterval(loadLiveStatuses, 60000);
        return () => clearInterval(timer);
    }, []);

    // 切换视频源
    const handleSourceChange = (sourceId: number) => {
        setSelectedSourceId(sourceId);
        localStorage.setItem(SELECTED_SOURCE_KEY, String(sourceId));
        // 切换源后显示该源的概览（多分类视图）
        setActiveView('source');
        setNavParams({ sourceId });
        // 同步顶部导航菜单切换到"资源站"
        setActiveModule('sources');
    };

    // 切换电视源
    const handleTvSourceChange = (id: number) => {
        setSelectedTvSourceId(id);
        localStorage.setItem(SELECTED_TV_SOURCE_KEY, String(id));
        setActiveView('tv_play');
        setNavParams({ tvSourceId: id });
        setActiveModule('tv');
    };

    // 主题管理
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('video_theme') as 'light' | 'dark') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('video_theme', theme);

        // 同步主题到主应用
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'PLUGIN_THEME_CHANGED',
                payload: { theme }
            }, '*');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // 发送最小化侧边栏配置到主应用
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe || !isLoaded) return;

        // 同步主题为 dark (此插件原生风格为深色)
        window.parent.postMessage({
            type: 'PLUGIN_THEME_CHANGED',
            payload: { theme: 'dark' }
        }, '*');

        let count = 0;
        const maxAttempts = 5;

        const sendMessage = () => {
            // 发送空侧边栏配置
            window.parent.postMessage({
                type: 'PLUGIN_SET_SIDEBAR',
                payload: {
                    title: '视频中心',
                    subtitle: sources.find(s => s.id === selectedSourceId)?.name || '多源视频聚合',
                    items: [],
                    activeId: ''
                }
            }, '*');

            // 再次确保主题同步
            window.parent.postMessage({
                type: 'PLUGIN_THEME_CHANGED',
                payload: { theme }
            }, '*');

            // 请求隐藏 Header（默认仅移动端隐藏，桌面端保持显示）
            window.parent.postMessage({
                type: 'PLUGIN_REQUEST_HIDE_HEADER',
                payload: { hideHeader: false }
            }, '*');

            count++;
            if (count < maxAttempts) {
                setTimeout(sendMessage, 500);
            }
        };

        sendMessage();
    }, [selectedSourceId, isLoaded, sources]);

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">加载中...</p>
                </div>
            </div>
        );
    }



    // 播放电视频道
    const handlePlayChannel = (channel: any) => {
        setActiveView('tv_play');
        setNavParams(prev => ({ ...prev, channelUrl: channel.url }));
        // Ensure module is tv
        if (activeModule !== 'tv') setActiveModule('tv');
    };

    return (
        <NavigationProvider navigate={navigate}>
            <Layout
                sidebarProps={{
                    sources,
                    categoriesMap,
                    selectedSourceId,
                    onSourceChange: handleSourceChange,

                    tvSources,
                    selectedTvSourceId,
                    onTvSourceChange: handleTvSourceChange,
                    onPlayChannel: handlePlayChannel,
                    currentChannelUrl: navParams.channelUrl,
                    tvRefreshKey,

                    liveSources, // Pass live sources to sidebar

                    netdiskSources, // Pass netdisk sources to sidebar
                    selectedNetdiskSourceId,
                    onNetdiskSourceChange: (id: number) => setSelectedNetdiskSourceId(id),

                    liveStatuses,   // 传递直播状态数据

                    onNavigate: navigate,
                    activeView,
                    navParams,
                    activeModule,
                    onModuleChange: handleModuleChange,
                    theme,
                    onToggleTheme: toggleTheme
                }}
            >
                {activeView === 'home' && (
                    <Home />
                )}
                {activeView === 'category' && (
                    <CategoryPage
                        sourceId={navParams.sourceId}
                        categoryId={navParams.categoryId}
                        categoryName={navParams.categoryName}
                        subCategories={navParams.subCategories}
                        onNavigate={navigate}
                        categories={categoriesMap[selectedSourceId || 0] || []}
                    />
                )}
                {activeView === 'source' && selectedSourceId && (
                    <SourceOverview
                        sourceId={selectedSourceId}
                        sourceName={sources.find(s => s.id === selectedSourceId)?.name}
                        categories={categoriesMap[selectedSourceId] || []}
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'play' && navParams.sourceId && navParams.vodId && (
                    <Play
                        sourceId={navParams.sourceId}
                        vodId={navParams.vodId}
                        onNavigate={navigate}
                        onGoBack={goBack}
                    />
                )}
                {activeView === 'tv_play' && (
                    <TvPlayer
                        tvSourceId={navParams.tvSourceId || selectedTvSourceId || undefined}
                        channelUrl={navParams.channelUrl}
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'live' && (
                    <Live platform={navParams.platform} onPlay={(sourceId: number) => navigate('live_play', { liveSourceId: sourceId })} />
                )}
                {activeView === 'live_play' && (
                    <LivePlayer
                        sourceId={navParams.liveSourceId}
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'netdisk' && (
                    <Netdisk
                        sourceId={navParams.netdiskSourceId || selectedNetdiskSourceId || undefined}
                        selectedPath={navParams.keyword || undefined}
                        onPlay={(mediaId, sourceId, videoIndex) => {
                            navigate('netdisk_play', { mediaId, sourceId, videoIndex });
                        }}
                    />
                )}
                {activeView === 'netdisk_play' && navParams.mediaId && navParams.sourceId && (
                    <NetdiskPlayer
                        mediaId={navParams.mediaId}
                        sourceId={navParams.sourceId}
                        initialVideoIndex={navParams.videoIndex}
                        onNavigate={navigate}
                        onGoBack={goBack}
                    />
                )}
                {activeView === 'search' && (
                    <Search
                        initialKeyword={navParams.keyword}
                        sourceId={navParams.sourceId ?? null}
                        sources={sources}
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'favorites' && (
                    <Favorites
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'history' && (
                    <History
                        onNavigate={navigate}
                    />
                )}
                {activeView === 'admin' && (
                    <Admin
                        onNavigate={navigate}
                        onSourcesChange={loadSourcesAndCategories}
                    />
                )}
            </Layout>
        </NavigationProvider>
    );
}

export default VideoApp;
