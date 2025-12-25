import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/AdminButton';
import { Input } from '@/shared/components/ui/AdminInput';

interface LicenseStatus {
    valid: boolean;
    needsActivation: boolean;
    fingerprint: string;
    license?: {
        email: string;
        activatedAt: string;
    };
}

export const LicenseManagement: React.FC = () => {
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [newCodeDialog, setNewCodeDialog] = useState<{ code: string; remaining: number } | null>(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/system/license/status');
            const data = await res.json();
            setStatus(data);
            if (data.license?.email) {
                setEmail(data.license.email);
            }
        } catch (err) {
            console.error('Failed to fetch license status:', err);
        }
    };

    const handleRequestMigrate = async () => {
        if (!email) {
            setResult({ type: 'error', message: '请输入邮箱' });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/system/license/request-migrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    email
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // 显示新激活码弹窗
                setNewCodeDialog({
                    code: data.newActivationCode,
                    remaining: data.remainingActivations ?? 0
                });
                fetchStatus();
            } else {
                setResult({ type: 'error', message: data.error || '申请失败' });
            }
        } catch (err) {
            setResult({ type: 'error', message: '网络错误，请检查连接' });
        } finally {
            setLoading(false);
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setResult({ type: 'success', message: '激活码已复制' });
        setTimeout(() => setResult(null), 2000);
    };

    const copyFingerprint = () => {
        if (status?.fingerprint) {
            navigator.clipboard.writeText(status.fingerprint);
            setResult({ type: 'success', message: '设备指纹已复制' });
            setTimeout(() => setResult(null), 2000);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🔑
                授权管理
            </h2>

            {/* 当前状态 */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-24">授权状态:</span>
                    {status?.valid ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            ✓ 已激活
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                            ✗ 未激活
                        </span>
                    )}
                </div>

                {status?.license && (
                    <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24">授权用户:</span>
                        <span className="text-gray-900">{status.license.email}</span>
                    </div>
                )}

                {status?.license?.activatedAt && (
                    <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24">激活时间:</span>
                        <span className="text-gray-900">
                            {new Date(status.license.activatedAt).toLocaleString()}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-24">设备指纹:</span>
                    <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                        {status?.fingerprint?.slice(0, 16)}...
                    </code>
                    <button
                        onClick={copyFingerprint}
                        className="text-blue-500 hover:text-blue-700 text-sm"
                    >
                        复制
                    </button>
                </div>
            </div>

            {/* 迁移申请 */}
            {status?.valid && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-md font-medium text-gray-900 mb-3">
                        申请迁移到新设备
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        如需将授权迁移到其他设备，请输入邮箱申请新激活码。当前设备的授权将被清除。
                    </p>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                            />
                        </div>



                        {result && (
                            <div className={`p-3 rounded-lg text-sm ${result.type === 'success'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                                }`}>
                                {result.message}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            onClick={handleRequestMigrate}
                            disabled={loading}
                        >
                            {loading ? '申请中...' : '申请新激活码'}
                        </Button>
                    </div>
                </div>
            )}

            {/* 未激活时显示激活入口 */}
            {!status?.valid && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <Button
                        variant="primary"
                        onClick={() => window.location.href = '/activate'}
                    >
                        前往激活
                    </Button>
                </div>
            )}

            {/* 新激活码弹窗 */}
            {newCodeDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">🎉</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">新激活码已生成</h3>
                            <p className="text-gray-500 text-sm mb-4">请妥善保存，用于新设备激活</p>

                            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                <code className="text-2xl font-mono font-bold text-blue-600 tracking-widest">
                                    {newCodeDialog.code}
                                </code>
                            </div>

                            <button
                                onClick={() => copyCode(newCodeDialog.code)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 block w-full"
                            >
                                📋 点击复制激活码
                            </button>

                            <p className="text-xs text-gray-400 mb-4">
                                剩余可激活次数: {newCodeDialog.remaining}
                            </p>

                            <Button
                                variant="primary"
                                onClick={() => setNewCodeDialog(null)}
                                className="w-full"
                            >
                                我已保存，关闭
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LicenseManagement;
