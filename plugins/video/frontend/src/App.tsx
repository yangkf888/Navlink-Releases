import { useState, useEffect } from 'react';
import { VideoSource, Category } from './types';
import { apiGet } from './utils/api';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Category as CategoryPage } from './pages/Category';
import { SourceOverview } from './pages/SourceOverview';
import { Play } from './pages/Play';
import { Search } from './pages/Search';
import { Admin } from './pages/Admin';
import { Favorites } from './pages/Favorites';
import { History } from './pages/History';
import { NavigationProvider } from './contexts/NavigationContext';

// 视图类型
type ViewType = 'home' | 'source' | 'category' | 'play' | 'search' | 'favorites' | 'history' | 'admin';

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
}

// localStorage key
const SELECTED_SOURCE_KEY = 'video_selected_source';

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

    // 当前选中的视频源
    const [selectedSourceId, setSelectedSourceId] = useState<number | null>(() => {
        const saved = localStorage.getItem(SELECTED_SOURCE_KEY);
        return saved ? parseInt(saved) : null;
    });

    // 导航函数（带历史记录）
    const navigate = (view: string, params: Record<string, unknown> = {}) => {
        // 将当前视图推入历史栈（不推入 play 页面避免重复）
        if (activeView !== 'play') {
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
        } else {
            // 预留模块：显示占位页面
            setActiveView('home'); // 临时使用 home 视图
            setNavParams({});
        }
    };

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
        } catch (error) {
            console.error('[App] Failed to load sources:', error);
        } finally {
            setIsLoaded(true);
        }
    };

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

    // 发送最小化侧边栏配置到主应用
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe || !isLoaded) return;

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



    return (
        <NavigationProvider navigate={navigate}>
            <Layout
                sidebarProps={{
                    sources,
                    categoriesMap,
                    selectedSourceId,
                    onSourceChange: handleSourceChange,
                    onNavigate: navigate,
                    activeView,
                    navParams,
                    activeModule,
                    onModuleChange: handleModuleChange
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
