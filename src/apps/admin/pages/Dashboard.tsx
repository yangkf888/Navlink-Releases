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
    RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface DashboardStats {
    links: number;
    categories: number;
    plugins: number;
    users: number;
    views: number;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();
    const [stats, setStats] = useState<DashboardStats>({
        links: 0,
        categories: 0,
        plugins: 0,
        users: 0,
        views: 0
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

            // Calculate links from Content Categories (deeply nested: categories -> subCategories -> items)
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

            // Calculate links from Promo/Popular (nested: promo -> items)
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

            // 浏览量 (暂时移除或设为0，后端未实现)
            const views = 0;

            setStats({
                links: totalLinks,
                categories: categoriesCount,
                plugins: pluginsCount,
                users: usersCount,
                views
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    // 定义快捷访问并添加权限要求
    const quickActions = [
        {
            icon: UserCircle,
            label: '个人中心',
            onClick: () => navigate('/admin/users'),
            iconBgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            permission: 'user:view'
        },
        {
            icon: ExternalLink,
            label: '查看站点',
            onClick: () => window.open('/', '_blank'),
            iconBgColor: 'bg-green-50',
            iconColor: 'text-green-600',
            permission: null  // 所有人可访问
        },
        {
            icon: Plus,
            label: '全局外观',
            onClick: () => navigate('/admin/settings/basic'),
            iconBgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            permission: 'config:view'
        },
        {
            icon: FileText,
            label: '内容分类',
            onClick: () => navigate('/admin/settings/categories'),
            iconBgColor: 'bg-yellow-50',
            iconColor: 'text-yellow-600',
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
            icon: Palette,
            label: '顶部导航',
            onClick: () => navigate('/admin/settings/topnav'),
            iconBgColor: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            permission: 'nav:view'
        },
        {
            icon: Puzzle,
            label: '应用商城',
            onClick: () => navigate('/admin/plugins'),
            iconBgColor: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            permission: 'plugin:view'
        },
        {
            icon: UserPlus,
            label: '数据管理',
            onClick: () => navigate('/admin/settings/data'),
            iconBgColor: 'bg-red-50',
            iconColor: 'text-red-600',
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
            icon: Users,
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
                    label="浏览量"
                    value={stats.views}
                    iconBgColor="bg-orange-50"
                    iconColor="text-orange-600"
                />
            </div>

            {/* 快捷访问 - 全宽布局 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷访问</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

            {/* 资源监控 */}
            <ResourceMonitor />
        </div>
    );
}
