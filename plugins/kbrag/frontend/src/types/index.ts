/**
 * 知识条目类型
 */
export interface KnowledgeItem {
    id: string;
    title: string;
    content: string;
    url?: string;
    tags: string[];
    category?: string;
    note?: string;
    created_at: string;
    updated_at: string;
    embedded: number;
}

/**
 * 标签类型
 */
export interface Tag {
    id: string;
    name: string;
    color: string;
    created_at: string;
}

/**
 * 分类类型
 */
export interface Category {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    created_at: string;
}

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
}

/**
 * 分页信息
 */
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * API 响应
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * 列表响应
 */
export interface ListResponse<T> extends ApiResponse<T[]> {
    pagination?: Pagination;
}

/**
 * 统计信息
 */
export interface Stats {
    total: number;
    embedded: number;
    pending: number;
}

/**
 * 搜索结果
 */
export interface SearchResult extends KnowledgeItem {
    snippet?: string;
    score?: number;
}
