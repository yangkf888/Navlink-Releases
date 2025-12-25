import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Clock, Server, Container } from 'lucide-react';

interface MetricsData {
    process: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        heapUsedFormatted: string;
        rssFormatted: string;
    };
    system: {
        totalMem: number;
        usedMem: number;
        freeMem: number;
        memPercent: string;
        totalMemFormatted: string;
        usedMemFormatted: string;
    };
    container: {
        limit: number;
        usage: number;
        percent: string;
        limitFormatted: string;
        usageFormatted: string;
    } | null;
    cpu: {
        count: number;
        model: string;
        usage: string;
    };
    uptime: {
        process: number;
        system: number;
        processFormatted: string;
        systemFormatted: string;
    };
    environment: {
        nodeVersion: string;
        platform: string;
        arch: string;
        hostname: string;
        isDocker: boolean;
    };
}

interface MetricCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    percent?: number;
    iconBgColor: string;
    iconColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
    icon: Icon,
    label,
    value,
    subValue,
    percent,
    iconBgColor,
    iconColor
}) => (
    <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${iconBgColor}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-sm font-semibold text-gray-900 truncate">{value}</div>
            {subValue && <div className="text-xs text-gray-400 truncate">{subValue}</div>}
            {percent !== undefined && (
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                </div>
            )}
        </div>
    </div>
);

export default function ResourceMonitor() {
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadMetrics = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/system/metrics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setMetrics(data.data);
                setError(null);
            } else {
                setError(data.error || '加载失败');
            }
        } catch (err) {
            setError('无法连接服务器');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMetrics();
        // 每 5 秒刷新一次
        const interval = setInterval(loadMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">资源监控</h2>
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2 text-gray-500">加载中...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">资源监控</h2>
                <div className="text-center py-8 text-red-500">
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!metrics) return null;

    const isDocker = metrics.container !== null;
    const memPercent = isDocker
        ? parseFloat(metrics.container!.percent)
        : parseFloat(metrics.system.memPercent);

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">资源监控</h2>
                <div className="flex items-center gap-2">
                    {isDocker && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                            <Container className="w-3 h-3" />
                            Docker
                        </span>
                    )}
                    <span className="text-xs text-gray-400">每 5 秒刷新</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 内存使用 */}
                <MetricCard
                    icon={HardDrive}
                    label={isDocker ? "容器内存" : "系统内存"}
                    value={isDocker
                        ? `${metrics.container!.usageFormatted} / ${metrics.container!.limitFormatted}`
                        : `${metrics.system.usedMemFormatted} / ${metrics.system.totalMemFormatted}`
                    }
                    subValue={`使用率 ${memPercent}%`}
                    percent={memPercent}
                    iconBgColor="bg-purple-50"
                    iconColor="text-purple-600"
                />

                {/* 进程内存 */}
                <MetricCard
                    icon={Server}
                    label="进程内存 (RSS)"
                    value={metrics.process.rssFormatted}
                    subValue={`堆: ${metrics.process.heapUsedFormatted}`}
                    iconBgColor="bg-blue-50"
                    iconColor="text-blue-600"
                />

                {/* CPU */}
                <MetricCard
                    icon={Cpu}
                    label="CPU"
                    value={`${metrics.cpu.usage}%`}
                    subValue={`${metrics.cpu.count} 核心`}
                    percent={parseFloat(metrics.cpu.usage)}
                    iconBgColor="bg-green-50"
                    iconColor="text-green-600"
                />

                {/* 运行时间 */}
                <MetricCard
                    icon={Clock}
                    label="运行时间"
                    value={metrics.uptime.processFormatted}
                    subValue={`Node ${metrics.environment.nodeVersion}`}
                    iconBgColor="bg-orange-50"
                    iconColor="text-orange-600"
                />
            </div>

            {/* 环境信息 */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>主机: {metrics.environment.hostname}</span>
                <span>系统: {metrics.environment.platform} ({metrics.environment.arch})</span>
                <span>系统运行: {metrics.uptime.systemFormatted}</span>
            </div>
        </div>
    );
}
