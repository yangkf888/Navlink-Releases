import type { SiteConfig } from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

const getHeaders = () => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        if (response.status === 401) {
            // 未授权,清除token并重载页面
            console.error('[API] Unauthorized (401), clearing token and reloading...');
            localStorage.removeItem('auth_token');
            
            // 如果在后台管理页面,跳转到首页
            if (window.location.pathname.startsWith('/admin')) {
                window.location.href = '/';
            } else {
                window.location.reload();
            }
            
            throw new ApiError('Unauthorized', 401);
        }
        
        if (response.status === 403) {
            // 权限不足
            console.error('[API] Forbidden (403), insufficient permissions');
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(errorData.error || '权限不足', 403);
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.error || 'Request failed', response.status);
    }
    return response.json();
};

export const api = {
    login: async (username: string, password: string): Promise<{ token: string; user: any }> => {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return handleResponse(response);
    },

    getConfig: async (): Promise<SiteConfig | null> => {
        const response = await fetch(`${API_BASE}/config`);
        return handleResponse(response);
    },

    saveConfig: async (config: SiteConfig): Promise<{ success: true }> => {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config),
        });
        return handleResponse(response);
    },
};
