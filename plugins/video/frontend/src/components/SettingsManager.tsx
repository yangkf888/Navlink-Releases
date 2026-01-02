import { useState, useEffect } from 'react';
import { Settings } from '../types';
import { apiGet, apiPost, apiPut } from '../utils/api';

interface SettingsManagerProps {
    onSettingsChange?: () => void;
}

export function SettingsManager({ onSettingsChange }: SettingsManagerProps) {
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 测试状态
    const [testingProxy, setTestingProxy] = useState(false);
    const [testingTmdb, setTestingTmdb] = useState(false);
    const [proxyTestResult, setProxyTestResult] = useState<{ valid: boolean; message: string } | null>(null);
    const [tmdbTestResult, setTmdbTestResult] = useState<{ valid: boolean; message: string } | null>(null);

    // 密码确认
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        const res = await apiGet<Settings>('/settings');
        if (res.success && res.data) {
            setSettings(res.data);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        // 验证密码确认
        if (settings.admin_password_enabled && settings.admin_password) {
            if (settings.admin_password !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }
        }

        setSaving(true);
        const res = await apiPut('/settings', settings);
        if (res.success) {
            alert('设置已保存');
            onSettingsChange?.();
        } else {
            alert('保存失败: ' + res.error);
        }
        setSaving(false);
    };

    const handleTestProxy = async () => {
        setTestingProxy(true);
        setProxyTestResult(null);

        const res = await apiPost<{ valid: boolean; message: string }>('/settings/test-proxy', {
            proxy_type: settings.proxy_type,
            proxy_host: settings.proxy_host,
            proxy_port: settings.proxy_port,
            proxy_auth_enabled: settings.proxy_auth_enabled,
            proxy_username: settings.proxy_username,
            proxy_password: settings.proxy_password
        });

        if (res.success) {
            setProxyTestResult({ valid: res.data?.valid || false, message: res.data?.message || '测试完成' });
        } else {
            setProxyTestResult({ valid: false, message: res.error || '测试失败' });
        }
        setTestingProxy(false);
    };

    const handleTestTmdb = async () => {
        setTestingTmdb(true);
        setTmdbTestResult(null);

        const res = await apiPost<{ valid: boolean; message: string }>('/settings/test-tmdb', {
            api_key: settings.tmdb_api_key
        });

        if (res.success) {
            setTmdbTestResult({ valid: res.data?.valid || false, message: res.data?.message || '测试完成' });
        } else {
            setTmdbTestResult({ valid: false, message: res.error || '测试失败' });
        }
        setTestingTmdb(false);
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-800 rounded w-full"></div>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-800 rounded"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 代理配置 */}
            <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-network-wired text-blue-400"></i>
                    代理配置
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                    配置网络代理服务器，用于访问外部采集站和资源
                </p>

                <div className="space-y-4">
                    {/* 启用开关 */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.proxy_enabled || false}
                            onChange={e => setSettings(prev => ({ ...prev, proxy_enabled: e.target.checked }))}
                            className="w-5 h-5 rounded"
                        />
                        <span className="text-gray-300">启用代理</span>
                    </label>

                    {settings.proxy_enabled && (
                        <>
                            {/* 代理类型 */}
                            <div className="max-w-xs">
                                <label className="block text-gray-400 text-sm mb-2">代理类型</label>
                                <select
                                    value={settings.proxy_type || 'http'}
                                    onChange={e => setSettings(prev => ({ ...prev, proxy_type: e.target.value as 'http' | 'socks5' }))}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                             focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="http">HTTP</option>
                                    <option value="socks5">SOCKS5</option>
                                </select>
                            </div>

                            {/* 服务器地址和端口 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3">
                                    <label className="block text-gray-400 text-sm mb-2">服务器地址</label>
                                    <input
                                        type="text"
                                        value={settings.proxy_host || ''}
                                        onChange={e => setSettings(prev => ({ ...prev, proxy_host: e.target.value }))}
                                        placeholder="127.0.0.1"
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                                 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">端口</label>
                                    <input
                                        type="number"
                                        value={settings.proxy_port || ''}
                                        onChange={e => setSettings(prev => ({ ...prev, proxy_port: parseInt(e.target.value) || 0 }))}
                                        placeholder="7890"
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                                 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* 认证 */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.proxy_auth_enabled || false}
                                    onChange={e => setSettings(prev => ({ ...prev, proxy_auth_enabled: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-gray-400 text-sm">需要认证</span>
                            </label>

                            {settings.proxy_auth_enabled && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">用户名</label>
                                        <input
                                            type="text"
                                            value={settings.proxy_username || ''}
                                            onChange={e => setSettings(prev => ({ ...prev, proxy_username: e.target.value }))}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                                     focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">密码</label>
                                        <input
                                            type="password"
                                            value={settings.proxy_password || ''}
                                            onChange={e => setSettings(prev => ({ ...prev, proxy_password: e.target.value }))}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                                     focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 测试按钮 */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleTestProxy}
                                    disabled={testingProxy || !settings.proxy_host || !settings.proxy_port}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                                             transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {testingProxy ? (
                                        <><i className="fas fa-spinner fa-spin"></i> 测试中...</>
                                    ) : (
                                        <><i className="fas fa-plug"></i> 测试连接</>
                                    )}
                                </button>
                                {proxyTestResult && (
                                    <span className={`text-sm ${proxyTestResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                                        <i className={`fas fa-${proxyTestResult.valid ? 'check' : 'times'} mr-1`}></i>
                                        {proxyTestResult.message}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 安全设置 */}
            <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-shield-alt text-green-400"></i>
                    安全设置
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                    开启后访问后台需要输入密码，输入密码也可查看隐藏的视频源
                </p>

                <div className="space-y-4">
                    {/* 启用开关 */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.admin_password_enabled || false}
                            onChange={e => setSettings(prev => ({ ...prev, admin_password_enabled: e.target.checked }))}
                            className="w-5 h-5 rounded"
                        />
                        <span className="text-gray-300">启用访问密码</span>
                    </label>

                    {settings.admin_password_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">设置密码</label>
                                <input
                                    type="password"
                                    value={settings.admin_password || ''}
                                    onChange={e => setSettings(prev => ({ ...prev, admin_password: e.target.value }))}
                                    placeholder="输入访问密码"
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                             focus:border-green-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">确认密码</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="再次输入密码"
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                             focus:border-green-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TMDB API 设置 */}
            <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-film text-purple-400"></i>
                    TMDB API 设置
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                    API Key 用于获取电影、电视剧的详细信息、海报、演员等信息
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">API Key</label>
                        <input
                            type="text"
                            value={settings.tmdb_api_key || ''}
                            onChange={e => setSettings(prev => ({ ...prev, tmdb_api_key: e.target.value }))}
                            placeholder="输入 TMDB API Key"
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 
                                     focus:border-purple-500 focus:outline-none"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                            从 <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-purple-400 hover:underline">TMDB</a> 获取
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleTestTmdb}
                            disabled={testingTmdb || !settings.tmdb_api_key}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 
                                     transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {testingTmdb ? (
                                <><i className="fas fa-spinner fa-spin"></i> 测试中...</>
                            ) : (
                                <><i className="fas fa-check-circle"></i> 测试连接</>
                            )}
                        </button>
                        {tmdbTestResult && (
                            <span className={`text-sm ${tmdbTestResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                                <i className={`fas fa-${tmdbTestResult.valid ? 'check' : 'times'} mr-1`}></i>
                                {tmdbTestResult.message}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 保存按钮 */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 
                         transition-colors disabled:opacity-50 font-medium"
            >
                {saving ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> 保存中...</>
                ) : (
                    <><i className="fas fa-save mr-2"></i> 保存设置</>
                )}
            </button>
        </div>
    );
}
