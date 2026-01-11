import React from 'react';
import { Network, DockerServer, Container } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface NetworkListProps {
    networks: Network[];
    containers: Container[];
    loading: boolean;
    error: string | null;
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
    onRefresh: () => void;
    onDeleteNetwork: (networkId: string) => void;
}

export const NetworkList: React.FC<NetworkListProps> = ({
    networks,
    containers,
    loading,
    error,
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer,
    onRefresh,
    onDeleteNetwork
}) => {
    const isNetworkInUse = (networkName: string) => {
        return containers.some(c => c.networks && c.networks.includes(networkName));
    };
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">网络列表</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>
                <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition self-end md:self-auto shadow-sm">
                    <Icon icon="fa-solid fa-refresh" />
                    <span>刷新</span>
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-transparent border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400 font-bold">
                        <tr>
                            <th className="px-6 py-4">名称 / ID</th>
                            <th className="px-6 py-4">驱动</th>
                            <th className="px-6 py-4">范围</th>
                            <th className="px-6 py-4">内部</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {networks.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    暂无网络
                                </td>
                            </tr>
                        ) : networks.map(network => (
                            <tr key={network.id} className="hover:bg-gray-50/50 dark:hover:bg-transparent transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-gray-800 dark:text-gray-200">{network.name}</div>
                                        {isNetworkInUse(network.name) && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white uppercase tracking-wider">
                                                使用中
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 w-fit">{network.id ? network.id.substring(0, 12) : '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-wider">{network.driver}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 bg-purple-500 text-white rounded text-[10px] font-bold uppercase tracking-wider">{network.scope}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {network.internal ? (
                                        <span className="text-white bg-green-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Yes</span>
                                    ) : (
                                        <span className="text-white bg-gray-400 dark:bg-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">No</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onDeleteNetwork(network.id)}
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
                {networks.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900/50 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800">
                        暂无网络
                    </div>
                ) : networks.map(network => (
                    <div key={network.id} className="bg-white dark:bg-gray-900/50 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-gray-800 dark:text-gray-100 text-lg">{network.name}</div>
                                    {isNetworkInUse(network.name) && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500 text-white uppercase tracking-wider">
                                            使用中
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 w-fit">
                                    {network.id ? network.id.substring(0, 12) : '-'}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                                {network.internal && (
                                    <span className="text-white bg-green-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono">Internal</span>
                                )}
                                <button
                                    onClick={() => onDeleteNetwork(network.id)}
                                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white rounded-lg hover:brightness-110 transition shadow-sm"
                                >
                                    删除
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mt-3">
                            <div>
                                <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase block mb-1">Driver</span>
                                <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold uppercase">{network.driver}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase block mb-1">Scope</span>
                                <span className="px-1.5 py-0.5 bg-purple-500 text-white rounded text-[10px] font-bold uppercase">{network.scope}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
