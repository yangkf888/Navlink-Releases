import { useState, useEffect } from 'react';
import { SourceManager } from '../components/SourceManager';
import { SettingsManager } from '../components/SettingsManager';
import { HomeManager } from '../components/HomeManager';
import { TvSourceManager } from '../components/TvSourceManager';
import { LiveSourceManager } from '../components/LiveSourceManager';
import { NetdiskSourceManager } from '../components/NetdiskSourceManager';
import { useAuth } from '../contexts/AuthContext';
import { VideoSource } from '../types';
import { apiGet } from '../utils/api';

interface AdminProps {
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
    onSourcesChange?: () => void;
}

type TabType = 'home' | 'sources' | 'tv_sources' | 'live_sources' | 'netdisk_sources' | 'settings';

export function Admin({ onNavigate: _onNavigate, onSourcesChange }: AdminProps) {
    const [activeTab, setActiveTab] = useState<TabType>('home');
    const [sources, setSources] = useState<VideoSource[]>([]);

    // 认证上下文
    const { isAuthenticated, login, checkPasswordRequired } = useAuth();

    // UI 状态
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        initCheck();
        loadSources();
    }, [isAuthenticated]);

    const initCheck = async () => {
        setLoading(true);
        if (isAuthenticated) {
            setPasswordRequired(false);
        } else {
            const required = await checkPasswordRequired();
            setPasswordRequired(required);
        }
        setLoading(false);
    };

    const loadSources = async () => {
        try {
            const res = await apiGet<VideoSource[]>('/sources');
            if (res.success && res.data) {
                setSources(res.data);
            }
        } catch (error) {
            console.error('Failed to load sources:', error);
        }
    };

    const handleVerifyPassword = async () => {
        if (!password.trim()) {
            setError('请输入密码');
            return;
        }

        setVerifying(true);
        setError('');

        const success = await login(password);
        if (success) {
            // 登录成功，AuthContext 会更新 isAuthenticated
        } else {
            setError('密码错误，请重试');
        }

        setVerifying(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleVerifyPassword();
        }
    };

    // 加载中
    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-10 bg-gray-800 rounded w-48 mb-6"></div>
                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-800 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    // 需要密码但未验证
    if (passwordRequired && !isAuthenticated) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
                <div className="bg-gray-800/50 rounded-xl p-8 w-full max-w-sm text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <i className="fas fa-lock text-red-400 text-2xl"></i>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">访问受限</h2>
                    <p className="text-gray-400 text-sm mb-6">请输入管理密码以访问后台</p>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入密码"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 
                                     focus:border-red-500 focus:outline-none text-center"
                            autoFocus
                        />

                        {error && (
                            <p className="text-red-400 text-sm">
                                <i className="fas fa-exclamation-circle mr-1"></i>
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleVerifyPassword}
                            disabled={verifying}
                            className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 
                                     transition-colors disabled:opacity-50 font-medium"
                        >
                            {verifying ? (
                                <><i className="fas fa-spinner fa-spin mr-2"></i> 验证中...</>
                            ) : (
                                <><i className="fas fa-unlock mr-2"></i> 解锁</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">管理设置</h1>

            {/* 标签页 */}
            <div className="flex gap-2 border-b border-gray-700 pb-2">
                <button
                    onClick={() => setActiveTab('home')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'home'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'home' ? { color: '#fff' } : undefined}
                >
                    首页管理
                </button>
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'sources'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'sources' ? { color: '#fff' } : undefined}
                >
                    视频源管理
                </button>
                <button
                    onClick={() => setActiveTab('tv_sources')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'tv_sources'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'tv_sources' ? { color: '#fff' } : undefined}
                >
                    电视源管理
                </button>
                <button
                    onClick={() => setActiveTab('live_sources')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'live_sources'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'live_sources' ? { color: '#fff' } : undefined}
                >
                    直播源管理
                </button>
                <button
                    onClick={() => setActiveTab('netdisk_sources')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'netdisk_sources'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'netdisk_sources' ? { color: '#fff' } : undefined}
                >
                    媒体库管理
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors
                        ${activeTab === 'settings'
                            ? 'bg-blue-600'
                            : 'text-gray-400 hover:text-white bg-gray-800/10 dark:bg-gray-800/30'
                        }`}
                    style={activeTab === 'settings' ? { color: '#fff' } : undefined}
                >
                    系统设置
                </button>
            </div>

            {/* 首页管理 */}
            {activeTab === 'home' && (
                <HomeManager sources={sources} onRefresh={onSourcesChange} onSourcesChange={onSourcesChange} />
            )}

            {/* 视频源管理 - 使用独立组件 */}
            {activeTab === 'sources' && (
                <SourceManager onSourcesChange={() => { onSourcesChange?.(); loadSources(); }} />
            )}

            {/* 电视源管理 */}
            {activeTab === 'tv_sources' && (
                <TvSourceManager onSourcesChange={() => { onSourcesChange?.(); }} />
            )}

            {/* 直播源管理 */}
            {activeTab === 'live_sources' && (
                <LiveSourceManager onSourcesChange={() => { onSourcesChange?.(); }} />
            )}

            {/* 网盘源管理 */}
            {activeTab === 'netdisk_sources' && (
                <NetdiskSourceManager onSourceChange={() => { onSourcesChange?.(); }} />
            )}

            {/* 系统设置 - 使用独立组件 */}
            {activeTab === 'settings' && (
                <SettingsManager onSettingsChange={onSourcesChange} />
            )}
        </div>
    );
}
