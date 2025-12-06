export interface VpsGroup {
    id: string;
    name: string;
    description?: string;
    sort_order?: number;
    created_at?: string;
}

export interface VpsServer {
    id: string;
    group_id?: string;
    name: string;
    description?: string;
    host: string;
    port: number;
    username: string;
    password?: string; // Only for setting, not returned
    private_key?: string; // Only for setting, not returned
    auth_type: 'password' | 'key';
    status: 'online' | 'offline' | 'error';
    latency?: number;
    last_check_time?: string;
    os_info?: string;
    cpu_info?: string;
    mem_info?: string;
    disk_info?: string;
    created_at?: string;
}

export interface SnippetCategory {
    id: string;
    name: string;
    sort_order: number;
    created_at?: string;
}

export interface Snippet {
    id: string;
    category_id?: string;
    category?: string; // Legacy
    title: string;
    command: string;
    description?: string;
    created_at?: string;
}
