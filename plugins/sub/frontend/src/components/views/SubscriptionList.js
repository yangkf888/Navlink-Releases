import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Icon } from '../../shared/components/Icon';
import { SubscriptionCard } from '../SubscriptionCard';
export const SubscriptionList = ({ subscriptions, onEdit, onDelete, onAdd, settings }) => {
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState('expiry');
    // 获取所有分类（使用设置中的分类）
    const categories = useMemo(() => {
        // 优先使用设置中的分类，如果没有则从订阅中提取
        if (settings?.categories && settings.categories.length > 0) {
            return ['all', ...settings.categories];
        }
        // fallback到从订阅中提取
        const cats = new Set();
        subscriptions.forEach(sub => {
            if (sub.category)
                cats.add(sub.category);
        });
        return ['all', ...Array.from(cats)];
    }, [subscriptions, settings]);
    // 过滤和排序
    const filteredSubscriptions = useMemo(() => {
        return subscriptions
            .filter(sub => {
            const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.notes?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || sub.category === filterCategory;
            return matchesSearch && matchesCategory;
        })
            .sort((a, b) => {
            if (sortBy === 'name')
                return a.name.localeCompare(b.name);
            if (sortBy === 'price')
                return b.price - a.price;
            if (sortBy === 'expiry')
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            return 0;
        });
    }, [subscriptions, searchTerm, filterCategory, sortBy]);
    return (_jsxs("div", { className: "space-y-6 animate-fade-in pt-2 px-8", children: [_jsxs("div", { className: "flex flex-col md:flex-row gap-4 justify-between items-start md:items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "\u6211\u7684\u8BA2\u9605" }), _jsxs("p", { className: "text-gray-500 mt-1", children: ["\u7BA1\u7406\u6240\u6709\u8BA2\u9605\u670D\u52A1 (", subscriptions.length, ")"] })] }), _jsxs("div", { className: "flex flex-wrap gap-3 w-full md:w-auto", children: [_jsxs("div", { className: "relative flex-1 md:w-64", children: [_jsx(Icon, { icon: "fa-solid fa-search", className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", placeholder: "\u641C\u7D22\u8BA2\u9605...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent outline-none" })] }), _jsxs("div", { className: "flex bg-gray-100 p-1 rounded-xl", children: [_jsxs("button", { onClick: () => setViewMode('grid'), className: `px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white shadow text-[var(--theme-primary)]' : 'text-gray-500 hover:text-gray-700'}`, children: [_jsx(Icon, { icon: "fa-solid fa-grid-2" }), _jsx("span", { className: "text-sm font-medium", children: "\u5361\u7247" })] }), _jsxs("button", { onClick: () => setViewMode('list'), className: `px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow text-[var(--theme-primary)]' : 'text-gray-500 hover:text-gray-700'}`, children: [_jsx(Icon, { icon: "fa-solid fa-list" }), _jsx("span", { className: "text-sm font-medium", children: "\u5217\u8868" })] })] }), _jsxs("button", { onClick: onAdd, className: "px-4 py-2 bg-[var(--theme-primary)] text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 font-medium shadow-lg shadow-red-100", children: [_jsx(Icon, { icon: "fa-solid fa-plus" }), "\u6DFB\u52A0\u8BA2\u9605"] })] })] }), _jsxs("div", { className: "flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm", children: [_jsx("div", { className: "flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar", children: categories.map(cat => (_jsx("button", { onClick: () => setFilterCategory(cat), className: `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterCategory === cat
                                ? 'bg-[var(--theme-primary)] text-white'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`, children: cat === 'all' ? '全部' : cat }, cat))) }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "text-sm text-gray-500", children: "\u6392\u5E8F:" }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "text-sm border-none bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer", children: [_jsx("option", { value: "expiry", children: "\u5230\u671F\u65F6\u95F4" }), _jsx("option", { value: "price", children: "\u4EF7\u683C" }), _jsx("option", { value: "name", children: "\u540D\u79F0" })] })] })] }), filteredSubscriptions.length > 0 ? (_jsxs("div", { className: `
                    ${viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4'
                    : 'flex flex-col gap-2'}
                `, children: [viewMode === 'list' && (_jsxs("div", { className: "px-3 py-2 flex items-center gap-3 text-xs font-medium text-gray-500 bg-gray-50/80 rounded-lg border border-gray-100", children: [_jsx("div", { className: "w-2.5 h-2.5 opacity-0" }), _jsxs("div", { className: "flex-1 grid grid-cols-8 gap-3 items-center", children: [_jsx("div", { className: "", children: "\u540D\u79F0" }), _jsx("div", { className: "text-center", children: "\u5206\u7C7B" }), _jsx("div", { className: "text-center", children: "\u7C7B\u578B" }), _jsx("div", { className: "text-center", children: "\u63D0\u9192" }), _jsx("div", { className: "text-center", children: "\u5907\u6CE8" }), _jsx("div", { className: "text-right", children: "\u4EF7\u683C" }), _jsx("div", { className: "text-center", children: "\u5F00\u59CB\u65F6\u95F4" }), _jsx("div", { className: "text-right", children: "\u5230\u671F\u65F6\u95F4" })] }), _jsx("div", { className: "w-16 opacity-0" })] })), filteredSubscriptions.map(sub => (_jsx(SubscriptionCard, { subscription: sub, onEdit: () => onEdit(sub), onDelete: () => onDelete(sub.id, sub.name), settings: settings, viewMode: viewMode }, sub.id)))] })) : (_jsxs("div", { className: "py-20 text-center", children: [_jsx("div", { className: "w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300", children: _jsx(Icon, { icon: "fa-solid fa-search", className: "text-3xl" }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900", children: "\u672A\u627E\u5230\u76F8\u5173\u8BA2\u9605" }), _jsx("p", { className: "text-gray-500 mt-1", children: "\u5C1D\u8BD5\u8C03\u6574\u641C\u7D22\u8BCD\u6216\u7B5B\u9009\u6761\u4EF6" })] }))] }));
};
