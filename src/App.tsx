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

// 直接导入插件组件（移除iframe架构）
import DockerApp from '../plugins/docker/frontend/src/App.tsx';
import SubApp from '../plugins/sub/frontend/src/App.tsx';

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

                            {/* Unified Plugin Layout */}
                            <Route element={<PluginLayout />}>
                                {/* VPS仍使用iframe（独立Go应用），但也加上Guard */}
                                <Route path="/apps/vps" element={
                                    <PluginGuard pluginId="vps">
                                        <PluginIframe pluginId="vps" title="VPS管理" />
                                    </PluginGuard>
                                } />
                                {/* Docker和Sub直接集成，无需iframe */}
                                <Route path="/apps/docker" element={
                                    <PluginGuard pluginId="docker">
                                        <DockerApp />
                                    </PluginGuard>
                                } />
                                <Route path="/apps/sub" element={
                                    <PluginGuard pluginId="sub">
                                        <SubApp />
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
