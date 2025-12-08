import axios from 'axios';
import { VpsServer, VpsGroup, Snippet, SnippetCategory } from './types';

// Configure axios with base URL
// Direct access to plugin mount point (bypassing self-proxy loop)
const api = axios.create({
    baseURL: '/api/plugins/vps/api',
});

// --- Groups ---
export const getGroups = async () => {
    const response = await api.get<VpsGroup[]>('/groups');
    return response.data;
};

export const createGroup = async (group: Partial<VpsGroup>) => {
    const response = await api.post<VpsGroup>('/groups', group);
    return response.data;
};

export const updateGroup = async (id: string, group: Partial<VpsGroup>) => {
    const response = await api.put<VpsGroup>(`/groups/${id}`, group);
    return response.data;
};

export const deleteGroup = async (id: string) => {
    await api.delete(`/groups/${id}`);
};

// --- Servers ---
export const getServers = async () => {
    const response = await api.get<VpsServer[]>('/servers');
    return response.data;
};

export const getServer = async (id: string) => {
    const response = await api.get<VpsServer>(`/servers/${id}`);
    return response.data;
};

export const createServer = async (server: Partial<VpsServer>) => {
    const response = await api.post<VpsServer>('/servers', server);
    return response.data;
};

export const updateServer = async (id: string, server: Partial<VpsServer>) => {
    const response = await api.put<VpsServer>(`/servers/${id}`, server);
    return response.data;
};

export const deleteServer = async (id: string) => {
    await api.delete(`/servers/${id}`);
};

export const checkServerStatus = async (ids: string[]) => {
    const response = await api.post<{ id: string, status: string, latency: number }[]>('/servers/check', { ids });
    return response.data;
};

// --- Snippets ---
export const getSnippets = async () => {
    const response = await api.get<Snippet[]>('/snippets');
    return response.data;
};

export const createSnippet = async (snippet: Partial<Snippet>) => {
    const response = await api.post<Snippet>('/snippets', snippet);
    return response.data;
};

export const updateSnippet = async (id: string, snippet: Partial<Snippet>) => {
    const response = await api.put<Snippet>(`/snippets/${id}`, snippet);
    return response.data;
};

export const deleteSnippet = async (id: string) => {
    await api.delete(`/snippets/${id}`);
};

// --- Snippet Categories ---
export const getSnippetCategories = async () => {
    const response = await api.get<SnippetCategory[]>('/snippet-categories');
    return response.data;
};

export const createSnippetCategory = async (category: Partial<SnippetCategory>) => {
    const response = await api.post<SnippetCategory>('/snippet-categories', category);
    return response.data;
};

export const updateSnippetCategory = async (id: string, category: Partial<SnippetCategory>) => {
    const response = await api.put<SnippetCategory>(`/snippet-categories/${id}`, category);
    return response.data;
};

export const deleteSnippetCategory = async (id: string) => {
    await api.delete(`/snippet-categories/${id}`);
};
