import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Auth/Login';

// 系统管理页面
import PluginList from './pages/System/Plugins/PluginList';
import PluginMarket from './pages/System/Plugins/PluginMarket';
import PluginViewer from './pages/System/Plugins/PluginViewer';
import Users from './pages/System/Users';
import Permissions from './pages/System/Permissions';
import Tenants from './pages/System/Tenants';
import Logs from './pages/System/Logs';
import AIConfig from './pages/System/AIConfig';
import LinkHealth from './pages/System/LinkHealth';
import MediaManagement from './pages/System/MediaManagement';
import DataManagement from './pages/System/DataManagement';
import Monitor from './pages/System/Monitor';

// 内容管理页面
import BasicSettings from './pages/Content/BasicSettings';
import TopNavSettings from './pages/Content/TopNavSettings';
import HeroSettings from './pages/Content/HeroSettings';
import PromoSettings from './pages/Content/PromoSettings';
import CategorySettings from './pages/Content/CategorySettings';
import SidebarSettings from './pages/Content/SidebarSettings';

export default function AdminApp() {
    return (
        <Routes>
            {/* 登录页面 - 不需要AdminLayout */}
            <Route path="/login" element={<Login />} />
            
            {/* 其他页面 - 需要AdminLayout和认证 */}
            <Route path="/*" element={
                <AdminLayout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        
                        {/* 内容管理路由 */}
                        <Route path="/settings/basic" element={<BasicSettings />} />
                        <Route path="/settings/topnav" element={<TopNavSettings />} />
                        <Route path="/settings/hero" element={<HeroSettings />} />
                        <Route path="/settings/promo" element={<PromoSettings />} />
                        <Route path="/settings/categories" element={<CategorySettings />} />
                        <Route path="/settings/sidebar" element={<SidebarSettings />} />
                        
                        {/* 系统管理路由 */}
                        <Route path="/plugin-market" element={<PluginMarket />} />
                        <Route path="/plugins" element={<PluginList />} />
                        <Route path="/plugins/:pluginId" element={<PluginViewer />} />
                        <Route path="/settings/ai" element={<AIConfig />} />
                        <Route path="/settings/health" element={<LinkHealth />} />
                        <Route path="/settings/media" element={<MediaManagement />} />
                        <Route path="/settings/data" element={<DataManagement />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/permissions" element={<Permissions />} />
                        <Route path="/tenants" element={<Tenants />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="/monitor" element={<Monitor />} />
                    </Routes>
                </AdminLayout>
            } />
        </Routes>
    );
}
