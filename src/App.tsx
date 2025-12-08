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

// 使用 iframe 架构支持动态安装插件
// 通过 postMessage 实现统一UI和动态侧边栏

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

                            {/* 插件使用 iframe 架构 + postMessage 通信 */}
                            <Route element={<PluginLayout />}>
                                {/* VPS 插件 */}
                                <Route path="/apps/vps" element={
                                    <PluginGuard pluginId="vps">
                                        <PluginIframe pluginId="vps" title="VPS管理" />
                                    </PluginGuard>
                                } />

                                {/* Docker 插件 */}
                                <Route path="/apps/docker" element={
                                    <PluginGuard pluginId="docker">
                                        <PluginIframe pluginId="docker" title="Docker管理" />
                                    </PluginGuard>
                                } />

                                {/* Sub 插件 */}
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
