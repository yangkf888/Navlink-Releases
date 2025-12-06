import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function PluginViewer() {
    const { pluginId } = useParams<{ pluginId: string }>();
    const navigate = useNavigate();

    if (!pluginId) {
        return <div className="p-8 text-center text-gray-500">插件ID缺失</div>;
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/plugins')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        返回插件列表
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <h1 className="text-lg font-semibold text-gray-900">{pluginId}</h1>
                </div>
                <a
                    href={`/apps/${pluginId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    <ExternalLink size={16} />
                    在新标签页打开
                </a>
            </div>

            {/* iframe Container */}
            <div className="flex-1 relative">
                <iframe
                    src={`/apps/${pluginId}/`}
                    className="absolute inset-0 w-full h-full border-0"
                    title={`Plugin: ${pluginId}`}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
            </div>
        </div>
    );
}
