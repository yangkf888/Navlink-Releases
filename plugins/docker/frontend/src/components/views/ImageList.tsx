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
    onCheckUpdate: (imageName: string) => Promise<void>;
    onCheckAllUpdates: () => Promise<void>;
    updateStatuses: Record<string, { loading: boolean, hasUpdate: boolean, error?: string }>;
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
    onDeleteImage,
    onCheckUpdate,
    onCheckAllUpdates,
    updateStatuses
}) => {
    // 检查镜像是否正在使用（被任何容器关联）
    const isImageInUse = (image: Image) => {
        // 前置校验：如果没有有效 tag 的镜像，即便由于哈希匹配被搜到，也不予显示“使用中”
        if (!image.tags || image.tags.length === 0 || image.tags.includes('<none>:<none>')) return false;

        const normalizeId = (id: string) => id?.replace('sha256:', '').substring(0, 12);
        const targetImageId = normalizeId(image.id);

        // 提取所有可能的合规引用名 (如 "b3log/siyuan", "b3log/siyuan:latest")
        const validFullNames = image.tags;

        return containers.some(c => {
            // 1. ID 匹配 (最硬核的匹配)
            const cImageId = normalizeId(c.imageId);
            if (cImageId && cImageId === targetImageId) return true;

            // 2. 标识匹配 (针对 c.image 可能是 ID 或 Tag 的情况)
            if (!c.image) return false;

            // 如果容器上记录的是镜像 ID 且匹配
            if (normalizeId(c.image) === targetImageId) return true;

            // 如果容器上记录的是镜像名，进行精准或后缀匹配
            // 处理情况 A: c.image == "b3log/siyuan:latest", image.tags 包含 "b3log/siyuan:latest"
            if (validFullNames.includes(c.image)) return true;

            // 处理情况 B: c.image == "b3log/siyuan" (缺省 latest), 而 image.tags 包含 "b3log/siyuan:latest"
            if (validFullNames.some(tag => tag === `${c.image}:latest` || tag === c.image)) return true;

            return false;
        });
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
                    <button
                        onClick={onCheckAllUpdates}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                    >
                        <Icon icon="fa-solid fa-arrows-rotate" className={loading ? 'animate-spin' : ''} />
                        <span>检查更新</span>
                    </button>
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
                                            <span className="font-bold text-gray-800 dark:text-gray-200">
                                                {(() => {
                                                    // 1. 如果镜像本身有有效标签，直接用
                                                    if (image.tags && image.tags.length > 0 && image.tags[0] !== '<none>:<none>') {
                                                        return image.tags[0].split(':')[0];
                                                    }

                                                    // 2. 如果是 <none>，尝试从关联容器中找到它启动时的“名分”
                                                    // 注意：我们在 containers 列表中查找时，c.image 有可能是 ID，也有可能是 RepoTag
                                                    const relatedContainer = containers.find(c => c.imageId === image.id || c.image === image.id);

                                                    if (relatedContainer) {
                                                        // 优先从容器数据中寻找人名（避开 sha256 这种机器名）
                                                        // 即使 relatedContainer.image 是 ID，我们可以通过容器名称推测
                                                        const rawName = relatedContainer.image || '';
                                                        if (rawName && !rawName.startsWith('sha256:')) {
                                                            return rawName.split(':')[0] + ' (旧版本)';
                                                        }

                                                        // 终极兜底：如果连镜像名都变成了哈希，那就用容器名来命名这个镜像块
                                                        // 比如展示为 "siyuan-container 引用的镜像 (旧版本)"
                                                        const cName = relatedContainer.name?.replace(/^\//, '') || '';
                                                        if (cName) {
                                                            return `${cName} 引用的镜像 (旧版本)`;
                                                        }
                                                    }

                                                    return '未知镜像 (旧版本)';
                                                })()}
                                            </span>
                                            {isImageInUse(image) && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white uppercase tracking-wider">
                                                    使用中
                                                </span>
                                            )}
                                            {updateStatuses[image.tags[0]]?.hasUpdate && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-500 text-white uppercase tracking-wider animate-pulse">
                                                    有更新
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {image.tags.length > 0 && image.tags[0] !== '<none>:<none>' ? (
                                                image.tags.map(tag => (
                                                    <span key={tag} className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        {tag.split(':')[1] || 'latest'}
                                                    </span>
                                                ))
                                            ) : (() => {
                                                const relatedContainer = containers.find(c => c.imageId === image.id || c.image === image.id);
                                                const isRunning = relatedContainer?.state === 'running';
                                                return (
                                                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider shadow-md ${isRunning ? 'bg-red-600 animate-pulse' : 'bg-gray-500'}`}>
                                                        {isRunning ? '已过期但运行中' : '已过期且已停止'}
                                                    </span>
                                                );
                                            })()}
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
                                                    onCheckUpdate(repoTag);
                                                }
                                            }}
                                            disabled={updateStatuses[image.tags[0]]?.loading}
                                            className={`p-2 rounded-lg transition ${updateStatuses[image.tags[0]]?.loading ? 'text-gray-300' : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                                            title="检查更新"
                                        >
                                            <Icon icon="fa-solid fa-arrows-rotate" className={updateStatuses[image.tags[0]]?.loading ? 'animate-spin' : ''} />
                                        </button>
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
            </div >

            {/* Mobile Card View */}
            < div className="md:hidden space-y-3" >
                {
                    images.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900/50 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800">
                            暂无镜像
                        </div>
                    ) : images.map(image => (
                        <div key={image.id} className="bg-white dark:bg-gray-900/50 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800 dark:text-gray-100 text-lg">{image.tags[0]?.split(':')[0] || '<none>'}</span>
                                        {isImageInUse(image) && (
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
                    ))
                }
            </div >
        </div >
    );
};
