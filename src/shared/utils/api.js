const API_BASE = '/api';
export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.status = status;
    }
}
const getHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};
const handleResponse = async (response) => {
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            throw new ApiError('Unauthorized', 401);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.error || 'Request failed', response.status);
    }
    return response.json();
};
export const api = {
    login: async (password) => {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        return handleResponse(response);
    },
    getConfig: async () => {
        const response = await fetch(`${API_BASE}/config`);
        return handleResponse(response);
    },
    saveConfig: async (config) => {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config),
        });
        return handleResponse(response);
    },
};
