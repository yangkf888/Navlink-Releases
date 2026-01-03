import { useState, useEffect } from 'react';
import type { VpsSnippet } from '../types/index';
import { Icon } from './common/Icon';
import { apiUrl } from '../utils/api';

interface SnippetLibraryProps {
    variant?: 'default' | 'sidebar';
    onRun?: (command: string) => void;
}

export default function SnippetLibrary({ variant = 'default', onRun }: SnippetLibraryProps) {
    const [snippets, setSnippets] = useState<VpsSnippet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Partial<VpsSnippet>>({
        category: 'General',
        title: '',
        command: '',
        description: ''
    });

    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [showCategorySettings, setShowCategorySettings] = useState(false);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [editingCategory, setEditingCategory] = useState<{ id: string, name: string } | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingSnippet, setEditingSnippet] = useState<VpsSnippet | null>(null);
    const [isAddingCategory, setIsAddingCategory] = useState(false);

    // Sidebar specific state
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Fetch Data
    const fetchSnippets = async () => {
        try {
            setLoading(true);
            const [snippetsRes, categoriesRes] = await Promise.all([
                fetch(apiUrl('api/snippets'), {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                }),
                fetch(apiUrl('api/snippet-categories'), {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                })
            ]);

            if (snippetsRes.ok) {
                const data = await snippetsRes.json();
                setSnippets(data);
            }
            if (categoriesRes.ok) {
                const data = await categoriesRes.json();
                setCategories(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSnippets();
    }, []);

    const handleRun = (command: string) => {
        if (onRun) {
            onRun(command);
        } else {
            // 默认行为：复制到剪贴板
            navigator.clipboard.writeText(command);
            alert('命令已复制到剪贴板');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingSnippet ? apiUrl(`api/snippets/${editingSnippet.id}`) : apiUrl('api/snippets');
            const method = editingSnippet ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                fetchSnippets();
                setShowForm(false);
                setEditingSnippet(null);
                setFormData({ category: 'General', title: '', command: '', description: '' });
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save snippet');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this snippet?')) return;

        try {
            await fetch(apiUrl(`api/snippets/${id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            fetchSnippets();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEdit = (snippet: VpsSnippet, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSnippet(snippet);
        setFormData({
            category: snippet.category,
            title: snippet.title,
            command: snippet.command,
            description: snippet.description || ''
        });
        setShowForm(true);
    };

    // Category Management Handlers
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await fetch(apiUrl('api/snippet-categories'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ name: newCategoryName })
            });
            fetchSnippets();
            setNewCategoryName('');
            setIsAddingCategory(false);
        } catch (e) {
            console.error(e);
            alert('Failed to add category');
        }
    };

    const handleRenameCategory = async (category: { id: string, name: string }, newName: string) => {
        try {
            await fetch(apiUrl(`api/snippet-categories/${category.id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ name: newName })
            });

            const snippetsToUpdate = snippets.filter(s => s.category === category.name);
            await Promise.all(snippetsToUpdate.map(s =>
                fetch(apiUrl(`api/snippets/${s.id}`), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({ ...s, category: newName })
                })
            ));

            fetchSnippets();
            setEditingCategory(null);
        } catch (e) {
            console.error(e);
            alert('Failed to rename category');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('确定要删除此分类吗？')) return;
        try {
            await fetch(apiUrl(`api/snippet-categories/${id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            fetchSnippets();
        } catch (e) {
            console.error(e);
        }
    };

    const allCategoryNames = Array.from(new Set([
        ...categories.map(c => c.name),
        ...snippets.map(s => s.category)
    ])).sort();

    const displayedCategories = allCategoryNames.map(name => {
        const dbCat = categories.find(c => c.name === name);
        return dbCat || { id: `legacy-${name}`, name };
    });

    const displayedSnippets = activeCategory === 'All' ? snippets : snippets.filter(s => s.category === activeCategory);

    const toggleCategory = (categoryName: string) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(categoryName)) {
            newSet.delete(categoryName);
        } else {
            newSet.add(categoryName);
        }
        setExpandedCategories(newSet);
    };

    // Render Sidebar Variant
    if (variant === 'sidebar') {
        return (
            <div className="h-full flex flex-col bg-[var(--sidebar-bg)] w-full text-[var(--theme-text)]">
                {/* Header Actions */}
                <div className="px-3 py-2 border-b border-[var(--border-color)] flex justify-end gap-2 bg-gray-500/5">
                    <button
                        onClick={() => setShowForm(true)}
                        className="p-1.5 text-gray-400 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded transition-colors"
                        title="新增指令"
                    >
                        <Icon icon="fa-solid fa-plus" />
                    </button>
                    <button
                        onClick={() => setShowCategorySettings(true)}
                        className="p-1.5 text-gray-400 hover:text-[var(--theme-text)] hover:bg-gray-500/10 rounded transition-colors"
                        title="分类管理"
                    >
                        <Icon icon="fa-solid fa-cog" />
                    </button>
                </div>
                {/* Accordion List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="text-center text-gray-400 py-8">
                            <Icon icon="fa-solid fa-spinner" className="animate-spin text-xl mb-2" />
                        </div>
                    ) : displayedCategories.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-xs">
                            暂无分类
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {displayedCategories.map(cat => {
                                const catSnippets = snippets.filter(s => s.category === cat.name);
                                const isExpanded = expandedCategories.has(cat.name);

                                return (
                                    <div key={cat.id} className="bg-[var(--sidebar-bg)] border-b border-[var(--border-color)]">
                                        <button
                                            onClick={() => toggleCategory(cat.name)}
                                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-500/5 transition-colors text-left group"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Icon
                                                    icon={isExpanded ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-right"}
                                                    className="text-[10px] text-gray-400 w-3"
                                                />
                                                <span className="text-sm font-medium text-gray-400 group-hover:text-[var(--theme-text)] truncate">{cat.name}</span>
                                                <span className="text-[10px] text-gray-400 bg-gray-500/10 px-1.5 rounded-full">
                                                    {catSnippets.length}
                                                </span>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="bg-gray-500/5 px-2 pb-2 space-y-1">
                                                {catSnippets.length === 0 ? (
                                                    <div className="text-[10px] text-gray-400 pl-6 py-1">暂无指令</div>
                                                ) : (
                                                    catSnippets.map(snippet => (
                                                        <div
                                                            key={snippet.id}
                                                            className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded p-2 hover:border-[var(--theme-primary)] hover:shadow-sm transition-all cursor-pointer"
                                                            onClick={() => handleRun(snippet.command)}
                                                        >
                                                            <div className="flex justify-between items-start gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-medium text-xs text-gray-800 mb-0.5 truncate" title={snippet.title}>
                                                                        {snippet.title}
                                                                    </div>
                                                                    <div className="font-mono text-[10px] text-gray-500 truncate bg-gray-50 px-1 rounded" title={snippet.command}>
                                                                        {snippet.command}
                                                                    </div>
                                                                </div>
                                                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                                    <button
                                                                        onClick={(e) => handleEdit(snippet, e)}
                                                                        className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                                                                        title="编辑"
                                                                    >
                                                                        <Icon icon="fa-solid fa-pen" className="text-[10px]" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleDelete(snippet.id, e)}
                                                                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                                                                        title="删除"
                                                                    >
                                                                        <Icon icon="fa-solid fa-trash" className="text-[10px]" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modals (Shared between variants) */}
                {showCategorySettings && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800">分类管理</h3>
                                <button onClick={() => setShowCategorySettings(false)} className="text-gray-400 hover:text-gray-600">
                                    <Icon icon="fa-solid fa-times" />
                                </button>
                            </div>
                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                <div className="space-y-3">
                                    {isAddingCategory ? (
                                        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)]">
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={e => setNewCategoryName(e.target.value)}
                                                placeholder="输入分类名称"
                                                className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                                autoFocus
                                            />
                                            <button onClick={handleAddCategory} className="text-blue-600 hover:text-blue-700 px-2 font-medium text-sm">确定</button>
                                            <button onClick={() => setIsAddingCategory(false)} className="text-gray-400 hover:text-gray-600 px-2">
                                                <Icon icon="fa-solid fa-times" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setIsAddingCategory(true); setNewCategoryName(''); }}
                                            className="w-full py-2 border-2 border-dashed border-[var(--border-color)] rounded-lg text-gray-400 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)] transition-colors text-sm font-medium mb-4"
                                        >
                                            <Icon icon="fa-solid fa-plus" className="mr-2" /> 新增分类
                                        </button>
                                    )}

                                    {displayedCategories.map(category => (
                                        <div key={category.id} className="flex items-center justify-between p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)] group">
                                            {editingCategory?.id === category.id ? (
                                                <div className="flex-1 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newCategoryName}
                                                        onChange={e => setNewCategoryName(e.target.value)}
                                                        className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleRenameCategory(category, newCategoryName)}
                                                        className="text-green-600 hover:text-green-700 px-2"
                                                    >
                                                        <Icon icon="fa-solid fa-check" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingCategory(null)}
                                                        className="text-gray-400 hover:text-gray-600 px-2"
                                                    >
                                                        <Icon icon="fa-solid fa-times" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-medium text-[var(--theme-text)]">{category.name}</span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCategory(category);
                                                                setNewCategoryName(category.name);
                                                            }}
                                                            className="text-gray-400 hover:text-blue-600 p-1"
                                                            title="重命名"
                                                        >
                                                            <Icon icon="fa-solid fa-pen" />
                                                        </button>
                                                        {!category.id.startsWith('legacy-') && (
                                                            <button
                                                                onClick={() => handleDeleteCategory(category.id)}
                                                                className="text-gray-400 hover:text-red-600 p-1"
                                                                title="删除"
                                                            >
                                                                <Icon icon="fa-solid fa-trash" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {displayedCategories.length === 0 && !isAddingCategory && (
                                        <div className="text-center text-gray-400 text-sm py-4">
                                            暂无分类，添加指令时可创建新分类
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={() => setShowForm(false)}>
                        <div className="bg-[var(--card-bg)] rounded-xl shadow-xl w-full max-w-sm overflow-hidden text-[var(--theme-text)]" onClick={e => e.stopPropagation()}>
                            <div className="px-4 py-3 border-b border-[var(--border-color)] flex justify-between items-center bg-gray-500/5">
                                <h3 className="font-bold">{editingSnippet ? '编辑指令' : '新增指令'}</h3>
                                <button onClick={() => { setShowForm(false); setEditingSnippet(null); }} className="text-gray-400 hover:text-gray-600">
                                    <Icon icon="fa-solid fa-times" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-4 space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--theme-text)] mb-1">标题</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--theme-text)] mb-1">分类</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.category}
                                        onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                        list="category-suggestions"
                                    />
                                    <datalist id="category-suggestions">
                                        {categories.map(c => <option key={c.id} value={c.name} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--theme-text)] mb-1">命令</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={formData.command}
                                        onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, command: e.target.value }))}
                                        className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                    />
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                                    保存
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default Variant (Grid + Tabs)
    return (
        <div className="h-full flex flex-col bg-[var(--theme-bg)] w-full text-[var(--theme-text)]">
            {/* Header & Tabs */}
            <div className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold">脚本库</h2>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center transition-colors px-4 py-2 text-sm gap-2"
                            title="新增指令"
                        >
                            <Icon icon="fa-solid fa-plus" /> 新增指令
                        </button>
                        <button
                            onClick={() => setShowCategorySettings(true)}
                            className="bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 rounded-lg font-medium flex items-center justify-center transition-colors px-4 py-2 text-sm gap-2"
                            title="设置"
                        >
                            <Icon icon="fa-solid fa-cog" /> 设置
                        </button>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`
                            px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all
                            ${activeCategory === 'All'
                                ? 'bg-red-600 text-white shadow-md shadow-red-200'
                                : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                            }
                        `}
                    >
                        全部
                    </button>
                    {displayedCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.name)}
                            className={`
                                px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all
                                ${activeCategory === cat.name
                                    ? 'bg-red-600 text-white shadow-md shadow-red-200'
                                    : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                                }
                            `}
                        >
                            {cat.name}
                            {cat.name !== 'All' && (
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeCategory === cat.name ? 'bg-white/20 text-white' : 'bg-gray-500/10 text-gray-500'}`}>
                                    {snippets.filter(s => s.category === cat.name).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-[var(--theme-bg)] p-6">
                {loading ? (
                    <div className="text-center text-gray-400 py-8">
                        <Icon icon="fa-solid fa-spinner" className="animate-spin text-xl mb-2" />
                        <p className="text-xs">加载中...</p>
                    </div>
                ) : displayedSnippets.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <Icon icon="fa-solid fa-code" className="text-2xl mb-2 opacity-20" />
                        <p className="text-xs">暂无指令</p>
                    </div>
                ) : (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {displayedSnippets.map(snippet => (
                            <div
                                key={snippet.id}
                                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:shadow-md transition-all group relative flex flex-col p-4 h-[160px]"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                                            <Icon icon="fa-solid fa-terminal" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm line-clamp-1" title={snippet.title}>{snippet.title}</h3>
                                            <span className="text-[10px] text-gray-400 bg-gray-500/10 px-1.5 py-0.5 rounded">{snippet.category}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleEdit(snippet, e)}
                                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-500/10 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="编辑"
                                        >
                                            <Icon icon="fa-solid fa-pen" className="text-[10px]" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(snippet.id, e)}
                                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-500/10 text-gray-400 hover:text-red-600 transition-colors"
                                            title="删除"
                                        >
                                            <Icon icon="fa-solid fa-trash" className="text-[10px]" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 mb-3">
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-2 h-8">{snippet.description || '暂无描述'}</p>
                                    <div className="bg-gray-500/5 rounded-lg p-2 font-mono text-[10px] text-gray-400 overflow-hidden relative group/code h-[46px]">
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-500/10 pointer-events-none"></div>
                                        {snippet.command}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleRun(snippet.command)}
                                    className="w-full bg-gray-500/5 hover:bg-red-600 hover:text-white text-gray-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 py-2 mt-auto"
                                >
                                    <Icon icon="fa-solid fa-play" className="text-[10px]" /> 执行指令
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Category Settings Modal */}
            {showCategorySettings && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCategorySettings(false)}>
                    <div className="bg-[var(--card-bg)] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in text-[var(--theme-text)]" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-gray-500/5">
                            <h3 className="text-lg font-bold">分类管理</h3>
                            <button onClick={() => setShowCategorySettings(false)} className="text-gray-400 hover:text-gray-600">
                                <Icon icon="fa-solid fa-times" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {isAddingCategory ? (
                                    <div className="flex items-center gap-2 mb-4 p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)]">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            placeholder="输入分类名称"
                                            className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                            autoFocus
                                        />
                                        <button onClick={handleAddCategory} className="text-blue-600 hover:text-blue-700 px-2 font-medium text-sm">确定</button>
                                        <button onClick={() => setIsAddingCategory(false)} className="text-gray-400 hover:text-gray-600 px-2">
                                            <Icon icon="fa-solid fa-times" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setIsAddingCategory(true); setNewCategoryName(''); }}
                                        className="w-full py-2 border-2 border-dashed border-[var(--border-color)] rounded-lg text-gray-400 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)] transition-colors text-sm font-medium mb-4"
                                    >
                                        <Icon icon="fa-solid fa-plus" className="mr-2" /> 新增分类
                                    </button>
                                )}

                                {displayedCategories.map(category => (
                                    <div key={category.id} className="flex items-center justify-between p-3 bg-gray-500/5 rounded-lg border border-[var(--border-color)] group">
                                        {editingCategory?.id === category.id ? (
                                            <div className="flex-1 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={e => setNewCategoryName(e.target.value)}
                                                    className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none bg-gray-500/5 text-[var(--theme-text)]"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleRenameCategory(category, newCategoryName)}
                                                    className="text-green-600 hover:text-green-700 px-2"
                                                >
                                                    <Icon icon="fa-solid fa-check" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingCategory(null)}
                                                    className="text-gray-400 hover:text-gray-600 px-2"
                                                >
                                                    <Icon icon="fa-solid fa-times" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-sm font-medium text-[var(--theme-text)]">{category.name}</span>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCategory(category);
                                                            setNewCategoryName(category.name);
                                                        }}
                                                        className="text-gray-400 hover:text-blue-600 p-1"
                                                        title="重命名"
                                                    >
                                                        <Icon icon="fa-solid fa-pen" />
                                                    </button>
                                                    {!category.id.startsWith('legacy-') && (
                                                        <button
                                                            onClick={() => handleDeleteCategory(category.id)}
                                                            className="text-gray-400 hover:text-red-600 p-1"
                                                            title="删除"
                                                        >
                                                            <Icon icon="fa-solid fa-trash" />
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {displayedCategories.length === 0 && !isAddingCategory && (
                                    <div className="text-center text-gray-400 text-sm py-4">
                                        暂无分类，添加指令时可创建新分类
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Snippet Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
                    <div className="bg-[var(--card-bg)] rounded-xl shadow-xl w-full max-w-sm overflow-hidden text-[var(--theme-text)]" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-[var(--border-color)] flex justify-between items-center bg-gray-500/5">
                            <h3 className="font-bold">{editingSnippet ? '编辑指令' : '新增指令'}</h3>
                            <button onClick={() => { setShowForm(false); setEditingSnippet(null); }} className="text-gray-400 hover:text-gray-600">
                                <Icon icon="fa-solid fa-times" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">标题</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">分类</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    list="category-suggestions"
                                />
                                <datalist id="category-suggestions">
                                    {categories.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">命令</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.command}
                                    onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, command: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">描述（可选）</label>
                                <textarea
                                    rows={2}
                                    value={formData.description}
                                    onChange={e => setFormData((prev: Partial<VpsSnippet>) => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                                保存
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
