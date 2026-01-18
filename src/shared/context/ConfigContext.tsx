import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { SiteConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { api, ApiError } from '../services/api';
import { Toast } from '../components/common/Toast';

interface ConfigContextType {
    config: SiteConfig;
    isLoaded: boolean;
    isAuthenticated: boolean;
    setConfig: (config: SiteConfig | ((prev: SiteConfig) => SiteConfig)) => void; // Local update
    saveConfig: (config: SiteConfig) => Promise<void>; // Server sync
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// LocalStorage key for caching config
const CONFIG_STORAGE_KEY = 'navlink_app_config';

// Declare global window type
declare global {
    interface Window {
        __INITIAL_CONFIG__?: SiteConfig;
    }
}

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 多级降级策略：服务端注入 > LocalStorage > null
    const [config, setConfigState] = useState<SiteConfig>(() => {
        // 优先级 1: 服务端注入（首页访问）
        if (typeof window !== 'undefined' && window.__INITIAL_CONFIG__) {
            console.log('[ConfigContext] ✅ Using server-injected config');

            // 同步到 LocalStorage（为子页面准备）
            try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(window.__INITIAL_CONFIG__));
            } catch (e) {
                console.warn('[ConfigContext] ⚠️ Failed to cache config:', e);
            }

            return window.__INITIAL_CONFIG__;
        }

        // 优先级 2: LocalStorage（子页面直接访问）
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
                if (cached) {
                    const parsedConfig = JSON.parse(cached);
                    // 简单验证配置结构
                    if (parsedConfig.siteName && parsedConfig.theme) {
                        console.log('[ConfigContext] ✅ Using cached config from localStorage');
                        return parsedConfig;
                    } else {
                        console.warn('[ConfigContext] ⚠️ Invalid cached config, will load from API');
                        localStorage.removeItem(CONFIG_STORAGE_KEY);
                    }
                }
            } catch (e) {
                console.warn('[ConfigContext] ⚠️ Failed to read cache:', e);
                localStorage.removeItem(CONFIG_STORAGE_KEY);
            }
        }

        // 优先级 3: DEFAULT_CONFIG（需要从 API 加载）
        console.log('[ConfigContext] ℹ️ No cached config, will load from API');
        return DEFAULT_CONFIG;
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            // --- 1. Auth Check (Wait for verification) ---
            const token = localStorage.getItem('auth_token');
            if (token && token !== 'null' && token !== 'undefined') {
                try {
                    console.log('[ConfigContext] 正在验证身份...');
                    const response = await fetch('/api/verify', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        console.log('[ConfigContext] ✅ 验证通过');
                        setIsAuthenticated(true);
                    } else if (response.status === 401 || response.status === 403) {
                        console.warn('[ConfigContext] ⚠️ 身份验证失效');
                        localStorage.removeItem('auth_token');
                        setIsAuthenticated(false);
                    }
                } catch (err) {
                    console.error('[ConfigContext] ❌ 身份验证异常:', err);
                    setIsAuthenticated(false);
                }
            }

            // --- 2. Config Load Strategy ---
            const hasServerInject = typeof window !== 'undefined' && window.__INITIAL_CONFIG__;
            const hasCachedConfig = config !== DEFAULT_CONFIG;

            if (hasServerInject || hasCachedConfig) {
                // 有初始配置（服务端注入或 LocalStorage），直接标记为已加载
                console.log('[ConfigContext] ℹ️ Config ready from:', hasServerInject ? 'server-inject' : 'localStorage');
                setIsLoaded(true);

                // 如果是从 LocalStorage 加载的，后台异步验证是否最新
                if (!hasServerInject && hasCachedConfig) {
                    (async () => {
                        try {
                            const freshConfig = await api.getConfig();

                            // 空值检查
                            if (!freshConfig) {
                                console.warn('[ConfigContext] ⚠️ API returned null config');
                                return;
                            }

                            const cachedStr = JSON.stringify(config);
                            const freshStr = JSON.stringify(freshConfig);

                            if (cachedStr !== freshStr) {
                                console.log('[ConfigContext] ℹ️ Config updated, refreshing...');
                                setConfigState(freshConfig);
                                localStorage.setItem(CONFIG_STORAGE_KEY, freshStr);
                            } else {
                                console.log('[ConfigContext] ✅ Cached config is up-to-date');
                            }
                        } catch (e) {
                            console.warn('[ConfigContext] ⚠️ Background config refresh failed:', e);
                        }
                    })();
                }
            } else {
                // 无初始配置，需要从 API 加载
                console.log('[ConfigContext] ℹ️ Loading config from API...');
                try {
                    const serverData = await api.getConfig();
                    if (serverData) {
                        const mergedConfig = {
                            ...DEFAULT_CONFIG,
                            ...serverData,
                            theme: { ...DEFAULT_CONFIG.theme, ...(serverData.theme || {}) },
                            rightSidebar: {
                                ...DEFAULT_CONFIG.rightSidebar,
                                ...(serverData.rightSidebar || {}),
                                profile: { ...DEFAULT_CONFIG.rightSidebar.profile, ...(serverData.rightSidebar?.profile || {}) }
                            },
                            hero: { ...DEFAULT_CONFIG.hero, ...(serverData.hero || {}) },
                            footer: { ...DEFAULT_CONFIG.footer, ...(serverData.footer || {}) },
                        } as SiteConfig;

                        setConfigState(mergedConfig);

                        // 缓存到 LocalStorage
                        try {
                            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(mergedConfig));
                            console.log('[ConfigContext] ✅ Config loaded and cached');
                        } catch (e) {
                            console.warn('[ConfigContext] ⚠️ Failed to cache config:', e);
                        }
                    }
                } catch (err) {
                    console.error('[ConfigContext] ❌ Failed to load config:', err);
                    setToast({ message: '配置加载失败', type: 'error' });
                } finally {
                    setIsLoaded(true);
                }
            }
        };
        init();
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const { token, user } = await api.login(username, password);
            localStorage.setItem('auth_token', token);
            setIsAuthenticated(true);
            setToast({ message: `欢迎回来, ${user.username}!`, type: 'success' });
        } catch (err) {
            if (err instanceof ApiError) {
                throw new Error(err.message);
            }
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setToast({ message: '已退出登录', type: 'success' });
        // 延迟刷新页面，让Toast显示出来
        setTimeout(() => {
            window.location.href = '/';
        }, 500);
    };

    const saveConfig = async (newConfig: SiteConfig) => {
        try {
            console.log('[ConfigContext] 📤 开始保存配置到服务器...');
            await api.saveConfig(newConfig);
            console.log('[ConfigContext] ✅ 配置保存成功');

            // 🔑 同步更新 LocalStorage（下次刷新立即生效）
            try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
                console.log('[ConfigContext] ✅ Config saved and synced to localStorage');
            } catch (e) {
                console.warn('[ConfigContext] ⚠️ Failed to sync config to localStorage:', e);
            }

            // 兼容旧的 key（逐步迁移）
            try {
                localStorage.setItem('nav_site_config', JSON.stringify(newConfig));
            } catch (e) {
                // 静默失败
            }

            // Dispatch local event for other components in same window
            window.dispatchEvent(new CustomEvent('nav-config-updated', { detail: newConfig }));

            // 显示成功提示（已禁用，避免打扰用户）
            // setToast({ message: '✅ 配置已保存', type: 'success' });
        } catch (err) {
            console.error('[ConfigContext] ❌ 保存配置失败:', err);

            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                console.warn('[ConfigContext] ⚠️ 认证失败，自动退出登录');
                localStorage.removeItem('auth_token');
                setIsAuthenticated(false);
                setToast({ message: '❌ 登录已过期，请重新登录', type: 'error' });
            } else {
                const errorMsg = err instanceof ApiError ? err.message : '网络错误';
                setToast({ message: `❌ 保存失败: ${errorMsg}`, type: 'error' });
            }
            throw err;
        }
    };

    const setConfig = (newConfig: SiteConfig | ((prev: SiteConfig) => SiteConfig)) => {
        const finalConfig = typeof newConfig === 'function' ? newConfig(config) : newConfig;
        console.log('[ConfigContext] 配置已更新(本地),等待1秒后自动保存...');
        setConfigState(finalConfig);
        // Optimistic update to local storage
        localStorage.setItem('nav_site_config', JSON.stringify(finalConfig));
        // Dispatch local event for other components in same window
        window.dispatchEvent(new CustomEvent('nav-config-updated', { detail: finalConfig }));
    };

    // Sync with other tabs/windows via storage event
    // Note: We removed the local 'nav-config-updated' event listener because:
    // 1. React Context state changes automatically propagate to all consumers
    // 2. The event was causing self-listening loops when setConfig dispatched events
    //    that were then consumed by the same component, triggering additional updates
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            // Only sync from OTHER tabs (not the same window)
            if (e.key === 'nav_site_config' && e.newValue) {
                try {
                    console.log('[ConfigContext] Detected config change from another tab, syncing...');
                    const newConfig = JSON.parse(e.newValue);
                    setConfigState(newConfig);
                } catch (err) {
                    console.error('[ConfigContext] Failed to sync config from storage:', err);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Auto-save to server
    const suppressSave = React.useRef(true);

    useEffect(() => {
        if (!isLoaded) {
            console.log('[ConfigContext] 配置未加载完成,跳过自动保存');
            return;
        }

        // Prevent save on initial load
        if (suppressSave.current) {
            console.log('[ConfigContext] 首次加载,跳过自动保存');
            suppressSave.current = false;
            return;
        }

        if (!isAuthenticated) {
            console.warn('[ConfigContext] ⚠️ 未登录,无法自动保存配置!');
            setToast({ message: '⚠️ 请先登录才能保存配置', type: 'error' });
            return;
        }

        console.log('[ConfigContext] 配置变化检测到,1秒后自动保存...');
        const timer = setTimeout(() => {
            console.log('[ConfigContext] 触发自动保存...');
            saveConfig(config).catch((err) => {
                console.error('[ConfigContext] 自动保存失败:', err);
                // Error is already handled in saveConfig (toast)
            });
        }, 1000);

        return () => clearTimeout(timer);
    }, [config, isLoaded, isAuthenticated]);

    // Prevent rendering default config before loading is complete to avoid UI flickering
    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">正在加载配置...</p>
                </div>
            </div>
        );
    }

    return (
        <ConfigContext.Provider value={{ config, isLoaded, isAuthenticated, setConfig, saveConfig, login, logout }}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
