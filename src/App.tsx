import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from '@/shared/context/ConfigContext';
import { LayoutProvider } from '@/shared/context/LayoutContext';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import NavLinkHome from './apps/navlink/App';
import AppStore from './shared/store/AppStore';
import AdminApp from './apps/admin/App';
import PluginLayout from './components/layout/PluginLayout';
import { PluginIframe } from './components/PluginIframe';
import PluginGuard from './components/PluginGuard';

// 所有插件都使用 iframe 架构，不直接导入插件代码
// 这样主应用可以在没有任何插件的情况下构建和运行

function App() {
    return (
        <ErrorBoundary name="Global">
            <ConfigProvider>
                <LayoutProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<NavLinkHome />} />
                            <Route path="/store" element={<AppStore />} />
                            <Route path="/admin/*" element={<AdminApp />} />

                            {/* 所有插件使用统一的 iframe 架构 */}
                            <Route element={<PluginLayout />}>
                                {/* VPS 插件 */}
                                <Route path="/apps/vps" element={
                                    <PluginGuard pluginId="vps">
                                        <PluginIframe pluginId="vps" title="VPS管理" />
                                    </PluginGuard>
                                } />

                                {/* Docker 插件 - 改回 iframe 架构 */}
                                <Route path="/apps/docker" element={
                                    <PluginGuard pluginId="docker">
                                        <PluginIframe pluginId="docker" title="Docker管理" />
                                    </PluginGuard>
                                } />

                                {/* Sub 插件 - 改回 iframe 架构 */}
                                <Route path="/apps/sub" element={
                                    <PluginGuard pluginId="sub">
                                        <PluginIframe pluginId="sub" title="订阅管理" />
                                    </PluginGuard>
                                } />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </LayoutProvider>
            </ConfigProvider>
        </ErrorBoundary>
    );
}

export default App;
