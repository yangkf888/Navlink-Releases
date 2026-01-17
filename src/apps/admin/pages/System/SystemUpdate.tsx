import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/AdminButton';
import { ConfirmDialog } from '@/shared/components/common/ConfirmDialog';
import { AlertDialog } from '@/shared/components/common/AlertDialog';
import {
    RefreshCw,
    Download,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Clock,
    Server,
    HardDrive,
    Cpu,
    ArrowUpCircle,
    Loader2,
    Trash2,
    Archive
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface VersionInfo {
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    uptime: number;
    env: string;
    dockerImage: string;
}

interface UpdateCheckResult {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseInfo?: {
        version: string;
        name: string;
        body: string;
        publishedAt: string;
        htmlUrl: string;
    };
    checkedAt: string;
}

interface PreUpgradeCheck {
    inDocker: boolean;
    dockerAvailable: boolean;
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    diskSpace: boolean;
    canUpgrade: boolean;
    errors: string[];
}

interface UpgradeStatus {
    inProgress: boolean;
    stage: string | null;
    progress: number;
    message: string;
    startedAt: string | null;
    error: string | null;
}

interface Backup {
    name: string;
    timestamp: string;
    version?: string;
    files?: string[];
}

export default function SystemUpdate() {
    // 状态
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);
    const [preCheck, setPreCheck] = useState<PreUpgradeCheck | null>(null);
    const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus | null>(null);
    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState({
        version: true,
        check: false,
        preCheck: false,
        upgrade: false,
        backups: false
    });
    const [error, setError] = useState<string | null>(null);

    // 对话框
    const [confirmUpgrade, setConfirmUpgrade] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{ title: string; message: string } | null>(null);

    // Socket.IO 连接
    const [socket, setSocket] = useState<Socket | null>(null);

    // 获取认证 token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    };

    // 初始化 Socket.IO
    useEffect(() => {
        const newSocket = io({
            path: '/socket.io'
        });

        newSocket.on('upgrade:progress', (data: { stage: string; progress: number; message: string }) => {
            setUpgradeStatus(prev => prev ? {
                ...prev,
                stage: data.stage,
                progress: data.progress,
                message: data.message
            } : null);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    // 获取版本信息
    const fetchVersionInfo = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, version: true }));
            const response = await fetch('/api/system/version');
            if (response.ok) {
                const data = await response.json();
                setVersionInfo(data);
            }
        } catch (err) {
            console.error('Failed to fetch version info:', err);
        } finally {
            setLoading(prev => ({ ...prev, version: false }));
        }
    }, []);

    // 检查更新
    const checkForUpdate = useCallback(async (forceRefresh = false) => {
        try {
            setLoading(prev => ({ ...prev, check: true }));
            setError(null);
            // 支持强制刷新，绕过服务器缓存
            const url = forceRefresh ? '/api/system/check-update?force=true' : '/api/system/check-update';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setUpdateCheck(data);
            } else {
                const errorData = await response.json();
                setError(errorData.error || '检查更新失败');
            }
        } catch (err) {
            setError('网络错误，无法检查更新');
        } finally {
            setLoading(prev => ({ ...prev, check: false }));
        }
    }, []);

    // 升级预检查
    const runPreCheck = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, preCheck: true }));
            setError(null);
            const response = await fetch('/api/system/upgrade/check', {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setPreCheck(data);
            } else {
                const errorData = await response.json();
                setError(errorData.error || '预检查失败');
            }
        } catch (err) {
            setError('网络错误，无法进行预检查');
        } finally {
            setLoading(prev => ({ ...prev, preCheck: false }));
        }
    }, []);

    // 获取备份列表
    const fetchBackups = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, backups: true }));
            const response = await fetch('/api/system/backups', {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setBackups(data);
            }
        } catch (err) {
            console.error('Failed to fetch backups:', err);
        } finally {
            setLoading(prev => ({ ...prev, backups: false }));
        }
    }, []);

    // 🔑 新增：升级后版本验证
    const verifyUpgrade = async (expectedVersion: string, maxRetries = 5): Promise<{ success: boolean; message: string; actualVersion?: string }> => {
        for (let i = 0; i < maxRetries; i++) {
            setUpgradeStatus(prev => prev ? {
                ...prev,
                stage: 'verifying',
                progress: 95 + i,
                message: `正在验证升级结果... (${i + 1}/${maxRetries})`
            } : null);

            await new Promise(resolve => setTimeout(resolve, 10000)); // 每 10 秒检查一次

            try {
                const response = await fetch('/api/system/version');
                if (response.ok) {
                    const data = await response.json();
                    const actualVersion = data.version;

                    // 比较版本号（移除 v 前缀进行比较）
                    const expected = expectedVersion.replace(/^v/, '');
                    const actual = actualVersion.replace(/^v/, '');

                    if (actual === expected) {
                        return { success: true, message: '升级验证成功！', actualVersion };
                    }
                }
            } catch {
                // 服务可能还在重启中，继续等待
            }
        }

        return {
            success: false,
            message: '升级可能未成功完成。请手动检查版本或查看 Docker 日志。'
        };
    };

    // 执行升级
    const performUpgrade = async () => {
        try {
            setLoading(prev => ({ ...prev, upgrade: true }));
            setUpgradeStatus({
                inProgress: true,
                stage: 'init',
                progress: 0,
                message: '正在初始化升级...',
                startedAt: new Date().toISOString(),
                error: null
            });

            const response = await fetch('/api/system/upgrade', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (data.success) {
                const expectedVersion = data.newVersion;

                // 🔑 改进：显示正在重启的提示
                setAlertMessage({
                    title: '升级指令已发送',
                    message: data.note || '容器正在重启中，请等待验证...'
                });

                // 🔑 新增：等待容器重启后验证版本
                setUpgradeStatus(prev => prev ? {
                    ...prev,
                    stage: 'restarting',
                    progress: 92,
                    message: '容器正在重启，等待服务恢复...'
                } : null);

                // 等待 30 秒让容器重启
                await new Promise(resolve => setTimeout(resolve, 30000));

                // 执行版本验证
                const verifyResult = await verifyUpgrade(expectedVersion);

                if (verifyResult.success) {
                    setAlertMessage({
                        title: '🎉 升级成功',
                        message: `已成功升级到 v${verifyResult.actualVersion}！页面将自动刷新。`
                    });
                    setUpgradeStatus(prev => prev ? {
                        ...prev,
                        inProgress: false,
                        stage: 'completed',
                        progress: 100,
                        message: '升级完成！'
                    } : null);
                    // 验证成功后刷新页面
                    setTimeout(() => window.location.reload(), 3000);
                } else {
                    setAlertMessage({
                        title: '⚠️ 升级验证失败',
                        message: verifyResult.message + (data.containerName ? `\n\n调试命令：docker logs ${data.containerName} --tail 100` : '')
                    });
                    setUpgradeStatus(prev => prev ? {
                        ...prev,
                        inProgress: false,
                        stage: 'verify_failed',
                        progress: 0,
                        error: '版本验证失败'
                    } : null);
                }
            } else {
                setUpgradeStatus(prev => prev ? {
                    ...prev,
                    inProgress: false,
                    error: data.error
                } : null);
                setAlertMessage({
                    title: '升级失败',
                    message: data.error || '升级过程中发生错误'
                });
            }
        } catch (err) {
            setUpgradeStatus(prev => prev ? {
                ...prev,
                inProgress: false,
                error: '网络错误'
            } : null);
            setAlertMessage({
                title: '升级失败',
                message: '网络错误，无法执行升级'
            });
        } finally {
            setLoading(prev => ({ ...prev, upgrade: false }));
            setConfirmUpgrade(false);
        }
    };

    // 清理旧备份
    const cleanupBackups = async () => {
        try {
            const response = await fetch('/api/system/backups/cleanup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ keepCount: 3 })
            });
            if (response.ok) {
                await fetchBackups();
            }
        } catch (err) {
            console.error('Failed to cleanup backups:', err);
        }
    };

    // 删除备份
    const deleteBackup = async (name: string) => {
        try {
            const response = await fetch('/api/system/backups/delete', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                setAlertMessage({
                    title: '删除成功',
                    message: '备份已成功删除'
                });
                fetchBackups();
            } else {
                const data = await response.json();
                setAlertMessage({
                    title: '删除失败',
                    message: data.error || '删除备份失败'
                });
            }
        } catch (err) {
            setAlertMessage({
                title: '删除失败',
                message: '网络错误，无法删除备份'
            });
        }
    };

    const [backupToDelete, setBackupToDelete] = useState<string | null>(null);

    // 初始化数据加载
    useEffect(() => {
        fetchVersionInfo();
        checkForUpdate();
        fetchBackups();
    }, [fetchVersionInfo, checkForUpdate, fetchBackups]);

    // 格式化运行时间
    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}天 ${hours}小时`;
        if (hours > 0) return `${hours}小时 ${minutes}分钟`;
        return `${minutes}分钟`;
    };

    // 渲染进度条
    const renderProgressBar = (progress: number) => (
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
            />
        </div>
    );

    return (
        <div className="p-6 space-y-6 pb-20">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">系统升级</h1>
                    <p className="text-gray-500 mt-1">在线检查并升级 NavLink 到最新版本</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        fetchVersionInfo();
                        checkForUpdate(true); // 强制刷新，绕过缓存
                    }}
                    className="gap-2"
                    disabled={loading.check}
                >
                    <RefreshCw size={16} className={loading.check ? 'animate-spin' : ''} />
                    刷新
                </Button>
            </div>

            {/* 当前版本信息 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Server size={20} />
                    当前系统信息
                </h2>

                {loading.version ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                    </div>
                ) : versionInfo ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500">版本号</div>
                            <div className="text-xl font-bold text-blue-600">v{versionInfo.version}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500">运行时间</div>
                            <div className="text-lg font-semibold text-gray-900">{formatUptime(versionInfo.uptime)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500">Node.js</div>
                            <div className="text-lg font-semibold text-gray-900">{versionInfo.nodeVersion}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-500">运行环境</div>
                            <div className="text-lg font-semibold text-gray-900">{versionInfo.env}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8">无法获取版本信息</div>
                )}
            </div>

            {/* 更新检查 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ArrowUpCircle size={20} />
                    版本更新
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <XCircle className="text-red-500" size={20} />
                        <span className="text-red-700">{error}</span>
                    </div>
                )}

                {updateCheck ? (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border ${updateCheck.hasUpdate
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-green-50 border-green-200'
                            }`}>
                            <div className="flex items-center gap-3">
                                {updateCheck.hasUpdate ? (
                                    <>
                                        <AlertTriangle className="text-amber-500" size={24} />
                                        <div>
                                            <div className="font-semibold text-amber-800">
                                                有新版本可用: v{updateCheck.latestVersion}
                                            </div>
                                            <div className="text-sm text-amber-600">
                                                当前版本: v{updateCheck.currentVersion}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="text-green-500" size={24} />
                                        <div>
                                            <div className="font-semibold text-green-800">已是最新版本</div>
                                            <div className="text-sm text-green-600">
                                                版本 v{updateCheck.currentVersion}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 更新日志 */}
                        {updateCheck.hasUpdate && updateCheck.releaseInfo && (
                            <div className="mt-4">
                                <h3 className="font-semibold text-gray-900 mb-2">更新日志</h3>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-500 mb-2">
                                        {updateCheck.releaseInfo.name} - {new Date(updateCheck.releaseInfo.publishedAt).toLocaleDateString('zh-CN')}
                                    </div>
                                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                                        {updateCheck.releaseInfo.body || '暂无更新说明'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 操作按钮 */}
                        {updateCheck.hasUpdate && (
                            <div className="flex gap-3 mt-4">
                                <Button
                                    onClick={runPreCheck}
                                    variant="outline"
                                    disabled={loading.preCheck}
                                    className="gap-2"
                                >
                                    <HardDrive size={16} />
                                    {loading.preCheck ? '检查中...' : '升级预检查'}
                                </Button>
                                <Button
                                    onClick={() => setConfirmUpgrade(true)}
                                    disabled={!preCheck?.canUpgrade || loading.upgrade}
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <Download size={16} />
                                    {loading.upgrade ? '升级中...' : '立即升级'}
                                </Button>
                            </div>
                        )}

                        {/* 预检查结果 */}
                        {preCheck && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-3">预检查结果</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        {preCheck.inDocker ? (
                                            <CheckCircle className="text-green-500" size={16} />
                                        ) : (
                                            <XCircle className="text-red-500" size={16} />
                                        )}
                                        <span className="text-sm">Docker 容器环境</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {preCheck.dockerAvailable ? (
                                            <CheckCircle className="text-green-500" size={16} />
                                        ) : (
                                            <XCircle className="text-red-500" size={16} />
                                        )}
                                        <span className="text-sm">Docker 命令可用</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {preCheck.hasUpdate ? (
                                            <CheckCircle className="text-green-500" size={16} />
                                        ) : (
                                            <XCircle className="text-gray-400" size={16} />
                                        )}
                                        <span className="text-sm">有可用更新</span>
                                    </div>
                                </div>
                                {preCheck.errors.length > 0 && (
                                    <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                                        <div className="text-sm font-medium text-red-800">不满足升级条件:</div>
                                        <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                            {preCheck.errors.map((err, idx) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-gray-400 mt-2">
                            上次检查: {new Date(updateCheck.checkedAt).toLocaleString('zh-CN')}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8">
                        {loading.check ? (
                            <Loader2 className="animate-spin text-blue-500" size={24} />
                        ) : (
                            <Button onClick={() => checkForUpdate()} className="gap-2">
                                <RefreshCw size={16} />
                                检查更新
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* 升级进度 */}
            {upgradeStatus?.inProgress && (
                <div className="bg-white rounded-xl border border-blue-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Cpu className="text-blue-500" size={20} />
                        升级进度
                    </h2>
                    <div className="space-y-4">
                        {renderProgressBar(upgradeStatus.progress)}
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{upgradeStatus.message}</span>
                            <span className="text-blue-600 font-medium">{upgradeStatus.progress}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 备份管理 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Archive size={20} />
                        升级备份
                    </h2>
                    {backups.length > 3 && (
                        <Button variant="outline" size="sm" onClick={cleanupBackups} className="gap-2">
                            <Trash2 size={14} />
                            清理旧备份
                        </Button>
                    )}
                </div>

                {loading.backups ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                    </div>
                ) : backups.length > 0 ? (
                    <div className="space-y-2">
                        {backups.map((backup, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                                <div className="flex items-center gap-3">
                                    <Clock size={16} className="text-gray-400" />
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{backup.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {backup.version && `版本 v${backup.version} · `}
                                            {new Date(backup.timestamp).toLocaleString('zh-CN')}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setBackupToDelete(backup.name)}
                                >
                                    <Trash2 size={16} />
                                    删除
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8">暂无备份记录</div>
                )}
            </div>

            {/* 确认升级对话框 */}
            <ConfirmDialog
                isOpen={confirmUpgrade}
                title="确认升级"
                message="升级过程中系统将短暂不可用。升级前会自动备份数据库，请确认是否继续？"
                confirmText="确认升级"
                confirmVariant="primary"
                onConfirm={performUpgrade}
                onCancel={() => setConfirmUpgrade(false)}
            />

            {/* 确认删除备份对话框 */}
            <ConfirmDialog
                isOpen={!!backupToDelete}
                title="删除备份"
                message={`确定要删除备份 "${backupToDelete}" 吗？此操作不可恢复。`}
                confirmText="删除"
                confirmVariant="danger"
                onConfirm={() => {
                    if (backupToDelete) {
                        deleteBackup(backupToDelete);
                        setBackupToDelete(null);
                    }
                }}
                onCancel={() => setBackupToDelete(null)}
            />

            {/* 提示对话框 */}
            {alertMessage && (
                <AlertDialog
                    isOpen={!!alertMessage}
                    title={alertMessage.title}
                    message={alertMessage.message}
                    variant={alertMessage.title.includes('失败') ? 'error' : 'success'}
                    onClose={() => setAlertMessage(null)}
                />
            )}
        </div>
    );
}
