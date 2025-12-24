/**
 * kbrag 知识库应用 - 主入口组件
 */
import { useState, useEffect } from 'react';
import { KnowledgeList } from './components/KnowledgeList';
import { KnowledgeDetail } from './components/KnowledgeDetail';
import { SettingsPanel } from './components/SettingsPanel';
import { SearchTest } from './components/SearchTest';
import { Dashboard } from './components/Dashboard';
import { KnowledgeItem, Stats, Category } from './types';
import { apiGet } from './utils/api';

type View = 'dashboard' | 'list' | 'search' | 'config';

function App() {
    const [activeView, setActiveView] = useState<View>(() => {
        return (localStorage.getItem('kbrag_view') as View) || 'dashboard';
    });
    const [stats, setStats] = useState<Stats>({ total: 0, embedded: 0, pending: 0 });
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryStats, setCategoryStats] = useState<Record<string, number>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(true);

    // 加载统计信息
    const loadStats = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Stats }>('items/stats/summary');
            if (response.success) {
                setStats(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load stats error:', error);
        }
    };

    // 加载分类
    const loadCategories = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Category[] }>('categories');
            if (response.success) {
                setCategories(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load categories error:', error);
        }
    };

    // 加载分类统计
    const loadCategoryStats = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Record<string, number> }>('items/stats/by-category');
            if (response.success) {
                setCategoryStats(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load category stats error:', error);
        }
    };

    // 初始化
    useEffect(() => {
        Promise.all([loadStats(), loadCategories(), loadCategoryStats()])
            .finally(() => setLoading(false));
    }, []);

    // 保存视图状态
    useEffect(() => {
        if (activeView !== 'config') {
            localStorage.setItem('kbrag_view', activeView);
        }
    }, [activeView]);

    // 处理视图切换
    const handleViewChange = (view: View | string) => {
        if (view === 'config') {
            setShowSettings(true);
        } else if (view.startsWith('category:')) {
            // 分类筛选
            const categoryName = view.replace('category:', '');
            setSelectedCategory(categoryName);
            setActiveView('list');
        } else {
            setSelectedCategory('');
            setActiveView(view as View);
        }
    };

    // 侧边栏配置 - 包含分类二级菜单
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        const categoryItems = categories.map(cat => ({
            id: `category:${cat.name}`,
            label: cat.name,
            icon: 'fas fa-folder',
            color: cat.color,
            badge: categoryStats[cat.name] || 0,
        }));

        const sidebarConfig = {
            title: '知识库',
            subtitle: '本地知识存储与检索',
            items: [
                { id: 'dashboard', label: '概览', icon: 'fas fa-home' },
                {
                    id: 'list',
                    label: '知识列表',
                    icon: 'fas fa-book',
                    children: categoryItems.length > 0 ? [
                        { id: 'list', label: '全部', icon: 'fas fa-list' },
                        ...categoryItems
                    ] : undefined
                },
                { id: 'search', label: '知识检索', icon: 'fas fa-search' },
                { id: 'config', label: '配置', icon: 'fas fa-cog' },
            ],
            activeId: selectedCategory ? `category:${selectedCategory}` : activeView,
        };

        window.parent.postMessage({
            type: 'PLUGIN_SET_SIDEBAR',
            payload: sidebarConfig,
        }, '*');
    }, [activeView, categories, categoryStats, selectedCategory]);

    // 监听侧边栏点击
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SIDEBAR_ITEM_CLICKED') {
                handleViewChange(event.data.payload.itemId);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 查看详情
    const handleViewItem = (item: KnowledgeItem) => {
        setSelectedItem(item);
        setShowDetail(true);
    };

    // 关闭详情
    const handleCloseDetail = () => {
        setShowDetail(false);
        setSelectedItem(null);
    };

    // 数据更新后刷新统计
    const handleDataChange = () => {
        loadStats();
        loadCategoryStats();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
            {/* 内容区域 */}
            <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                {activeView === 'dashboard' && (
                    <Dashboard
                        stats={stats}
                        categories={categories}
                        categoryStats={categoryStats}
                        onNavigate={handleViewChange}
                    />
                )}
                {activeView === 'list' && (
                    <KnowledgeList
                        onViewItem={handleViewItem}
                        onDataChange={handleDataChange}
                        selectedCategory={selectedCategory}
                    />
                )}
                {activeView === 'search' && (
                    <SearchTest onViewItem={handleViewItem} />
                )}
            </div>

            {/* 详情弹窗 */}
            {showDetail && selectedItem && (
                <KnowledgeDetail
                    item={selectedItem}
                    onClose={handleCloseDetail}
                    onUpdate={handleDataChange}
                />
            )}

            {/* 配置弹窗 */}
            {showSettings && (
                <SettingsPanel
                    onClose={() => {
                        setShowSettings(false);
                        loadCategories();
                        loadCategoryStats();
                    }}
                />
            )}
        </div>
    );
}

export default App;
