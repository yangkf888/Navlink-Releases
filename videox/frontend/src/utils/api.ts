import { ApiResponse } from '../types';

// API 基础路径 - 独立应用模式，直接访问后端
export const API_BASE = '/api';

/**
 * 构建完整的 API URL
 */
const buildUrl = (path: string): string => {
    const cleanPath = path.replace(/^\.?\//, '');
    return `${API_BASE}/${cleanPath}`;
};

/**
 * 获取管理员密码（用于访问隐藏资源）
 */
const getAdminPassword = (): string => {
    try {
        const authData = localStorage.getItem('videox_admin_auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
                return parsed.password || '';
            }
        }
    } catch {
        // 忽略解析错误
    }
    return '';
};

/**
 * 通用 API 请求函数
 */
export async function apiRequest<T>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const url = buildUrl(path);

    try {
        const adminPassword = getAdminPassword();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {}),
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[API] Request failed: ${url}`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * GET 请求
 */
export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    let url = path;
    if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                searchParams.set(key, String(value));
            }
        }
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }
    return apiRequest<T>(url);
}

/**
 * POST 请求
 */
export async function apiPost<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return apiRequest<T>(path, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
    });
}

/**
 * PUT 请求
 */
export async function apiPut<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return apiRequest<T>(path, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
    });
}

/**
 * DELETE 请求
 */
export async function apiDelete<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    let url = path;
    if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                searchParams.set(key, String(value));
            }
        }
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }
    return apiRequest<T>(url, {
        method: 'DELETE'
    });
}
