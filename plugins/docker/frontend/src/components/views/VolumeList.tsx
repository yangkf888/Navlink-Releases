import React from 'react';
import { Volume, DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface VolumeListProps {
    volumes: Volume[];
    loading: boolean;
    error: string | null;
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
    onRefresh: () => void;
    onPruneVolumes: () => void;
    onDeleteVolume: (name: string) => void;
}

export const VolumeList: React.FC<VolumeListProps> = ({
    volumes,
    loading,
    error,
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer,
    onRefresh,
    onPruneVolumes,
    onDeleteVolume
}) => {
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">卷列表</h2>
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
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">卷列表</h2>
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
                    <h3 className="text-lg font-bold text-red-700 mb-2">无法加载卷列表</h3>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">卷列表</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>
                <div className="flex gap-2 flex-shrink-0 self-end md:self-auto">
                    <button onClick={onPruneVolumes} className="px-4 py-2 bg-orange-600 dark:bg-orange-600 text-white rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shadow-orange-500/20">清理未使用</button>
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
                            <th className="px-6 py-4">卷名称</th>
                            <th className="px-6 py-4">驱动</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {volumes.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                                    暂无卷
                                </td>
                            </tr>
                        ) : volumes.map(volume => (
                            <tr key={volume.name} className="hover:bg-gray-50/50 dark:hover:bg-transparent transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">{volume.name}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-wider">{volume.driver}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onDeleteVolume(volume.name)}
                                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white rounded-lg hover:brightness-110 transition shadow-sm"
                                    >
                                        删除
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {volumes.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900/50 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800">
                        暂无卷
                    </div>
                ) : volumes.map(volume => (
                    <div key={volume.name} className="bg-white dark:bg-gray-900/50 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-gray-800 dark:text-gray-100 text-lg break-all">{volume.name}</div>
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase block mb-1">Driver</span>
                            <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold uppercase">{volume.driver}</span>
                        </div>

                        <div className="flex items-center justify-end pt-3 border-t border-gray-50 dark:border-gray-800">
                            <button
                                onClick={() => onDeleteVolume(volume.name)}
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
