import { useState, useEffect } from 'react';
import { Key, Copy, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface ActivationProps {
    onActivated?: () => void;
}

interface LicenseStatus {
    valid: boolean;
    needsActivation: boolean;
    fingerprint: string;
    license?: {
        email: string;
        activatedAt: string;
    };
}

export default function Activation({ onActivated }: ActivationProps) {
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [form, setForm] = useState({ code: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [mode, setMode] = useState<'activate' | 'recover'>('activate');
    const [recoveredCode, setRecoveredCode] = useState('');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/system/license/status');
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const res = await fetch('/api/system/license/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: form.code.toUpperCase(),
                    email: form.email
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setSuccess(`激活成功！欢迎 ${data.name || data.email}`);
                fetchStatus();
                onActivated?.();
            } else {
                setError(data.error || '激活失败');
            }
        } catch (err) {
            setError('网络错误，请检查连接');
        } finally {
            setLoading(false);
        }
    };

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setRecoveredCode('');
        setLoading(true);

        try {
            const res = await fetch('/api/system/license/recover', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: form.email
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setRecoveredCode(data.activationCode);
                setSuccess(`找回成功！剩余激活次数: ${data.remainingActivations}`);
            } else {
                setError(data.error || '找回失败');
            }
        } catch (err) {
            setError('网络错误，请检查连接');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        if (recoveredCode) {
            navigator.clipboard.writeText(recoveredCode);
            setSuccess('激活码已复制！');
        }
    };

    const copyFingerprint = () => {
        if (status?.fingerprint) {
            navigator.clipboard.writeText(status.fingerprint);
            setSuccess('设备指纹已复制');
            setTimeout(() => setSuccess(''), 2000);
        }
    };

    const switchToActivate = () => {
        setMode('activate');
        setError('');
        setSuccess('');
        setRecoveredCode('');
        if (recoveredCode) {
            setForm({ ...form, code: recoveredCode });
        }
    };

    // 已激活状态
    if (status?.valid && status.license) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">已激活</h1>
                    <p className="text-gray-500 mt-2">授权用户: {status.license.email}</p>
                    <p className="text-gray-400 text-sm mt-1">
                        激活时间: {new Date(status.license.activatedAt).toLocaleDateString()}
                    </p>
                    <button
                        onClick={() => window.location.href = '/admin'}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        进入管理后台
                    </button>
                </div>
            </div>
        );
    }

    // 需要激活
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                {mode === 'activate' ? (
                    <>
                        {/* 激活模式 */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Key className="w-8 h-8 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">激活 NavLink</h1>
                            <p className="text-gray-500 mt-2">请输入您的激活码和邮箱</p>
                        </div>

                        {/* 设备指纹 */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">设备指纹</p>
                                    <p className="font-mono text-sm text-gray-700">
                                        {status?.fingerprint?.slice(0, 16)}...
                                    </p>
                                </div>
                                <button
                                    onClick={copyFingerprint}
                                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                                    title="复制完整指纹"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleActivate} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    {success}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    激活码 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono tracking-wider"
                                    placeholder="XXXX-XXXX-XXXX"
                                    maxLength={14}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    邮箱 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !form.code || !form.email}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? '激活中...' : '激活授权'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500">
                            忘记激活码？
                            <button
                                onClick={() => { setMode('recover'); setError(''); setSuccess(''); }}
                                className="text-blue-600 hover:underline ml-1"
                            >
                                通过邮箱找回
                            </button>
                        </p>
                    </>
                ) : (
                    <>
                        {/* 找回模式 */}
                        <div className="text-center mb-8">
                            <button
                                onClick={switchToActivate}
                                className="absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Key className="w-8 h-8 text-purple-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">找回激活码</h1>
                            <p className="text-gray-500 mt-2">输入您注册时使用的邮箱</p>
                        </div>

                        {recoveredCode ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 rounded-lg text-center">
                                    <p className="text-green-600 text-sm mb-2">✅ 新激活码已生成</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <code className="text-xl font-mono font-bold text-gray-900 tracking-wider">
                                            {recoveredCode}
                                        </code>
                                        <button
                                            onClick={copyCode}
                                            className="p-2 text-gray-500 hover:bg-green-100 rounded-lg"
                                            title="复制激活码"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                    {success && (
                                        <p className="text-green-600 text-xs mt-2">{success}</p>
                                    )}
                                </div>
                                <button
                                    onClick={switchToActivate}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    使用此激活码激活
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRecover} className="space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        注册邮箱 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="your@email.com"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !form.email}
                                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? '查询中...' : '找回激活码'}
                                </button>

                                <p className="text-xs text-gray-400 text-center">
                                    找回的激活码将在新设备激活时自动使旧设备失效
                                </p>
                            </form>
                        )}

                        <button
                            onClick={switchToActivate}
                            className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                        >
                            ← 返回激活页面
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
