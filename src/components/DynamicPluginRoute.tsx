import React from 'react';
import { useParams } from 'react-router-dom';
import PluginGuard from './PluginGuard';
import { PluginIframe } from './PluginIframe';

/**
 * 动态插件路由组件
 * 根据URL中的pluginId自动加载对应的插件
 */
const DynamicPluginRoute: React.FC = () => {
    const { pluginId } = useParams<{ pluginId: string }>();

    if (!pluginId) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-gray-500">无效的插件ID</p>
                </div>
            </div>
        );
    }

    return (
        <PluginGuard pluginId={pluginId}>
            <PluginIframe
                pluginId={pluginId}
                title={`${pluginId}管理`}
            />
        </PluginGuard>
    );
};

export default DynamicPluginRoute;
