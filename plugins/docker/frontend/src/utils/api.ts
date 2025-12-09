/**
 * Docker插件 API工具
 * 将相对路径转换为绝对API路径，确保无论iframe从哪加载都能正确访问API
 */

const PLUGIN_ID = 'docker';
const API_BASE = `/api/plugins/${PLUGIN_ID}`;

/**
 * 将相对或绝对路径转换为完整的API路径
 * @param path API路径，如 'api/docker' 或 './api/docker' 或 '/api/docker'
 * @returns 完整的API路径，如 '/api/plugins/docker/api/docker'
 * 
 * @example
 * apiUrl('api/docker') → '/api/plugins/docker/api/docker'
 * apiUrl('./api/docker') → '/api/plugins/docker/api/docker'
 * apiUrl('/api/docker') → '/api/plugins/docker/api/docker'
 */
export const apiUrl = (path: string): string => {
    // 移除路径开头的 ./ 或 /
    const cleanPath = path.replace(/^\.?\//, '');
    return `${API_BASE}/${cleanPath}`;
};

/**
 * 带认证的fetch封装（可选）
 * @param path API路径
 * @param options fetch选项
 * @returns fetch Promise
 */
export const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('auth_token');

    return fetch(apiUrl(path), {
        ...options,
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            ...options.headers,
        }
    });
};
