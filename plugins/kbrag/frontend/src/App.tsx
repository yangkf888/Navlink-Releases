/**
 * kbrag 知识库应用 - 主入口组件
 */
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
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

    // 发送空侧边栏配置和隐藏导航请求到主应用
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        // 发送空侧边栏配置（使用插件内部侧边栏）
        window.parent.postMessage({
            type: 'PLUGIN_SET_SIDEBAR',
            payload: {
                title: '知识库',
                subtitle: '本地知识存储与检索',
                items: [], // 空项目，使用插件内部侧边栏
                activeId: ''
            }
        }, '*');

        // 请求主应用在移动端隐藏顶部导航栏
        window.parent.postMessage({
            type: 'PLUGIN_REQUEST_HIDE_HEADER',
            payload: { hideMobile: true }
        }, '*');
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
        <Layout
            activeView={activeView}
            selectedCategory={selectedCategory}
            categories={categories}
            categoryStats={categoryStats}
            onViewChange={handleViewChange}
        >
            {/* 内容区域 */}
            <div className="p-4 lg:p-6">
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
        </Layout>
    );
}

export default App;
