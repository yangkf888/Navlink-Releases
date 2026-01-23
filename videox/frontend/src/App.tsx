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
import ReactDOM from 'react-dom';
import { NavigationProvider } from './contexts/NavigationContext';
import { useAuth } from './contexts/AuthContext';

// 简单的密码输入模态框
function PasswordModal({ isOpen, onClose, onLogin, title = '管理员登录', subtitle = '请输入管理密码以继续' }: { isOpen: boolean; onClose: () => void; onLogin: (pwd: string) => Promise<boolean>; title?: string; subtitle?: string }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;

        setLoading(true);
        setError('');

        const success = await onLogin(password);
        if (success) {
            setPassword('');
            onClose();
            // 登录成功后无需强制刷新，React 状态会自动更新 UI
        } else {
            setError('密码错误');
        }
        setLoading(false);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-secondary rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-border-color transform transition-all">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-user-shield text-red-500 text-2xl"></i>
                    </div>
                    <h3 className="text-2xl font-black text-primary">{title}</h3>
                    <p className="text-secondary text-sm mt-1">{subtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="relative">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="管理密码"
                            className="w-full px-4 py-3 bg-white text-[#1a1c1e] rounded-xl border border-border-color focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-center font-mono tracking-wider transition-all placeholder:text-gray-400"
                            autoFocus
                        />
                        {error && (
                            <div className="flex items-center justify-center gap-2 mt-3 text-red-500 text-xs font-bold animate-shake">
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-secondary hover:bg-tertiary text-primary rounded-xl border border-border-color font-bold transition-all active:scale-95"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                            ) : (
                                '确认登录'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

// 设置页面标题
document.title = 'VideoX';

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
    netdiskPath?: string; // For Netdisk search
    _t?: number; // 🚀 刷新时间戳，强制重新搜索
}

// localStorage key
const SELECTED_SOURCE_KEY = 'video_selected_source';
const SELECTED_TV_SOURCE_KEY = 'video_selected_tv_source';
const ACTIVE_VIEW_KEY = 'video_active_view';
const NAV_PARAMS_KEY = 'video_nav_params';
const ACTIVE_MODULE_KEY = 'video_active_module';

// 辅助组件：访问受限提示
function AccessDenied({ onGoHome }: { onGoHome: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-lock text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">访问受限</h2>
            <p className="mb-6">您没有权限访问该页面，请先进行管理员身份验证</p>
            <button
                onClick={onGoHome}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                返回首页
            </button>
        </div>
    );
}

function VideoApp() {
    const { isAuthenticated, isAdminAuthenticated, login: authLogin } = useAuth();
    const [isLoaded, setIsLoaded] = useState(false);

    const handleLoginSuccess = async (password: string, type: 'site' | 'admin' = 'admin') => {
        const success = await authLogin(password, type);
        if (success) {
            setIsLoginModalOpen(false);
            // 🚀 核心方案：登录成功后强制刷新全页，确保侧边栏及全站状态彻底同步
            window.location.reload();
        }
        return success;
    };

    // 从 localStorage 初始化状态
    const [activeView, setActiveView] = useState<ViewType>(() => {
        return (localStorage.getItem(ACTIVE_VIEW_KEY) as ViewType) || 'home';
    });
    const [navParams, setNavParams] = useState<NavParams>(() => {
        const saved = localStorage.getItem(NAV_PARAMS_KEY);
        try {
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    // 导航历史记录栈
    const [navHistory, setNavHistory] = useState<Array<{ view: ViewType; params: NavParams }>>([]);

    // 当前激活的模块（顶部导航）
    const [activeModule, setActiveModule] = useState<AppModule>(() => {
        return (localStorage.getItem(ACTIVE_MODULE_KEY) as AppModule) || 'home';
    });

    // 状态持久化
    useEffect(() => {
        localStorage.setItem(ACTIVE_VIEW_KEY, activeView);
        localStorage.setItem(NAV_PARAMS_KEY, JSON.stringify(navParams));
        localStorage.setItem(ACTIVE_MODULE_KEY, activeModule);
    }, [activeView, navParams, activeModule]);

    // 视频源和分类
    const [sources, setSources] = useState<VideoSource[]>([]);
    const [categoriesMap, setCategoriesMap] = useState<Record<number, Category[]>>({});

    // 电视源
    const [tvSources, setTvSources] = useState<TvSource[]>([]);

    // 直播源
    const [liveSources, setLiveSources] = useState<LiveSource[]>([]);

    const [netdiskSources, setNetdiskSources] = useState<NetdiskSource[]>([]);
    const [selectedNetdiskSourceId, setSelectedNetdiskSourceId] = useState<number | null>(null);

    // 安全设置状态
    const [isAdminPasswordEnabled, setIsAdminPasswordEnabled] = useState<boolean>(false);
    const [isSitePasswordEnabled, setIsSitePasswordEnabled] = useState<boolean>(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginModalConfig, setLoginModalConfig] = useState<{ title: string; subtitle: string; type?: 'site' | 'admin' }>({ title: '管理员登录', subtitle: '请输入管理密码以继续', type: 'admin' });

    // 监听全局登录显示事件
    useEffect(() => {
        const handleShowLogin = (e: any) => {
            if (e.detail?.title) {
                setLoginModalConfig({
                    title: e.detail.title,
                    subtitle: e.detail.subtitle || '请输入访问密码以继续',
                    type: e.detail.type || 'admin'
                });
            } else {
                setLoginModalConfig({
                    title: '身份验证',
                    subtitle: '请输入访问密码进入站点',
                    type: 'site'
                });
            }
            setIsLoginModalOpen(true);
        };

        window.addEventListener('videox-show-login' as any, handleShowLogin);
        return () => window.removeEventListener('videox-show-login' as any, handleShowLogin);
    }, []);

    // 🚀 优化：全站锁定时自动打开登录窗
    useEffect(() => {
        if (isSitePasswordEnabled && !isAuthenticated) {
            setLoginModalConfig({
                title: '身份验证',
                subtitle: '本站点已开启访问限制，请输入访问密码进入',
                type: 'site'
            });
            setIsLoginModalOpen(true);
        }
    }, [isSitePasswordEnabled, isAuthenticated]);

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

    // 全局数据同步通道 (用于多标签页间通信)
    useEffect(() => {
        const channel = new BroadcastChannel('videox-sync');
        channel.onmessage = (event) => {
            if (event.data === 'refresh-data' || event.data === 'sources-updated') {
                console.log('[App] Received sync message, reloading data...');
                loadSourcesAndCategories();
            }
        };
        return () => channel.close();
    }, []);

    // 加载视频源和分类
    useEffect(() => {
        loadSourcesAndCategories();
    }, [isAuthenticated, isAdminAuthenticated]);

    const loadSourcesAndCategories = async () => {
        try {
            // 1. 并发加载基础源数据
            const [sourcesRes, tvRes, liveRes, netdiskRes, settingsRes] = await Promise.all([
                apiGet<VideoSource[]>('/sources'),
                apiGet<TvSource[]>('/tv/sources'),
                apiGet<LiveSource[]>('/live/sources'),
                apiGet<NetdiskSource[]>('/netdisk/sources'),
                apiGet<any>('/settings')
            ]);

            // 处理安全设置
            if (settingsRes.success && settingsRes.data) {
                const isAdminEnabled = settingsRes.data.admin_password_enabled === 'true' ||
                    settingsRes.data.admin_password_enabled === true;
                const isSiteEnabled = settingsRes.data.site_password_enabled === 'true' ||
                    settingsRes.data.site_password_enabled === true;

                setIsAdminPasswordEnabled(isAdminEnabled);
                setIsSitePasswordEnabled(isSiteEnabled);
            }

            // 处理视频源
            if (sourcesRes.success && sourcesRes.data) {
                // 如果开启了密码保护且未登录，则过滤掉隐藏源；否则显示全部启用源
                const enabledSources = sourcesRes.data.filter(s =>
                    s.enabled && (isAdminAuthenticated || !isAdminPasswordEnabled || !s.hidden)
                );
                setSources(enabledSources);

                let finalSelectedId = selectedSourceId;
                const isSelectedValid = enabledSources.some(s => s.id === selectedSourceId);

                if (!isSelectedValid && enabledSources.length > 0) {
                    finalSelectedId = enabledSources[0].id;
                    setSelectedSourceId(finalSelectedId);
                    localStorage.setItem(SELECTED_SOURCE_KEY, String(finalSelectedId));
                }

                // 2. 并发加载这些源的分类
                const catPromises = enabledSources.map(source =>
                    apiGet<Category[]>('/categories', { source_id: source.id })
                        .then(res => ({ id: source.id, data: res.success ? res.data : [] }))
                );

                const catResults = await Promise.all(catPromises);
                const catMap: Record<number, Category[]> = {};
                catResults.forEach(result => {
                    catMap[result.id] = result.data || [];
                });
                setCategoriesMap(catMap);
            }

            // 处理电视源
            if (tvRes.success && tvRes.data) {
                const enabledTv = tvRes.data.filter(s => s.enabled);
                setTvSources(enabledTv);
                setTvRefreshKey(prev => prev + 1);

                if (!selectedTvSourceId && enabledTv.length > 0) {
                    setSelectedTvSourceId(enabledTv[0].id);
                    localStorage.setItem(SELECTED_TV_SOURCE_KEY, String(enabledTv[0].id));
                }
            }

            // 处理直播源
            if (liveRes.success && liveRes.data) {
                setLiveSources(liveRes.data.filter(s => s.enabled === 1));
            }

            // 处理网盘源
            if (netdiskRes.success && netdiskRes.data) {
                const enabledNetdisk = netdiskRes.data.filter(s =>
                    s.enabled && (isAdminAuthenticated || !isAdminPasswordEnabled || !s.hidden)
                );
                setNetdiskSources(enabledNetdisk);

                // 验证选中的网盘源是否有效
                if (selectedNetdiskSourceId && !enabledNetdisk.some(s => s.id === selectedNetdiskSourceId)) {
                    setSelectedNetdiskSourceId(null);
                }
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

    // 处理源数据变动的同步回调
    const handleSourcesChangeSync = () => {
        console.log('[App] Sources changed, refreshing and broadcasting...');
        loadSourcesAndCategories();

        // 发送广播消息，通知其他标签页
        const channel = new BroadcastChannel('videox-sync');
        channel.postMessage('sources-updated');
        channel.close();
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
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // 独立应用模式，不需要与父窗口通信

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

    // 辅助函数：检查当前视图所请求的视频源是否可见
    const isSourceVisible = (id?: number) => {
        if (!id) return true;
        return sources.some(s => s.id === id);
    };

    const isNetdiskVisible = (id?: number) => {
        if (!id) return true;
        return netdiskSources.some(s => s.id === id);
    };

    // 如果启用了全站密码保护且未授权，显示全站锁定占位（PasswordModal 会由顶层的 useEffect 自动弹出）
    if (isSitePasswordEnabled && !isAuthenticated) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center p-4">
                {/* 关键：必须在锁定渲染分支中也放置 Modal，否则状态修改后没有组件可渲染 */}
                <PasswordModal
                    isOpen={isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                    onLogin={(pwd) => authLogin(pwd, (loginModalConfig as any).type || 'site')}
                    title={loginModalConfig.title}
                    subtitle={loginModalConfig.subtitle}
                />
            </div>
        );
    }

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
                    onToggleTheme: toggleTheme,
                    isAdminPasswordEnabled  // 传递安全设置状态
                }}
            >
                {activeView === 'home' && (
                    <Home />
                )}
                {activeView === 'category' && (
                    isSourceVisible(navParams.sourceId) ? (
                        <CategoryPage
                            sourceId={navParams.sourceId}
                            categoryId={navParams.categoryId}
                            categoryName={navParams.categoryName}
                            subCategories={navParams.subCategories}
                            onNavigate={navigate}
                            categories={categoriesMap[selectedSourceId || 0] || []}
                        />
                    ) : <AccessDenied onGoHome={() => navigate('home')} />
                )}
                {activeView === 'source' && selectedSourceId && (
                    isSourceVisible(selectedSourceId) ? (
                        <SourceOverview
                            sourceId={selectedSourceId}
                            sourceName={sources.find(s => s.id === selectedSourceId)?.name}
                            categories={categoriesMap[selectedSourceId] || []}
                            onNavigate={navigate}
                        />
                    ) : <AccessDenied onGoHome={() => navigate('home')} />
                )}
                {activeView === 'play' && navParams.sourceId && navParams.vodId && (
                    isSourceVisible(navParams.sourceId) ? (
                        <Play
                            sourceId={navParams.sourceId}
                            vodId={navParams.vodId}
                            onNavigate={navigate}
                            onGoBack={goBack}
                        />
                    ) : <AccessDenied onGoHome={() => navigate('home')} />
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
                    isNetdiskVisible(navParams.netdiskSourceId || selectedNetdiskSourceId || undefined) ? (
                        <Netdisk
                            sourceId={navParams.netdiskSourceId || selectedNetdiskSourceId || undefined}
                            selectedPath={navParams.keyword || undefined}
                            onPlay={(mediaId, sourceId, videoIndex) => {
                                navigate('netdisk_play', { mediaId, sourceId, videoIndex });
                            }}
                        />
                    ) : <AccessDenied onGoHome={() => navigate('home')} />
                )}
                {activeView === 'netdisk_play' && navParams.mediaId && navParams.sourceId && (
                    isNetdiskVisible(navParams.sourceId) ? (
                        <NetdiskPlayer
                            mediaId={navParams.mediaId}
                            sourceId={navParams.sourceId}
                            initialVideoIndex={navParams.videoIndex}
                            onNavigate={navigate}
                            onGoBack={goBack}
                        />
                    ) : <AccessDenied onGoHome={() => navigate('home')} />
                )}
                {activeView === 'search' && (
                    <Search
                        initialKeyword={navParams.keyword}
                        sourceId={navParams.sourceId ?? null}
                        netdiskPath={navParams.netdiskPath}
                        sources={sources}
                        onNavigate={navigate}
                    />
                )}
                {(activeView === 'favorites' || activeView === 'history' || activeView === 'admin') && !isAdminAuthenticated && (
                    <AccessDenied onGoHome={() => navigate('home')} />
                )}
                {activeView === 'favorites' && isAdminAuthenticated && (
                    <Favorites
                        onNavigate={navigate}
                        sources={sources}
                        netdiskSources={netdiskSources}
                    />
                )}
                {activeView === 'history' && isAdminAuthenticated && (
                    <History
                        onNavigate={navigate}
                        sources={sources}
                        netdiskSources={netdiskSources}
                    />
                )}
                {activeView === 'admin' && isAdminAuthenticated && (
                    <Admin
                        onNavigate={navigate}
                        onSourcesChange={handleSourcesChangeSync}
                    />
                )}
            </Layout>

            {/* 全局登录弹窗 */}
            <PasswordModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={(pwd) => handleLoginSuccess(pwd, (loginModalConfig as any).type || 'admin')}
                title={loginModalConfig.title}
                subtitle={loginModalConfig.subtitle}
            />
        </NavigationProvider>
    );
}

export default VideoApp;
