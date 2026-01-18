import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import QuickAction from '../components/QuickAction';
import ResourceMonitor from '../components/ResourceMonitor';
import {
    FileText,
    Users,
    Puzzle,
    Eye,
    UserCircle,
    ExternalLink,
    Plus,
    FileUp,
    Palette,
    UserPlus,
    RefreshCw,
    LogIn,
    TrendingUp,
    Layout,
    Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface DashboardStats {
    links: number;
    categories: number;
    plugins: number;
    users: number;
    views: number;
    todayViews: number;
    todayUsers: number;
    topLinks: Array<{ id: string, title: string, click_count: number, type: string }>;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();
    const [stats, setStats] = useState<DashboardStats>({
        links: 0,
        categories: 0,
        plugins: 0,
        users: 0,
        views: 0,
        todayViews: 0,
        todayUsers: 0,
        topLinks: []
    });

    // 加载统计数据
    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // 获取导航链接数
            const configRes = await fetch('/api/config', { headers });
            const config = await configRes.json();

            // Calculate links from Content Categories
            let contentLinksCount = 0;
            if (Array.isArray(config.categories)) {
                config.categories.forEach((cat: any) => {
                    if (Array.isArray(cat.subCategories)) {
                        cat.subCategories.forEach((sub: any) => {
                            if (Array.isArray(sub.items)) {
                                contentLinksCount += sub.items.length;
                            }
                        });
                    }
                });
            }

            const categoriesCount = config.categories?.length || 0;

            // 获取插件数
            const pluginsRes = await fetch('/api/plugins', { headers });
            const plugins = await pluginsRes.json();
            const pluginsCount = plugins.length;

            // Calculate links from Promo/Popular
            let promoLinksCount = 0;
            // Note: Key is 'promo' in app_config.json, not 'promotions'
            if (Array.isArray(config.promo)) {
                config.promo.forEach((p: any) => {
                    if (Array.isArray(p.items)) {
                        promoLinksCount += p.items.length;
                    }
                });
            } else if (Array.isArray(config.promotions)) {
                // Fallback in case API transforms it
                config.promotions.forEach((p: any) => {
                    if (Array.isArray(p.items)) {
                        promoLinksCount += p.items.length;
                    } else {
                        // If it's a flat list of items (unlikely based on valid json but possible in other adaptations)
                        promoLinksCount++;
                    }
                });
            }

            // Update total links count
            const totalLinks = contentLinksCount + promoLinksCount;

            // 获取用户数
            const usersRes = await fetch('/api/users', { headers });
            let usersCount = 0;
            if (usersRes.ok) {
                const users = await usersRes.json();
                usersCount = users.length;
            }

            // 获取实时统计数据 [NEW]
            let views = 0;
            let todayViews = 0;
            let todayUsers = 0;
            let topLinks = [];
            try {
                const statsRes = await fetch('/api/stats/dashboard', { headers });
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    views = statsData.totalViews || 0;
                    todayViews = statsData.todayViews || 0;
                    todayUsers = statsData.todayUsers || 0;
                    topLinks = statsData.topLinks || [];
                }
            } catch (err) {
                console.warn('Failed to load real-time stats:', err);
            }

            setStats({
                links: totalLinks,
                categories: categoriesCount,
                plugins: pluginsCount,
                users: usersCount,
                views,
                todayViews,
                todayUsers,
                topLinks
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    // 定义快捷访问并添加权限要求
    const quickActions = [
        {
            icon: LogIn,
            label: '个人中心',
            onClick: () => navigate('/admin/profile'),
            iconBgColor: 'bg-blue-50',
            iconColor: 'text-blue-600'
        },
        {
            icon: ExternalLink,
            label: '查看站点',
            onClick: () => window.open('/', '_blank'),
            iconBgColor: 'bg-green-50',
            iconColor: 'text-green-600'
        },
        {
            icon: Plus,
            label: '全局外观',
            onClick: () => navigate('/admin/settings/appearance'),
            iconBgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            permission: 'config:view'
        },
        {
            icon: FileText,
            label: '内容分类',
            onClick: () => navigate('/admin/settings/categories'),
            iconBgColor: 'bg-orange-50',
            iconColor: 'text-orange-600',
            permission: 'nav:view'
        },
        {
            icon: Puzzle,
            label: '应用商城',
            onClick: () => navigate('/admin/plugins'),
            iconBgColor: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            permission: 'plugins:view'
        },
        {
            icon: Users,
            label: '数据管理',
            onClick: () => navigate('/admin/settings/data'),
            iconBgColor: 'bg-pink-50',
            iconColor: 'text-pink-600',
            permission: 'config:view'
        },
        {
            icon: RefreshCw,
            label: 'AI配置',
            onClick: () => navigate('/admin/settings/ai'),
            iconBgColor: 'bg-gray-50',
            iconColor: 'text-gray-600',
            permission: 'config:view'
        },
        {
            icon: FileText,
            label: '热门网址',
            onClick: () => navigate('/admin/settings/promo'),
            iconBgColor: 'bg-orange-50',
            iconColor: 'text-orange-600',
            permission: 'nav:view'
        },
        {
            icon: FileUp,
            label: '资源管理',
            onClick: () => navigate('/admin/settings/media'),
            iconBgColor: 'bg-pink-50',
            iconColor: 'text-pink-600',
            permission: 'config:view'
        },
        {
            icon: Layout,
            label: '顶部导航',
            onClick: () => navigate('/admin/settings/topnav'),
            iconBgColor: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            permission: 'nav:view'
        },
        {
            icon: Activity,
            label: '链接健康',
            onClick: () => navigate('/admin/settings/health'),
            iconBgColor: 'bg-teal-50',
            iconColor: 'text-teal-600',
            permission: 'config:view'
        },
        {
            icon: Eye,
            label: '系统设置',
            onClick: () => navigate('/admin/system'),
            iconBgColor: 'bg-slate-50',
            iconColor: 'text-slate-600',
            permission: 'system:view'
        }
    ];

    // 根据权限过滤快捷访问
    const filteredQuickActions = quickActions.filter(action =>
        !action.permission || hasPermission(action.permission)
    );

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
                <p className="text-sm text-gray-500 mt-1">系统概览和快捷操作</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={FileText}
                    label="导航链接"
                    value={stats.links}
                    iconBgColor="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <StatCard
                    icon={Users}
                    label="用户"
                    value={stats.users}
                    iconBgColor="bg-green-50"
                    iconColor="text-green-600"
                />
                <StatCard
                    icon={Puzzle}
                    label="插件"
                    value={stats.plugins}
                    iconBgColor="bg-purple-50"
                    iconColor="text-purple-600"
                />
                <StatCard
                    icon={Eye}
                    label="总浏览量"
                    value={stats.views}
                    subtitle={
                        <span className="text-xs font-medium text-blue-600">
                            今日新增: +{stats.todayViews} | 今日访客: {stats.todayUsers}
                        </span>
                    }
                    iconBgColor="bg-orange-50"
                    iconColor="text-orange-600"
                />
            </div>

            {/* 快捷访问与热门排行 - 复合布局 [FIXED] */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* 左侧：快捷访问 (占 3/4) */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6 h-full">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷访问</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredQuickActions.map((action, index) => (
                            <QuickAction
                                key={index}
                                icon={action.icon}
                                label={action.label}
                                onClick={action.onClick}
                                iconBgColor={action.iconBgColor}
                                iconColor={action.iconColor}
                            />
                        ))}
                    </div>
                </div>

                {/* 右侧：热门网址榜单 (占 1/4) */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 h-full flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-orange-500" />
                        热门网址
                    </h2>
                    <div className="flex-1 space-y-4">
                        {stats.topLinks.length > 0 ? (
                            stats.topLinks.map((link, index) => (
                                <div key={link.id} className="flex items-center group">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        index === 1 ? 'bg-gray-100 text-gray-600' :
                                            index === 2 ? 'bg-orange-100 text-orange-700' :
                                                'bg-slate-50 text-slate-400'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors">
                                            {link.title}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            点击量: {link.click_count}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-6">
                                <div className="text-xs">暂无数据</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 资源监控 */}
            <ResourceMonitor />
        </div>
    );
}
