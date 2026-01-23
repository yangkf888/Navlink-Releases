import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiPost, apiGet } from '../utils/api';

// localStorage key
const AUTH_KEY = 'videox_admin_auth';
const AUTH_EXPIRY_HOURS = 24;

interface AuthState {
    isAuthenticated: boolean;      // 全站访问状态
    isAdminAuthenticated: boolean; // 管理员访问状态
    password: string | null;
    expiresAt: number | null;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isAdminAuthenticated: boolean;
    password: string | null;
    login: (password: string, type?: 'site' | 'admin') => Promise<boolean>;
    logout: (type?: 'all' | 'admin') => void;
    checkPasswordRequired: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>(() => {
        // 从 localStorage 恢复登录状态
        try {
            const saved = localStorage.getItem(AUTH_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as AuthState;
                // 检查是否过期
                if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
                    return parsed;
                }
            }
        } catch {
            // 忽略解析错误
        }
        return { isAuthenticated: false, isAdminAuthenticated: false, password: null, expiresAt: null };
    });

    // 保存到 localStorage
    useEffect(() => {
        // 只要任何一种认证状态为真，就持久化
        if (authState.isAuthenticated || authState.isAdminAuthenticated) {
            localStorage.setItem(AUTH_KEY, JSON.stringify(authState));
        } else {
            localStorage.removeItem(AUTH_KEY);
        }
    }, [authState]);

    const login = async (password: string, type: 'site' | 'admin' = 'admin'): Promise<boolean> => {
        try {
            const res = await apiPost<{ valid: boolean; message: string }>('/settings/verify-password', {
                password,
                type
            });
            const response = res as unknown as { success: boolean; valid: boolean; message: string };

            if (response.success && response.valid) {
                const expiresAt = Date.now() + AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
                setAuthState(prev => ({
                    ...prev,
                    // 仅更新对应的标志位，保留另一个
                    isAuthenticated: type === 'site' ? true : prev.isAuthenticated,
                    isAdminAuthenticated: type === 'admin' ? true : prev.isAdminAuthenticated,
                    // 仅在管理员登录时记录管理密码，用于某些需要密码透传的场景
                    password: type === 'admin' ? password : prev.password,
                    expiresAt
                }));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    const logout = (type: 'all' | 'admin' = 'all') => {
        if (type === 'admin') {
            setAuthState(prev => ({
                ...prev,
                isAdminAuthenticated: false,
                password: null
            }));
        } else {
            setAuthState({ isAuthenticated: false, isAdminAuthenticated: false, password: null, expiresAt: null });
        }
    };

    const checkPasswordRequired = async (): Promise<boolean> => {
        try {
            const res = await apiGet<{ admin_password_enabled: boolean }>('/settings');
            if (res.success && res.data) {
                return res.data.admin_password_enabled === true ||
                    String(res.data.admin_password_enabled) === 'true';
            }
            return false;
        } catch {
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated: authState.isAuthenticated,
            isAdminAuthenticated: authState.isAdminAuthenticated,
            password: authState.password,
            login,
            logout,
            checkPasswordRequired
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
