import React from 'react';
import { Image, Container, DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface ImageListProps {
    images: Image[];
    containers: Container[];
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
    containers,
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
    // 检查镜像是否正在使用（被任何容器关联）
    const isImageInUse = (imageId: string) => {
        return containers.some(c => c.imageId === imageId || c.image === imageId);
    };
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">镜像列表</h2>
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
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shadow-blue-500/20"
                    >
                        <Icon icon="fa-solid fa-cloud-arrow-down" />
                        <span>下载镜像</span>
                    </button>
                    <button onClick={onPruneImages} className="px-4 py-2 bg-orange-600 dark:bg-orange-600 text-white rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shadow-orange-500/20">清理未使用</button>
                    <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition shadow-sm">
                        <Icon icon="fa-solid fa-refresh" />
                        <span>刷新</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-transparent border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400 font-bold">
                        <tr>
                            <th className="px-6 py-4">镜像名称 / Tag</th>
                            <th className="px-6 py-4">镜像 ID</th>
                            <th className="px-6 py-4">大小</th>
                            <th className="px-6 py-4">创建时间</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {images.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    暂无镜像
                                </td>
                            </tr>
                        ) : images.map(image => (
                            <tr key={image.id} className="hover:bg-gray-50/50 dark:hover:bg-transparent transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{image.tags[0]?.split(':')[0] || '<none>'}</span>
                                            {isImageInUse(image.id) && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white uppercase tracking-wider">
                                                    使用中
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {image.tags.map(tag => (
                                                <span key={tag} className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                    {tag.split(':')[1] || 'latest'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 w-fit">
                                        {image.id.substring(7, 19)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                    {formatBytes(image.size)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(image.created)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                const repoTag = image.tags[0];
                                                if (repoTag && repoTag !== '<none>:<none>') {
                                                    onUpdateImage(repoTag);
                                                }
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                            title="更新 (Pull)"
                                        >
                                            <Icon icon="fa-solid fa-cloud-arrow-down" />
                                        </button>
                                        <button
                                            onClick={() => onRunImage(image.tags[0] !== '<none>:<none>' ? image.tags[0] : image.id, image.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                            title="运行"
                                        >
                                            <Icon icon="fa-solid fa-play" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteImage(image.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
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
                    <div className="bg-white dark:bg-gray-900/50 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800">
                        暂无镜像
                    </div>
                ) : images.map(image => (
                    <div key={image.id} className="bg-white dark:bg-gray-900/50 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 dark:text-gray-100 text-lg">{image.tags[0]?.split(':')[0] || '<none>'}</span>
                                    {isImageInUse(image.id) && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white uppercase tracking-wider">
                                            使用中
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {image.tags.map(tag => (
                                        <span key={tag} className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {tag.split(':')[1] || 'latest'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                            <div className="font-mono bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 text-xs">
                                {image.id.substring(7, 19)}
                            </div>
                            <div className="font-mono text-xs">{formatBytes(image.size)}</div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                            <button
                                onClick={() => {
                                    const repoTag = image.tags[0];
                                    if (repoTag && repoTag !== '<none>:<none>') {
                                        onUpdateImage(repoTag);
                                    }
                                }}
                                className="flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400"
                                title="更新"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><Icon icon="fa-solid fa-cloud-arrow-down" /></div>
                                <span className="text-[10px]">更新</span>
                            </button>
                            <button
                                onClick={() => onRunImage(image.tags[0] !== '<none>:<none>' ? image.tags[0] : image.id, image.id)}
                                className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400"
                                title="运行"
                            >
                                <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center"><Icon icon="fa-solid fa-play" /></div>
                                <span className="text-[10px]">运行</span>
                            </button>
                            <button
                                onClick={() => onDeleteImage(image.id)}
                                className="flex flex-col items-center gap-1 text-red-600 dark:text-red-400"
                                title="删除"
                            >
                                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center"><Icon icon="fa-solid fa-trash" /></div>
                                <span className="text-[10px]">删除</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
