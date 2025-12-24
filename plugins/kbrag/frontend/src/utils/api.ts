/**
 * API 工具 - 统一管理 API 路径
 */
const API_BASE = '/api/plugins/kbrag/api';

/**
 * 将相对路径转换为绝对 API 路径
 */
export const apiUrl = (path: string): string => {
    const cleanPath = path.replace(/^\.?\//, '');
    return `${API_BASE}/${cleanPath}`;
};

/**
 * 带认证的 fetch 封装
 */
export const apiFetch = async <T>(
    path: string,
    options: RequestInit = {}
): Promise<T> => {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
};

/**
 * GET 请求
 */
export const apiGet = <T>(path: string): Promise<T> => {
    return apiFetch<T>(path, { method: 'GET' });
};

/**
 * POST 请求
 */
export const apiPost = <T>(path: string, data?: unknown): Promise<T> => {
    return apiFetch<T>(path, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });
};

/**
 * PUT 请求
 */
export const apiPut = <T>(path: string, data?: unknown): Promise<T> => {
    return apiFetch<T>(path, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    });
};

/**
 * DELETE 请求
 */
export const apiDelete = <T>(path: string): Promise<T> => {
    return apiFetch<T>(path, { method: 'DELETE' });
};
