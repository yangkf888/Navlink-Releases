import React, { useEffect, useState } from 'react';

interface PluginIframeProps {
    pluginId: string;
    title?: string;
    className?: string;
}

/**
 * 插件iframe容器组件
 * 
 * 使用iframe完全隔离插件,解决路径和WebSocket问题:
 * - 插件内的相对路径自动基于iframe的src
 * - WebSocket连接正常工作
 * - CSS/JS完全隔离
 */
export function PluginIframe({ pluginId, title, className = '' }: PluginIframeProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);


    // 获取token并构建iframe URL
    const token = localStorage.getItem('auth_token');

    // 使用绝对URL直接指向后端！
    // 这样避免被vite proxy拦截，让主应用的React Router能正常工作
    const backendPort = import.meta.env.DEV ? '3002' : window.location.port;
    const src = token
        ? `http://${window.location.hostname}:${backendPort}/apps/${pluginId}/?token=${encodeURIComponent(token)}`
        : `http://${window.location.hostname}:${backendPort}/apps/${pluginId}/`;



    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
    }, [pluginId]);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    return (
        <div className={`relative w-full h-full ${className}`}>
            {/* 加载提示 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-600">加载{title || pluginId}中...</p>
                    </div>
                </div>
            )}

            {/* 错误提示 */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <i className="fas fa-exclamation-circle text-red-500 text-5xl"></i>
                        <p className="mt-4 text-gray-800 font-medium">加载失败</p>
                        <p className="mt-2 text-gray-600">无法加载插件 {title || pluginId}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            重新加载
                        </button>
                    </div>
                </div>
            )}

            {/* iframe容器 */}
            <iframe
                src={src}
                title={title || pluginId}
                onLoad={handleLoad}
                onError={handleError}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                allow="clipboard-read; clipboard-write"
            />
        </div>
    );
}
