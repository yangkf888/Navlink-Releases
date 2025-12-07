import React from 'react';
import { Image, DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface ImageListProps {
    images: Image[];
    loading: boolean;
    error: string | null;
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
    onRefresh: () => void;
    onPullImage: () => void;
    onPruneImages: () => void;
    onUpdateImage: (tag: string) => void;
    onRunImage: (tag: string, id: string) => void;
    onDeleteImage: (id: string) => void;
}

export const ImageList: React.FC<ImageListProps> = ({
    images,
    loading,
    error,
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer,
    onRefresh,
    onPullImage,
    onPruneImages,
    onUpdateImage,
    onRunImage,
    onDeleteImage
}) => {
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (ts: number) => {
        return new Date(ts * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">镜像列表</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">镜像列表</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                    <Icon icon="fa-solid fa-triangle-exclamation" className="text-4xl text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-red-700 mb-2">无法加载镜像列表</h3>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">镜像列表</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0 self-end md:self-auto">
                    <button
                        onClick={onPullImage}
                        className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm transition flex items-center gap-2"
                    >
                        <Icon icon="fa-solid fa-cloud-arrow-down" />
                        <span>下载镜像</span>
                    </button>
                    <button onClick={onPruneImages} className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 text-sm transition">清理未使用</button>
                    <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-[var(--theme-primary)] hover:border-[var(--theme-primary)] transition">
                        <Icon icon="fa-solid fa-refresh" />
                        <span>刷新</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">镜像名称 / Tag</th>
                            <th className="px-6 py-3">镜像 ID</th>
                            <th className="px-6 py-3">大小</th>
                            <th className="px-6 py-3">创建时间</th>
                            <th className="px-6 py-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {images.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    暂无镜像
                                </td>
                            </tr>
                        ) : images.map(image => (
                            <tr key={image.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{image.tags[0]?.split(':')[0] || '<none>'}</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {image.tags.map(tag => (
                                                <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                                    {tag.split(':')[1] || 'latest'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded w-fit">
                                        {image.id.substring(7, 19)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                    {formatBytes(image.size)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {formatDate(image.created)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                const repoTag = image.tags[0];
                                                if (repoTag && repoTag !== '<none>:<none>') {
                                                    onUpdateImage(repoTag);
                                                }
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title="更新 (Pull)"
                                        >
                                            <Icon icon="fa-solid fa-cloud-arrow-down" />
                                        </button>
                                        <button
                                            onClick={() => onRunImage(image.tags[0] !== '<none>:<none>' ? image.tags[0] : image.id, image.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                            title="运行"
                                        >
                                            <Icon icon="fa-solid fa-play" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteImage(image.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="删除"
                                        >
                                            <Icon icon="fa-solid fa-trash" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {images.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">
                        暂无镜像
                    </div>
                ) : images.map(image => (
                    <div key={image.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800 text-lg">{image.tags[0]?.split(':')[0] || '<none>'}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {image.tags.map(tag => (
                                        <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                            {tag.split(':')[1] || 'latest'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                            <div className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-xs">
                                {image.id.substring(7, 19)}
                            </div>
                            <div className="font-mono">{formatBytes(image.size)}</div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                            <button
                                onClick={() => {
                                    const repoTag = image.tags[0];
                                    if (repoTag && repoTag !== '<none>:<none>') {
                                        onUpdateImage(repoTag);
                                    }
                                }}
                                className="flex flex-col items-center gap-1 text-blue-600"
                                title="更新"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Icon icon="fa-solid fa-cloud-arrow-down" /></div>
                                <span className="text-[10px]">更新</span>
                            </button>
                            <button
                                onClick={() => onRunImage(image.tags[0] !== '<none>:<none>' ? image.tags[0] : image.id, image.id)}
                                className="flex flex-col items-center gap-1 text-green-600"
                                title="运行"
                            >
                                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center"><Icon icon="fa-solid fa-play" /></div>
                                <span className="text-[10px]">运行</span>
                            </button>
                            <button
                                onClick={() => onDeleteImage(image.id)}
                                className="flex flex-col items-center gap-1 text-red-600"
                                title="删除"
                            >
                                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Icon icon="fa-solid fa-trash" /></div>
                                <span className="text-[10px]">删除</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
