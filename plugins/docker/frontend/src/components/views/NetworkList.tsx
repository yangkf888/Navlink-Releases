import React from 'react';
import { Network, DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface NetworkListProps {
    networks: Network[];
    loading: boolean;
    error: string | null;
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
    onRefresh: () => void;
}

export const NetworkList: React.FC<NetworkListProps> = ({
    networks,
    loading,
    error,
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer,
    onRefresh
}) => {
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">网络列表</h2>
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
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">网络列表</h2>
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
                    <h3 className="text-lg font-bold text-red-700 mb-2">无法加载网络列表</h3>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">网络列表</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>
                <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-[var(--theme-primary)] hover:border-[var(--theme-primary)] transition self-end md:self-auto">
                    <Icon icon="fa-solid fa-refresh" />
                    <span>刷新</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">名称 / ID</th>
                            <th className="px-6 py-3">驱动</th>
                            <th className="px-6 py-3">范围</th>
                            <th className="px-6 py-3">内部</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {networks.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    暂无网络
                                </td>
                            </tr>
                        ) : networks.map(network => (
                            <tr key={network.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{network.name}</div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{network.id ? network.id.substring(0, 12) : '-'}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{network.driver}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{network.scope}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {network.internal ? (
                                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">Yes</span>
                                    ) : (
                                        <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded text-xs">No</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {networks.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">
                        暂无网络
                    </div>
                ) : networks.map(network => (
                    <div key={network.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-gray-800 text-lg">{network.name}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                    {network.id ? network.id.substring(0, 12) : '-'}
                                </div>
                            </div>
                            {network.internal && (
                                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">Internal</span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-3">
                            <div>
                                <span className="text-gray-400 text-xs block">Driver</span>
                                {network.driver}
                            </div>
                            <div>
                                <span className="text-gray-400 text-xs block">Scope</span>
                                {network.scope}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
