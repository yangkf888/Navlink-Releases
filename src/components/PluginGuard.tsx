import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PluginGuardProps {
    pluginId: string;
    children: React.ReactNode;
}

interface Plugin {
    id: string;
    status: string;
    name: string;
}

export default function PluginGuard({ pluginId, children }: PluginGuardProps) {
    const navigate = useNavigate();
    const [status, setStatus] = useState<string>('checking'); // checking, running, stopped, error
    const [pluginName, setPluginName] = useState<string>(pluginId);

    const checkStatus = async () => {
        try {
            // 简单防抖，避免渲染瞬间闪烁
            // setStatus('checking'); 

            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/plugins', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // 如果API报错（比如未登录），暂时放行或跳转，防止死循环
                // 这里选择显示错误
                console.error('PluginGuard: API Error', response.status);
                // 如果是401，应该由全局拦截处理，这里暂不强行跳转以免冲突
                if (response.status === 401) {
                    setStatus('error'); // 让用户去登录
                    return;
                }
                throw new Error('Failed to fetch plugins');
            }

            const plugins: Plugin[] = await response.json();
            const plugin = plugins.find(p => p.id === pluginId);

            if (plugin) {
                setPluginName(plugin.name || pluginId);
                // 只有明确是 running 才放行，否则一律视为停止
                setStatus(plugin.status === 'running' ? 'running' : 'stopped');
            } else {
                setStatus('not_found');
            }
        } catch (error) {
            console.error('PluginGuard Check Failed:', error);
            setStatus('error');
        }
    };

    useEffect(() => {
        checkStatus();

        // 轮询检查状态，实现“启动后自动恢复”
        const interval = setInterval(() => {
            // 仅在非运行状态下轮询，或者一直轮询以检测停止？
            // 为了实时性，一直轮询（低频）
            checkStatus();
        }, 3000);

        return () => clearInterval(interval);
    }, [pluginId]);

    // Icon Components (Inline SVG)
    const LoadingIcon = () => (
        <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );

    const StopIcon = () => (
        <svg className="h-16 w-16 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );

    // Render States
    if (status === 'checking') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <LoadingIcon />
                <p className="mt-4 text-gray-500 font-medium">Verified Plugin Status...</p>
            </div>
        );
    }

    if (status === 'stopped') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <div className="text-center max-w-lg bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                    <StopIcon />
                    <h2 className="mt-6 text-2xl font-bold text-gray-900">🚫 插件已停止</h2>
                    <p className="mt-3 text-gray-600">
                        <span className="font-semibold text-gray-800">{pluginName}</span> 服务当前不可用。
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        如果您是管理员，请前往插件管理页面启动该服务。
                    </p>

                    <div className="mt-8 flex justify-center gap-4">
                        <button
                            onClick={() => navigate('/admin/plugins')}
                            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-medium"
                        >
                            前往管理后台
                        </button>
                        <button
                            onClick={checkStatus}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-all font-medium"
                        >
                            重试连接
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'not_found') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Plugin Not Found (404)</h2>
                    <p className="mt-2 text-gray-600">ID: {pluginId}</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        // 出错时，为了不完全阻断（比如网络抖动），也许显示一个带重试的界面
        // 或者如果觉得出错也得拦，就显示错误页。这里偏向安全：显示错误。
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100 text-center">
                    <p className="text-red-500 font-medium mb-4">验证插件状态失败</p>
                    <button
                        onClick={checkStatus}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        重试
                    </button>
                </div>
            </div>
        );
    }

    // Running: 放行
    return <>{children}</>;
}
