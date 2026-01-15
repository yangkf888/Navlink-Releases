import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/components/common/Icon';

interface PullProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    imageName: string;
    onSuccess?: () => void;
}

export const PullProgressModal: React.FC<PullProgressModalProps> = ({
    isOpen,
    onClose,
    serverId,
    imageName,
    onSuccess
}) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'pulling' | 'success' | 'error'>('pulling');
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen || !serverId || !imageName) {
            if (!isOpen) {
                setLogs([]);
                setStatus('pulling');
            }
            return;
        }

        setLogs([`开始拉取镜像: ${imageName}...`]);
        setStatus('pulling');

        const token = localStorage.getItem('auth_token');
        // 使用 query 参数传递 token，因为 EventSource 不支持直接设置 Header
        const url = `/api/plugins/docker/api/servers/${serverId}/images/pull/stream?imageName=${encodeURIComponent(imageName)}&token=${token}`;

        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'success') {
                    setStatus('success');
                    setLogs(prev => [...prev, '✓ 镜像拉取成功！']);
                    if (onSuccess) onSuccess();
                    eventSource.close();
                } else if (data.status === 'error') {
                    setStatus('error');
                    setLogs(prev => [...prev, `✗ 错误: ${data.message || '未知错误'}`]);
                    eventSource.close();
                } else {
                    // Docker pull JSON contains status, id, progress
                    const logLine = `${data.id ? `[${data.id}] ` : ''}${data.status}${data.progress ? `: ${data.progress}` : ''}`;
                    setLogs(prev => {
                        // 优化：相同 ID 的状态更新可以尝试替换最后一行，避免日志过多
                        // 但对于简单的终端实现，直接追加也可以
                        return [...prev, logLine];
                    });
                }
            } catch (e) {
                setLogs(prev => [...prev, event.data]);
            }
        };

        eventSource.onerror = (err) => {
            console.error('EventSource failed:', err);
            // EventSource 在这里可能会自动尝试重连，但对于拉取任务，一旦断开通常意味着失败
            // 我们暂不自动标记错误，由后端发送成功/错误消息为准
        };

        return () => {
            eventSource.close();
        };
    }, [isOpen, serverId, imageName]);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-gray-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#252526]">
                    <h3 className="text-gray-200 font-medium flex items-center gap-2">
                        <Icon icon="fa-solid fa-download" className="text-blue-400" />
                        镜像拉取进度: {imageName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <Icon icon="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="p-4 bg-black font-mono text-xs text-gray-300 overflow-y-auto flex-1 min-h-[400px]">
                    <div className="space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className={`whitespace-pre-wrap break-all ${log.startsWith('✓') ? 'text-green-400 font-bold' : log.startsWith('✗') ? 'text-red-400 font-bold' : ''}`}>
                                {log}
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-[#252526]">
                    <div className="text-sm">
                        {status === 'pulling' && (
                            <span className="text-blue-400 flex items-center gap-2">
                                <Icon icon="fa-solid fa-spinner fa-spin" />
                                正在从 Registry 下载并解压...
                            </span>
                        )}
                        {status === 'success' && (
                            <span className="text-green-400 flex items-center gap-2">
                                <Icon icon="fa-solid fa-circle-check" />
                                拉取完成
                            </span>
                        )}
                        {status === 'error' && (
                            <span className="text-red-400 flex items-center gap-2">
                                <Icon icon="fa-solid fa-circle-exclamation" />
                                拉取失败
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${status === 'pulling'
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                            }`}
                        disabled={status === 'pulling'}
                    >
                        {status === 'pulling' ? '正在拉取...' : '关闭容器'}
                    </button>
                </div>
            </div>
        </div>
    );
};
