/**
 * 知识列表组件
 */
import React, { useState, useEffect } from 'react';
import { KnowledgeItem, ListResponse, Tag, Category } from '../types';
import { apiGet, apiPost, apiDelete } from '../utils/api';

interface KnowledgeListProps {
    onViewItem: (item: KnowledgeItem) => void;
    onDataChange: () => void;
    selectedCategory?: string;
}

export const KnowledgeList: React.FC<KnowledgeListProps> = ({ onViewItem, onDataChange, selectedCategory }) => {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [tags, setTags] = useState<Tag[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [embedding, setEmbedding] = useState(false);

    // 加载知识列表
    const loadItems = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: '20',
            });
            if (search) params.append('search', search);
            if (selectedTag) params.append('tag', selectedTag);
            if (selectedCategory) params.append('category', selectedCategory);

            const response = await apiGet<ListResponse<KnowledgeItem>>(`items?${params}`);
            if (response.success && response.data) {
                setItems(response.data);
                if (response.pagination) {
                    setTotalPages(response.pagination.totalPages);
                }
            }
        } catch (error) {
            console.error('[kbrag] Load items error:', error);
        } finally {
            setLoading(false);
        }
    };

    // 加载标签
    const loadTags = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Tag[] }>('tags');
            if (response.success) {
                setTags(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load tags error:', error);
        }
    };

    // 加载分类
    const loadCategories = async () => {
        try {
            const response = await apiGet<{ success: boolean; data: Category[] }>('categories');
            if (response.success) {
                setCategories(response.data);
            }
        } catch (error) {
            console.error('[kbrag] Load categories error:', error);
        }
    };

    useEffect(() => {
        loadItems();
    }, [page, search, selectedTag, selectedCategory]);

    useEffect(() => {
        loadTags();
        loadCategories();
    }, []);

    // 删除条目
    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这条知识吗？')) return;
        try {
            await apiDelete(`items/${id}`);
            loadItems();
            onDataChange();
        } catch (error) {
            alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    // 批量删除
    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 条知识吗？`)) return;
        try {
            await apiPost('items/batch-delete', { ids: selectedIds });
            setSelectedIds([]);
            loadItems();
            onDataChange();
        } catch (error) {
            alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    // 批量向量化
    const handleBatchEmbed = async () => {
        setEmbedding(true);
        try {
            const response = await apiPost<{ success: boolean; data: { processed: number; success: number; failed: number } }>('search/embed-pending', { batchSize: 10 });
            if (response.success) {
                alert(`向量化完成: 处理 ${response.data.processed} 条, 成功 ${response.data.success} 条, 失败 ${response.data.failed} 条`);
                loadItems();
                onDataChange();
            }
        } catch (error) {
            alert('向量化失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setEmbedding(false);
        }
    };

    // 格式化日期
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // 切换选中
    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(items.map(item => item.id));
        }
    };

    // 获取分类颜色
    const getCategoryColor = (categoryName: string) => {
        const cat = categories.find(c => c.name === categoryName);
        return cat?.color || '#6B7280';
    };

    return (
        <div className="space-y-4">
            {/* 头部 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {selectedCategory ? `分类: ${selectedCategory}` : '知识列表'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">共 {items.length} 条知识</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleBatchEmbed}
                        disabled={embedding}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {embedding ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                处理中...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-bolt"></i>
                                批量向量化
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        添加知识
                    </button>
                </div>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="搜索标题或内容..."
                        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
                <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">所有标签</option>
                    {tags.map(tag => (
                        <option key={tag.id} value={tag.name}>{tag.name}</option>
                    ))}
                </select>
            </div>

            {/* 批量操作 */}
            {selectedIds.length > 0 && (
                <div className="bg-blue-50 px-4 py-2 rounded-lg flex items-center justify-between">
                    <span className="text-blue-700">已选择 {selectedIds.length} 条</span>
                    <button
                        onClick={handleBatchDelete}
                        className="text-red-600 hover:text-red-700"
                    >
                        <i className="fas fa-trash-alt mr-1"></i>
                        批量删除
                    </button>
                </div>
            )}

            {/* 列表 */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                    <i className="fas fa-book-open text-gray-300 text-5xl mb-4"></i>
                    <p className="text-gray-500">暂无知识条目</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        添加第一条知识
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === items.length && items.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden lg:table-cell">分类</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden md:table-cell">标签</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden md:table-cell">状态</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden md:table-cell">日期</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => onViewItem(item)}
                                            className="text-left hover:text-blue-600"
                                        >
                                            <p className="font-medium text-gray-900 line-clamp-1">{item.title}</p>
                                            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{item.content.substring(0, 100)}</p>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {item.category ? (
                                            <span
                                                className="px-2 py-0.5 text-xs rounded-full text-white"
                                                style={{ backgroundColor: getCategoryColor(item.category) }}
                                            >
                                                {item.category}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-sm">未分类</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <div className="flex flex-wrap gap-1">
                                            {item.tags.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                            {item.tags.length > 2 && (
                                                <span className="text-xs text-gray-400">+{item.tags.length - 2}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        {item.embedded ? (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                <i className="fas fa-check mr-1"></i>已向量化
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                                <i className="fas fa-clock mr-1"></i>待处理
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                                        {formatDate(item.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => onViewItem(item)}
                                            className="p-2 text-gray-400 hover:text-blue-600"
                                            title="查看"
                                        >
                                            <i className="fas fa-eye"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-gray-400 hover:text-red-600"
                                            title="删除"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                    >
                        上一页
                    </button>
                    <span className="px-3 py-1 text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* 添加弹窗 */}
            {showAddModal && (
                <AddKnowledgeModal
                    categories={categories}
                    onClose={() => setShowAddModal(false)}
                    onSave={() => {
                        setShowAddModal(false);
                        loadItems();
                        onDataChange();
                    }}
                />
            )}
        </div>
    );
};

// 添加知识弹窗
interface AddKnowledgeModalProps {
    categories: Category[];
    onClose: () => void;
    onSave: () => void;
}

const AddKnowledgeModal: React.FC<AddKnowledgeModalProps> = ({ categories, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [url, setUrl] = useState('');
    const [tags, setTags] = useState('');
    const [category, setCategory] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            alert('请填写标题和内容');
            return;
        }
        setSaving(true);
        try {
            await apiPost('items', {
                title: title.trim(),
                content: content.trim(),
                url: url.trim() || undefined,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                category: category || undefined,
            });
            onSave();
        } catch (error) {
            alert('保存失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">添加知识</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            标题 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="输入标题"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            内容 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={8}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="输入知识内容"
                        />
                    </div>
                    {/* 分类选择 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">未分类</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">来源 URL</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="https://example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="用逗号分隔多个标签"
                        />
                    </div>
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    );
};
