import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layout/AdminLayout';
import Login from './pages/Auth/Login';
import { adminRoutes } from './config/routes';
import ProtectedRoute from './components/ProtectedRoute';

import Activation from './pages/Activation';

export default function AdminApp() {
    return (
        <Routes>
            {/* 登录页面 - 不需要AdminLayout */}
            <Route path="/login" element={<Login />} />

            {/* License 激活页面 - 不需要AdminLayout/登录 */}
            <Route path="/license/activate" element={<Activation />} />

            {/* 其他页面 - 需要AdminLayout和认证 */}
            <Route path="/*" element={
                <AdminLayout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

                        {/* 根据配置文件动态生成路由 */}
                        {adminRoutes.map((route) => (
                            <Route
                                key={route.path}
                                path={route.path}
                                element={
                                    <ProtectedRoute
                                        permission={route.permission}
                                        requireAll={route.requireAll}
                                    >
                                        <route.component />
                                    </ProtectedRoute>
                                }
                            />
                        ))}
                    </Routes>
                </AdminLayout>
            } />
        </Routes>
    );
}
