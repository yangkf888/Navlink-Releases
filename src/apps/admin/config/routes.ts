import { lazy } from 'react';

// 页面导入
import Dashboard from '../pages/Dashboard';
import BasicSettings from '../pages/Content/BasicSettings';
import TopNavSettings from '../pages/Content/TopNavSettings';
import HeroSettings from '../pages/Content/HeroSettings';
import PromoSettings from '../pages/Content/PromoSettings';
import CategorySettings from '../pages/Content/CategorySettings';
import SidebarSettings from '../pages/Content/SidebarSettings';
import PluginMarket from '../pages/System/Plugins/PluginMarket';
import PluginList from '../pages/System/Plugins/PluginList';
import PluginViewer from '../pages/System/Plugins/PluginViewer';
import AIConfig from '../pages/System/AIConfig';
import LinkHealth from '../pages/System/LinkHealth';
import MediaManagement from '../pages/System/MediaManagement';
import DataManagement from '../pages/System/DataManagement';
import Users from '../pages/System/Users';
import Permissions from '../pages/System/Permissions';
import Logs from '../pages/System/Logs';
import Monitor from '../pages/System/Monitor';

/**
 * 路由权限配置
 * 集中管理所有路由和对应的权限要求
 */
export interface RouteConfig {
    path: string;
    component: React.ComponentType;
    permission?: string | string[];  // 不填表示所有人可访问
    requireAll?: boolean;  // 需要所有权限（默认false为任意权限）
    title?: string;  // 页面标题
}

export const adminRoutes: RouteConfig[] = [
    // 仪表盘 - 所有人可访问
    {
        path: '/dashboard',
        component: Dashboard,
        title: '仪表盘'
    },

    // 内容管理 - 需要nav:view权限
    {
        path: '/settings/basic',
        component: BasicSettings,
        permission: 'config:view',
        title: '全局外观'
    },
    {
        path: '/settings/topnav',
        component: TopNavSettings,
        permission: 'nav:view',
        title: '顶部导航'
    },
    {
        path: '/settings/hero',
        component: HeroSettings,
        permission: 'config:view',
        title: '首屏设置'
    },
    {
        path: '/settings/promo',
        component: PromoSettings,
        permission: 'nav:view',
        title: '热门推广'
    },
    {
        path: '/settings/categories',
        component: CategorySettings,
        permission: 'nav:view',
        title: '内容分类'
    },
    {
        path: '/settings/sidebar',
        component: SidebarSettings,
        permission: 'config:view',
        title: '侧边栏设置'
    },

    // 插件管理 - 需要plugin:view权限
    {
        path: '/plugin-market',
        component: PluginMarket,
        permission: 'plugin:view',
        title: '插件市场'
    },
    {
        path: '/plugins',
        component: PluginList,
        permission: 'plugin:view',
        title: '插件管理'
    },
    {
        path: '/plugins/:pluginId',
        component: PluginViewer,
        permission: 'plugin:view',
        title: '插件详情'
    },

    // 系统设置 - 需要config:view权限
    {
        path: '/settings/ai',
        component: AIConfig,
        permission: 'config:view',
        title: 'AI配置'
    },
    {
        path: '/settings/health',
        component: LinkHealth,
        permission: 'config:view',
        title: '链接健康'
    },
    {
        path: '/settings/media',
        component: MediaManagement,
        permission: 'config:view',
        title: '资源管理'
    },
    {
        path: '/settings/data',
        component: DataManagement,
        permission: 'config:view',
        title: '数据管理'
    },

    // 用户管理 - 需要user:view权限
    {
        path: '/users',
        component: Users,
        permission: 'user:view',
        title: '用户管理'
    },

    // 系统管理 - 需要system:manage权限
    {
        path: '/permissions',
        component: Permissions,
        permission: 'system:manage',
        title: '权限管理'
    },

    // 系统监控 - 需要system:view权限
    {
        path: '/logs',
        component: Logs,
        permission: 'system:view',
        title: '系统日志'
    },
    {
        path: '/monitor',
        component: Monitor,
        permission: 'system:view',
        title: '监控面板'
    },
];
