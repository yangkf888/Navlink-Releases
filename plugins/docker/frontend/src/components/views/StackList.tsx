/**
 * Compose Stacks 列表视图
 */
import React, { useState, useEffect } from 'react';
import { DockerServer } from '../../types/docker';
import { Icon } from '@/shared/components/common/Icon';
import ServerTabs from '../ServerTabs';

interface Stack {
    name: string;
    status: string;
    configFiles?: string;
    servicesCount: number;
    runningCount: number;
    services?: any[];
    path?: string;
    error?: string;
}

interface StackListProps {
    servers: DockerServer[];
    selectedServerId: string;
    onSelectServer: (server: DockerServer) => void;
    onAddServer: () => void;
}

export const StackList: React.FC<StackListProps> = ({
    servers,
    selectedServerId,
    onSelectServer,
    onAddServer
}) => {
    const [stacks, setStacks] = useState<Stack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [editingStack, setEditingStack] = useState<Stack | null>(null);
    const [deployingStack, setDeployingStack] = useState<string | null>(null);
    const [deployLogs, setDeployLogs] = useState<string[]>([]);
    const [deployStatus, setDeployStatus] = useState<'running' | 'success' | 'error'>('running');

    const [expandedStack, setExpandedStack] = useState<string | null>(null);

    const API_BASE = '/api/plugins/docker/api';

    const loadStacks = async () => {
        if (!selectedServerId) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/servers/${selectedServerId}/stacks`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setStacks(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStacks();
    }, [selectedServerId]);

    const handleAction = async (action: string, stackName: string, customPath?: string) => {
        try {
            if (action === 'up' || action === 'down') {
                // 使用 SSE 流
                setDeployingStack(stackName);
                setDeployStatus('running');
                setDeployLogs([`开始 ${action === 'up' ? '部署' : '停止'} ${stackName}...\n`]);

                let url = `${API_BASE}/servers/${selectedServerId}/stacks/${stackName}/${action}/stream`;
                if (customPath) {
                    url += `?path=${encodeURIComponent(customPath)}`;
                }
                const eventSource = new EventSource(url);

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.status === 'success') {
                            setDeployLogs(prev => [...prev, `\n✅ ${data.message}`]);
                            setDeployStatus('success');
                            eventSource.close();
                            loadStacks();
                        } else if (data.status === 'error') {
                            setDeployLogs(prev => [...prev, `\n❌ 错误: ${data.message}`]);
                            setDeployStatus('error');
                            eventSource.close();
                        } else if (data.message) {
                            setDeployLogs(prev => [...prev, data.message]);
                        }
                    } catch (e) {
                        setDeployLogs(prev => [...prev, event.data]);
                    }
                };

                eventSource.onerror = () => {
                    setDeployLogs(prev => [...prev, '\n❌ 连接中断']);
                    setDeployStatus('error');
                    eventSource.close();
                };
            } else {
                // 普通 POST 请求
                const res = await fetch(`${API_BASE}/servers/${selectedServerId}/stacks/${stackName}/${action}`, {
                    method: 'POST'
                });
                if (!res.ok) throw new Error(await res.text());
                loadStacks();
            }
        } catch (e: any) {
            alert(`操作失败: ${e.message}`);
        }
    };

    const handleDelete = async (stackName: string) => {
        if (!confirm(`确定要删除 Stack "${stackName}" 吗？这将停止并删除所有相关容器。`)) return;

        try {
            const res = await fetch(`${API_BASE}/servers/${selectedServerId}/stacks/${stackName}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error(await res.text());
            loadStacks();
        } catch (e: any) {
            alert(`删除失败: ${e.message}`);
        }
    };

    const handleEdit = async (stackName: string) => {
        try {
            const res = await fetch(`${API_BASE}/servers/${selectedServerId}/stacks/${stackName}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setEditingStack(data);
            setShowEditor(true);
        } catch (e: any) {
            alert(`获取详情失败: ${e.message}`);
        }
    };

    const getStatusColor = (stack: Stack) => {
        if (stack.runningCount === 0) return 'bg-gray-400';
        if (stack.runningCount === stack.servicesCount) return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]';
        return 'bg-yellow-500';
    };

    const getStatusText = (stack: Stack) => {
        if (stack.runningCount === 0) return '已停止';
        if (stack.runningCount === stack.servicesCount) return '运行中';
        return `部分运行 (${stack.runningCount}/${stack.servicesCount})`;
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">Compose Stacks</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">Compose Stacks</h2>
                        <ServerTabs
                            servers={servers}
                            selectedServerId={selectedServerId}
                            onSelect={onSelectServer}
                            onAddServer={onAddServer}
                        />
                    </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
                    <Icon icon="fa-solid fa-triangle-exclamation" className="text-4xl text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">无法加载 Stacks</h3>
                    <p className="text-red-600 dark:text-red-300">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4 overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">Compose Stacks</h2>
                    <ServerTabs
                        servers={servers}
                        selectedServerId={selectedServerId}
                        onSelect={onSelectServer}
                        onAddServer={onAddServer}
                    />
                </div>

                <div className="flex gap-2 flex-shrink-0 self-end md:self-auto">
                    <button
                        onClick={() => { setEditingStack(null); setShowEditor(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition font-bold shadow-sm"
                    >
                        <Icon icon="fa-solid fa-plus" />
                        <span>新建 Stack</span>
                    </button>
                    <button
                        onClick={loadStacks}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:border-blue-500 transition shadow-sm"
                    >
                        <Icon icon="fa-solid fa-refresh" />
                        <span>刷新</span>
                    </button>
                </div>
            </div>

            {/* Stack Cards */}
            <div className="grid gap-4">
                {stacks.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900/50 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800">
                        <Icon icon="fa-solid fa-cubes" className="text-5xl text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-lg font-medium">暂无 Compose Stacks</p>
                        <p className="text-sm mt-2">点击上方"新建 Stack"按钮创建第一个编排项目</p>
                    </div>
                ) : stacks.map(stack => (
                    <div key={stack.name} className="bg-white dark:bg-gray-900/50 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition">
                        <div
                            className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                            onClick={() => setExpandedStack(expandedStack === stack.name ? null : stack.name)}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getStatusColor(stack)}`}></div>
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{stack.name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${stack.runningCount === stack.servicesCount && stack.servicesCount > 0
                                            ? 'bg-green-500'
                                            : stack.runningCount > 0
                                                ? 'bg-yellow-500'
                                                : 'bg-gray-400'
                                            }`}>
                                            {getStatusText(stack)}
                                        </span>
                                        <Icon
                                            icon="fa-solid fa-chevron-right"
                                            className={`text-xs text-gray-400 transition-transform ${expandedStack === stack.name ? 'rotate-90' : ''}`}
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Icon icon="fa-solid fa-box" className="text-xs" />
                                            {stack.servicesCount} 服务
                                        </span>
                                        {stack.configFiles && (
                                            <span className="flex items-center gap-1 truncate max-w-[300px]" title={stack.configFiles}>
                                                <Icon icon="fa-solid fa-folder" className="text-xs" />
                                                {stack.configFiles.split('/').slice(-2).join('/')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {/* 运行中状态：显示重启和停止 */}
                                {stack.servicesCount > 0 && stack.runningCount === stack.servicesCount && (
                                    <>
                                        <button
                                            onClick={() => handleAction('restart', stack.name)}
                                            className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition"
                                            title="重启"
                                        >
                                            <Icon icon="fa-solid fa-rotate-right" />
                                        </button>
                                        <button
                                            onClick={() => handleAction('down', stack.name)}
                                            className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                                            title="停止并删除"
                                        >
                                            <Icon icon="fa-solid fa-stop" />
                                        </button>
                                    </>
                                )}

                                {/* 部分运行状态：显示启动按钮(全部)和停止按钮 */}
                                {stack.servicesCount > 0 && stack.runningCount > 0 && stack.runningCount < stack.servicesCount && (
                                    <>
                                        <button
                                            onClick={() => handleAction('up', stack.name)}
                                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                            title="启动全部"
                                        >
                                            <Icon icon="fa-solid fa-play" />
                                        </button>
                                        <button
                                            onClick={() => handleAction('down', stack.name)}
                                            className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                                            title="停止并删除"
                                        >
                                            <Icon icon="fa-solid fa-stop" />
                                        </button>
                                    </>
                                )}

                                {/* 已停止或未知状态（如磁盘扫描发现）：显示启动按钮 */}
                                {stack.runningCount === 0 && (
                                    <button
                                        onClick={() => handleAction('up', stack.name, stack.path || (stack.configFiles ? stack.configFiles.substring(0, stack.configFiles.lastIndexOf('/')) : undefined))}
                                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                        title="启动"
                                    >
                                        <Icon icon="fa-solid fa-play" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(stack.name)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                    title="编辑"
                                >
                                    <Icon icon="fa-solid fa-edit" />
                                </button>
                                <button
                                    onClick={() => handleDelete(stack.name)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                    title="删除"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
                            </div>
                        </div>

                        {/* 展开的服务详情 */}
                        {expandedStack === stack.name && (
                            <div className="bg-gray-50 dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-gray-800 p-4">
                                {stack.services && stack.services.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                                    <th className="pb-2 font-medium">服务名</th>
                                                    <th className="pb-2 font-medium">名称 / ID</th>
                                                    <th className="pb-2 font-medium">状态</th>
                                                    <th className="pb-2 font-medium">端口映射</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {stack.services.map((svc: any, idx: number) => (
                                                    <tr key={idx} className="text-gray-700 dark:text-gray-300">
                                                        <td className="py-3 font-medium text-blue-500">{svc.Service}</td>
                                                        <td className="py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs">{svc.Name}</span>
                                                                <span className="text-[10px] text-gray-500">{svc.Image}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white shadow-sm ${svc.State === 'running' || svc.Status?.includes('Up')
                                                                    ? 'bg-green-500'
                                                                    : 'bg-red-500'
                                                                }`}>
                                                                {svc.Status || svc.State}
                                                            </span>
                                                        </td>
                                                        <td className="py-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {svc.Publishers?.map((p: any, pIdx: number) => (
                                                                    <span key={pIdx} className="bg-gray-600 dark:bg-gray-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap shadow-sm">
                                                                        {p.PublishedPort ? `${p.PublishedPort}:${p.TargetPort}` : p.TargetPort}
                                                                    </span>
                                                                )) || <span className="text-gray-400">-</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                        {stack.error ? `错误: ${stack.error}` : '暂无服务信息 (Stack 可能未运行)'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Deploy Progress Modal */}
            {deployingStack && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1e1e1e] border border-gray-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#252526]">
                            <h3 className="text-gray-200 font-medium flex items-center gap-2">
                                {deployStatus === 'running' && <Icon icon="fa-solid fa-spinner fa-spin" className="text-blue-400" />}
                                {deployStatus === 'success' && <Icon icon="fa-solid fa-check-circle" className="text-green-400" />}
                                {deployStatus === 'error' && <Icon icon="fa-solid fa-exclamation-circle" className="text-red-400" />}
                                {deployStatus === 'running' ? '正在部署' : deployStatus === 'success' ? '部署完成' : '部署失败'}: {deployingStack}
                            </h3>
                            {deployStatus !== 'running' && (
                                <button
                                    onClick={() => { setDeployingStack(null); setDeployLogs([]); }}
                                    className="text-gray-400 hover:text-white transition"
                                >
                                    <Icon icon="fa-solid fa-xmark" className="text-xl" />
                                </button>
                            )}
                        </div>
                        <div className="p-4 bg-black font-mono text-xs text-gray-300 overflow-y-auto max-h-[400px] whitespace-pre-wrap">
                            {deployLogs.join('')}
                        </div>
                        {deployStatus !== 'running' && (
                            <div className="p-3 border-t border-gray-700 bg-[#252526] flex justify-end">
                                <button
                                    onClick={() => { setDeployingStack(null); setDeployLogs([]); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                >
                                    关闭
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Editor Modal - TODO: Implement full editor component */}
            {showEditor && (
                <StackEditor
                    serverId={selectedServerId}
                    stack={editingStack}
                    onClose={() => { setShowEditor(false); setEditingStack(null); }}
                    onSaved={() => { setShowEditor(false); setEditingStack(null); loadStacks(); }}
                    onDeploy={(stackName, path) => {
                        setShowEditor(false);
                        setEditingStack(null);
                        handleAction('up', stackName, path);
                    }}
                />
            )}
        </div>
    );
};

/**
 * Stack 编辑器组件
 */
interface StackEditorProps {
    serverId: string;
    stack: Stack | null;
    onClose: () => void;
    onSaved: () => void;
    onDeploy: (stackName: string, path?: string) => void;
}


const StackEditor: React.FC<StackEditorProps> = ({ serverId, stack, onClose, onSaved, onDeploy }) => {
    const [name, setName] = useState(stack?.name || '');
    const [yamlContent, setYamlContent] = useState('');
    const [envContent, setEnvContent] = useState('');
    const [targetDir, setTargetDir] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'yaml' | 'env'>('yaml');

    const API_BASE = '/api/plugins/docker/api';

    useEffect(() => {
        if (stack?.name) {
            setLoading(true);
            // 获取路径参数
            let pathParam = '';
            if (stack.configFiles) {
                const dir = stack.configFiles.substring(0, stack.configFiles.lastIndexOf('/'));
                pathParam = `?path=${encodeURIComponent(dir)}`;
            }

            // 加载现有 stack 详情
            fetch(`${API_BASE}/servers/${serverId}/stacks/${stack.name}${pathParam}`)
                .then(res => res.json())
                .then(data => {
                    setYamlContent(data.yamlContent || '');
                    setEnvContent(data.envContent || '');
                    setTargetDir(data.path || '');
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load stack:', err);
                    setLoading(false);
                });
        } else {
            // 新建模板
            setLoading(false);
            setYamlContent(`version: '3.8'

services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`);
        }
    }, [stack, serverId]);

    const handleSave = async (deploy = false) => {
        if (!name.trim()) {
            alert('请输入 Stack 名称');
            return;
        }
        if (!yamlContent.trim()) {
            alert('请输入 YAML 配置');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/servers/${serverId}/stacks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    yamlContent,
                    envContent,
                    targetDir: targetDir || undefined
                })
            });

            if (!res.ok) throw new Error(await res.text());

            if (deploy) {
                // 触发带进度的部署流
                onDeploy(name.trim(), targetDir || undefined);
            } else {
                onSaved();
            }
        } catch (e: any) {
            alert(`保存失败: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        {stack ? `编辑 Stack: ${stack.name}` : '新建 Stack'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <Icon icon="fa-solid fa-xmark" className="text-xl" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-black/40 z-[110] flex items-center justify-center backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <Icon icon="fa-solid fa-spinner fa-spin" className="text-3xl text-blue-400" />
                                <span className="text-white text-sm">正在读取配置文件...</span>
                            </div>
                        </div>
                    )}
                    {/* Stack Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stack 名称</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={!!stack}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                            placeholder="例如: my-app"
                        />
                    </div>

                    {/* Target Directory */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">保存目录（可选）</label>
                        <input
                            type="text"
                            value={targetDir}
                            onChange={e => setTargetDir(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            placeholder="默认: /opt/docker/{name}"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveTab('yaml')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'yaml'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            docker-compose.yml
                        </button>
                        <button
                            onClick={() => setActiveTab('env')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'env'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            .env 环境变量
                        </button>
                    </div>

                    {/* Editor */}
                    {activeTab === 'yaml' ? (
                        <textarea
                            value={yamlContent}
                            onChange={e => setYamlContent(e.target.value)}
                            className="w-full h-80 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none"
                            placeholder="version: '3.8'&#10;services:&#10;  app:&#10;    image: nginx"
                        />
                    ) : (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                每行一个环境变量，格式: KEY=value
                            </p>
                            <textarea
                                value={envContent}
                                onChange={e => setEnvContent(e.target.value)}
                                className="w-full h-60 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none"
                                placeholder="MYSQL_ROOT_PASSWORD=secret&#10;MYSQL_DATABASE=mydb"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                    >
                        {loading ? '保存中...' : '仅保存'}
                    </button>
                    <button
                        onClick={() => handleSave(true)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                    >
                        {loading ? '保存中...' : '保存并部署'}
                    </button>
                </div>
            </div>
        </div>
    );
};
