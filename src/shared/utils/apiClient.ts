/**
 * API错误类
 */
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * 统一的API调用函数
 * 自动处理认证、错误提示等
 */
export async function apiCall(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            // 未认证 - 跳转登录
            window.location.href = '/admin/login';
            throw new ApiError(401, 'Unauthorized');
        } else if (response.status === 402) {
            // 需要授权 License
            // 避免在激活页面无限循环
            if (!window.location.pathname.includes('/license/activate')) {
                window.location.href = '/admin/license/activate';
            }
            throw new ApiError(402, 'License Required');
        } else if (response.status === 403) {
            // 权限不足 - 显示提示，不跳转
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.error || '您没有权限执行此操作';

            // 显示友好的权限不足提示
            alert(`❌ 权限不足\n\n${message}\n\n请联系管理员申请相应权限。`);

            throw new ApiError(403, message);
        } else if (response.status >= 500) {
            // 服务器错误
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.error || '服务器错误，请稍后重试';
            alert(`❌ 服务器错误\n\n${message}`);
            throw new ApiError(response.status, message);
        } else {
            // 其他错误
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(response.status, errorData.error || 'Request failed');
        }
    }

    return response;
}

/**
 * GET请求
 */
export async function apiGet<T = any>(url: string): Promise<T> {
    const response = await apiCall(url, { method: 'GET' });
    return response.json();
}

/**
 * POST请求
 */
export async function apiPost<T = any>(url: string, data?: any): Promise<T> {
    const response = await apiCall(url, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
}

/**
 * PUT请求
 */
export async function apiPut<T = any>(url: string, data?: any): Promise<T> {
    const response = await apiCall(url, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
}

/**
 * DELETE请求
 */
export async function apiDelete<T = any>(url: string): Promise<T> {
    const response = await apiCall(url, { method: 'DELETE' });
    return response.json();
}
