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

            const injectedConfig = window.__INITIAL_CONFIG__;

            // 🔑 关键修复：服务端注入的配置必须与 DEFAULT_CONFIG 深度合并
            const mergedConfig = {
                ...DEFAULT_CONFIG,
                ...injectedConfig,
                categories: Array.isArray(injectedConfig.categories) ? injectedConfig.categories : DEFAULT_CONFIG.categories,
                promo: Array.isArray(injectedConfig.promo) ? injectedConfig.promo : DEFAULT_CONFIG.promo,
                topNav: Array.isArray(injectedConfig.topNav) ? injectedConfig.topNav : DEFAULT_CONFIG.topNav,
                searchEngines: Array.isArray(injectedConfig.searchEngines) ? injectedConfig.searchEngines : DEFAULT_CONFIG.searchEngines,
                theme: { ...DEFAULT_CONFIG.theme, ...(injectedConfig.theme || {}) },
                hero: { ...DEFAULT_CONFIG.hero, ...(injectedConfig.hero || {}) },
                footer: { ...DEFAULT_CONFIG.footer, ...(injectedConfig.footer || {}) },
                rightSidebar: {
                    ...DEFAULT_CONFIG.rightSidebar,
                    ...(injectedConfig.rightSidebar || {}),
                    profile: { ...DEFAULT_CONFIG.rightSidebar?.profile, ...(injectedConfig.rightSidebar?.profile || {}) }
                },
            } as SiteConfig;

            // 同步到 LocalStorage（为子页面准备）
            try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(mergedConfig));
            } catch (e) {
                console.warn('[ConfigContext] ⚠️ Failed to cache config:', e);
            }

            return mergedConfig;
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
                        // 🔑 同样需要合并，防止缓存的是旧的、不完整的结构
                        return {
                            ...DEFAULT_CONFIG,
                            ...parsedConfig,
                            categories: Array.isArray(parsedConfig.categories) ? parsedConfig.categories : DEFAULT_CONFIG.categories,
                            promo: Array.isArray(parsedConfig.promo) ? parsedConfig.promo : DEFAULT_CONFIG.promo,
                            topNav: Array.isArray(parsedConfig.topNav) ? parsedConfig.topNav : DEFAULT_CONFIG.topNav,
                            searchEngines: Array.isArray(parsedConfig.searchEngines) ? parsedConfig.searchEngines : DEFAULT_CONFIG.searchEngines,
                            theme: { ...DEFAULT_CONFIG.theme, ...(parsedConfig.theme || {}) },
                            hero: { ...DEFAULT_CONFIG.hero, ...(parsedConfig.hero || {}) },
                            footer: { ...DEFAULT_CONFIG.footer, ...(parsedConfig.footer || {}) },
                            rightSidebar: {
                                ...DEFAULT_CONFIG.rightSidebar,
                                ...(parsedConfig.rightSidebar || {}),
                                profile: { ...DEFAULT_CONFIG.rightSidebar?.profile, ...(parsedConfig.rightSidebar?.profile || {}) }
                            },
                        } as SiteConfig;
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

                // 后台异步验证是否最新 (放宽限制，即使有 serverInject 也验证)
                if (hasCachedConfig) {
                    (async () => {
                        try {
                            const freshConfig = await api.getConfig();
                            if (!freshConfig) return;

                            if (JSON.stringify(config) !== JSON.stringify(freshConfig)) {
                                console.log('[ConfigContext] ℹ️ Config updated in background, refreshing...');
                                setConfigState(freshConfig);
                                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(freshConfig));
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
                            categories: Array.isArray(serverData.categories) ? serverData.categories : DEFAULT_CONFIG.categories,
                            promo: Array.isArray(serverData.promo) ? serverData.promo : DEFAULT_CONFIG.promo,
                            topNav: Array.isArray(serverData.topNav) ? serverData.topNav : DEFAULT_CONFIG.topNav,
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
                        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(mergedConfig));
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
            if (err instanceof ApiError) throw new Error(err.message);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setToast({ message: '已退出登录', type: 'success' });
        setTimeout(() => { window.location.href = '/'; }, 500);
    };

    const saveConfig = async (newConfig: SiteConfig) => {
        try {
            await api.saveConfig(newConfig);
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
            window.dispatchEvent(new CustomEvent('nav-config-updated', { detail: newConfig }));
        } catch (err) {
            console.error('[ConfigContext] ❌ 保存配置失败:', err);
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                localStorage.removeItem('auth_token');
                setIsAuthenticated(false);
                setToast({ message: '❌ 登录已过期，请重新登录', type: 'error' });
            } else {
                setToast({ message: '❌ 保存失败', type: 'error' });
            }
            throw err;
        }
    };

    const setConfig = (newConfig: SiteConfig | ((prev: SiteConfig) => SiteConfig)) => {
        const finalConfig = typeof newConfig === 'function' ? newConfig(config) : newConfig;
        setConfigState(finalConfig);
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(finalConfig));
        window.dispatchEvent(new CustomEvent('nav-config-updated', { detail: finalConfig }));
    };

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CONFIG_STORAGE_KEY && e.newValue) {
                try {
                    const newConfig = JSON.parse(e.newValue);
                    setConfigState(newConfig);
                } catch (err) {
                    console.error('[ConfigContext] Failed to sync config from storage:', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const suppressSave = React.useRef(true);

    useEffect(() => {
        if (!isLoaded) return;
        if (suppressSave.current) {
            suppressSave.current = false;
            return;
        }
        if (!isAuthenticated) return;

        const timer = setTimeout(() => {
            saveConfig(config).catch(() => { });
        }, 1000);

        return () => clearTimeout(timer);
    }, [config, isLoaded, isAuthenticated]);

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
    if (!context) throw new Error('useConfig must be used within a ConfigProvider');
    return context;
};
