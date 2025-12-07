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

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfigState] = useState<SiteConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            // Check token validity
            const token = localStorage.getItem('auth_token');
            if (token) {
                // Verify token by making a test request
                try {
                    console.log('[ConfigContext] 检测到token，验证有效性...');
                    const response = await fetch('/api/verify', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        console.log('[ConfigContext] Token有效，保持登录状态');
                        setIsAuthenticated(true);
                    } else if (response.status === 401 || response.status === 403) {
                        console.warn('[ConfigContext] Token已失效，自动退出登录');
                        localStorage.removeItem('auth_token');
                        setIsAuthenticated(false);
                        setToast({ message: '登录已过期，请重新登录', type: 'error' });
                    }
                } catch (err) {
                    console.error('[ConfigContext] Token验证失败:', err);
                    localStorage.removeItem('auth_token');
                    setIsAuthenticated(false);
                }
            } else {
                console.log('[ConfigContext] 无token，保持未登录状态');
                setIsAuthenticated(false);
            }

            // Load config
            try {
                const serverData = await api.getConfig();
                if (serverData) {
                    setConfigState((_prev) => ({
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
                    } as SiteConfig));
                } else {
                    const local = localStorage.getItem('nav_site_config');
                    if (local) setConfigState(JSON.parse(local));
                }
            } catch (err) {
                console.error('Failed to load config:', err);
                const local = localStorage.getItem('nav_site_config');
                if (local) setConfigState(JSON.parse(local));
                setToast({ message: 'Failed to load config from server', type: 'error' });
            } finally {
                setIsLoaded(true);
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
            console.log('[ConfigContext] 开始保存配置到服务器...');
            await api.saveConfig(newConfig);
            console.log('[ConfigContext] ✅ 配置保存成功');

            // Update local storage as backup
            localStorage.setItem('nav_site_config', JSON.stringify(newConfig));
            // Dispatch local event for other components in same window
            window.dispatchEvent(new CustomEvent('nav-config-updated', { detail: newConfig }));

            // 显示成功提示
            setToast({ message: '✅ 配置已保存', type: 'success' });
        } catch (err) {
            console.error('[ConfigContext] ❌ 保存配置失败:', err);

            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                console.warn('[ConfigContext] 认证失败，自动退出登录');
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

    // Sync with other tabs/windows and within the same window
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'nav_site_config' && e.newValue) {
                try {
                    console.log('[ConfigContext] Detected external config change, syncing...');
                    const newConfig = JSON.parse(e.newValue);
                    setConfigState(newConfig);
                } catch (err) {
                    console.error('[ConfigContext] Failed to sync config:', err);
                }
            }
        };

        const handleLocalEvent = (e: Event) => {
            const customEvent = e as CustomEvent<SiteConfig>;
            if (customEvent.detail) {
                console.log('[ConfigContext] Detected local config update event, syncing...');
                setConfigState(customEvent.detail);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('nav-config-updated', handleLocalEvent);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('nav-config-updated', handleLocalEvent);
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
