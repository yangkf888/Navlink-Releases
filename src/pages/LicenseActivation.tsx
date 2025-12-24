
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../shared/utils/apiClient';

interface LicenseInfo {
    valid: boolean;
    instanceId: string;
    license: {
        issuedTo: string;
        expiresAt: string;
        features: string[];
    } | null;
}

const LicenseActivation: React.FC = () => {
    const [info, setInfo] = useState<LicenseInfo | null>(null);
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchInfo();
    }, []);

    const fetchInfo = async () => {
        try {
            const data = await apiGet('/api/system/license/info');
            setInfo(data);
        } catch (err) {
            console.error('Failed to fetch license info:', err);
        }
    };

    const handleActivate = async () => {
        if (!licenseKey.trim()) return;

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await apiPost('/api/system/license/activate', { licenseKey: licenseKey.trim() });
            setSuccess(true);

            // 激活成功，刷新状态并延迟跳转
            fetchInfo();
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 2000);
        } catch (err: any) {
            setError(err.message || '激活失败，请检查 Key 是否正确');
        } finally {
            setLoading(false);
        }
    };

    const copyInstanceId = () => {
        if (info?.instanceId) {
            navigator.clipboard.writeText(info.instanceId);
            alert('机器码已复制！');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">系统激活</h1>
                    <p className="text-gray-500 mt-2">请输入您的授权码以激活系统</p>
                </div>

                {success ? (
                    <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-center">
                        <p className="font-bold">✅ 激活成功！</p>
                        <p className="text-sm mt-1">正在跳转到控制台...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                机器码 (Instance ID)
                            </label>
                            <div className="flex">
                                <code className="flex-1 bg-gray-50 p-3 rounded-l-lg border border-r-0 border-gray-200 text-sm font-mono text-gray-600 truncate">
                                    {info?.instanceId || 'Loading...'}
                                </code>
                                <button
                                    onClick={copyInstanceId}
                                    className="bg-blue-50 text-blue-600 px-4 rounded-r-lg border border-l-0 border-gray-200 hover:bg-blue-100 transition-colors"
                                >
                                    复制
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                请将此机器码发送给管理员以获取授权码
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                授权码 (License Key)
                            </label>
                            <textarea
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-xs"
                                placeholder="eyJ..."
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={loading || !info?.instanceId}
                            className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${loading || !info?.instanceId
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                                }`}
                        >
                            {loading ? '正在激活...' : '立即激活'}
                        </button>
                    </>
                )}

                <div className="mt-8 text-center text-xs text-gray-400">
                    &copy; 2025 NavLink System
                </div>
            </div>
        </div>
    );
};

export default LicenseActivation;
