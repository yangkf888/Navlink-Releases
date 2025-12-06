import { VpsServer, VpsGroup } from '../types';
import { Icon } from './common/Icon';

interface ServerListProps {
    servers: VpsServer[];
    groups: VpsGroup[];
    onConnect: (serverId: string) => void;
    onEdit: (server: VpsServer) => void;
    onDelete: (serverId: string) => void;
}

export default function ServerList({ servers, onConnect, onEdit, onDelete }: ServerListProps) {
    if (servers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                    <Icon icon="fa-solid fa-server" className="text-3xl" />
                </div>
                <h3 className="text-lg font-medium text-gray-400">No servers found</h3>
                <p className="text-sm mt-1">Add your first VPS to get started</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servers.map(server => (
                <div key={server.id} className="bg-[#2d2d2d] rounded-xl border border-[#3d3d3d] shadow-lg hover:shadow-xl hover:border-blue-500/30 transition-all duration-200 p-6 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-900/30 flex items-center justify-center text-blue-400 flex-shrink-0 border border-blue-500/20">
                                <Icon icon="fa-solid fa-server" className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-200 leading-tight">{server.name}</h3>
                                <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                    <span>{server.host}</span>
                                    {server.port !== 22 && <span className="text-xs bg-gray-800 px-1.5 rounded text-gray-400">:{server.port}</span>}
                                </div>
                            </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${server.status === 'online' ? 'bg-green-900/20 text-green-400 border-green-500/20' :
                            server.status === 'offline' ? 'bg-red-900/20 text-red-400 border-red-500/20' :
                                'bg-yellow-900/20 text-yellow-400 border-yellow-500/20'
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${server.status === 'online' ? 'bg-green-500' :
                                    server.status === 'offline' ? 'bg-red-500' :
                                        'bg-yellow-500'
                                    }`}></span>
                                {server.status ? server.status.toUpperCase() : 'UNKNOWN'}
                            </div>
                        </div>
                    </div>

                    <div className="pl-[64px] space-y-2 mb-6">
                        {server.os_info && (
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <Icon icon="fa-brands fa-linux" className="w-4 text-center text-gray-600" />
                                <span>{server.os_info}</span>
                            </div>
                        )}
                        {server.cpu_info && (
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <Icon icon="fa-solid fa-microchip" className="w-4 text-center text-gray-600" />
                                <span>{server.cpu_info}</span>
                            </div>
                        )}
                    </div>

                    <div className="pl-[64px] flex gap-3">
                        <button
                            onClick={() => onConnect(server.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Icon icon="fa-solid fa-terminal" />
                            终端
                        </button>
                        <button
                            onClick={() => onEdit(server)}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#3d3d3d] text-gray-400 hover:bg-[#4d4d4d] hover:text-white transition-colors border border-[#4d4d4d]"
                            title="Settings"
                        >
                            <Icon icon="fa-solid fa-cog" />
                        </button>
                        <button
                            onClick={() => onDelete(server.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#3d3d3d] text-gray-400 hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-colors border border-[#4d4d4d]"
                            title="Delete"
                        >
                            <Icon icon="fa-solid fa-trash" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
