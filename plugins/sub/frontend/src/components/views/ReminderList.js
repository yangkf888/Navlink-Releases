import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Icon } from '../../shared/components/Icon';
import { ReminderCard } from '../ReminderCard';
export const ReminderList = ({ reminders, onEdit, onDelete, onAdd }) => {
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('date');
    // 过滤和排序
    const filteredReminders = useMemo(() => {
        const now = new Date();
        return reminders
            .filter(reminder => {
            // 搜索过滤
            const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reminder.description?.toLowerCase().includes(searchTerm.toLowerCase());
            // 状态过滤
            let matchesStatus = true;
            if (filterStatus === 'active') {
                matchesStatus = reminder.isActive && !reminder.notified;
            }
            else if (filterStatus === 'notified') {
                matchesStatus = reminder.notified;
            }
            else if (filterStatus === 'past') {
                const reminderDateTime = new Date(`${reminder.reminderDate}T${reminder.reminderTime}`);
                matchesStatus = reminderDateTime < now && !reminder.notified;
            }
            return matchesSearch && matchesStatus;
        })
            .sort((a, b) => {
            if (sortBy === 'title') {
                return a.title.localeCompare(b.title);
            }
            // 按日期时间排序
            const dateA = new Date(`${a.reminderDate}T${a.reminderTime}`);
            const dateB = new Date(`${b.reminderDate}T${b.reminderTime}`);
            return dateA.getTime() - dateB.getTime();
        });
    }, [reminders, searchTerm, filterStatus, sortBy]);
    // 统计数据
    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: reminders.length,
            active: reminders.filter(r => r.isActive && !r.notified).length,
            notified: reminders.filter(r => r.notified).length,
            past: reminders.filter(r => {
                const reminderDateTime = new Date(`${r.reminderDate}T${r.reminderTime}`);
                return reminderDateTime < now && !r.notified;
            }).length,
        };
    }, [reminders]);
    return (_jsxs("div", { className: "space-y-6 animate-fade-in pt-2 px-8", children: [_jsxs("div", { className: "flex flex-col md:flex-row gap-4 justify-between items-start md:items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "\u6211\u7684\u63D0\u9192" }), _jsxs("p", { className: "text-gray-500 mt-1", children: ["\u7BA1\u7406\u6240\u6709\u81EA\u5B9A\u4E49\u63D0\u9192 (", reminders.length, ")"] })] }), _jsxs("div", { className: "flex flex-wrap gap-3 w-full md:w-auto", children: [_jsxs("div", { className: "relative flex-1 md:w-64", children: [_jsx(Icon, { icon: "fa-solid fa-search", className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", placeholder: "\u641C\u7D22\u63D0\u9192...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" })] }), _jsxs("div", { className: "flex bg-gray-100 p-1 rounded-xl", children: [_jsxs("button", { onClick: () => setViewMode('grid'), className: `px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`, children: [_jsx(Icon, { icon: "fa-solid fa-grid-2" }), _jsx("span", { className: "text-sm font-medium", children: "\u5361\u7247" })] }), _jsxs("button", { onClick: () => setViewMode('list'), className: `px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`, children: [_jsx(Icon, { icon: "fa-solid fa-list" }), _jsx("span", { className: "text-sm font-medium", children: "\u5217\u8868" })] })] }), _jsxs("button", { onClick: onAdd, className: "px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-purple-100", children: [_jsx(Icon, { icon: "fa-solid fa-plus" }), "\u6DFB\u52A0\u63D0\u9192"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200", children: [_jsx("div", { className: "text-2xl font-bold text-blue-700", children: stats.total }), _jsx("div", { className: "text-sm text-blue-600", children: "\u5168\u90E8\u63D0\u9192" })] }), _jsxs("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200", children: [_jsx("div", { className: "text-2xl font-bold text-purple-700", children: stats.active }), _jsx("div", { className: "text-sm text-purple-600", children: "\u5F85\u63D0\u9192" })] }), _jsxs("div", { className: "bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200", children: [_jsx("div", { className: "text-2xl font-bold text-orange-700", children: stats.past }), _jsx("div", { className: "text-sm text-orange-600", children: "\u5DF2\u8FC7\u671F" })] }), _jsxs("div", { className: "bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200", children: [_jsx("div", { className: "text-2xl font-bold text-gray-700", children: stats.notified }), _jsx("div", { className: "text-sm text-gray-600", children: "\u5DF2\u901A\u77E5" })] })] }), _jsxs("div", { className: "flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm", children: [_jsxs("div", { className: "flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar", children: [_jsx("button", { onClick: () => setFilterStatus('all'), className: `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`, children: "\u5168\u90E8" }), _jsx("button", { onClick: () => setFilterStatus('active'), className: `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'active' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`, children: "\u5F85\u63D0\u9192" }), _jsx("button", { onClick: () => setFilterStatus('past'), className: `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'past' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`, children: "\u5DF2\u8FC7\u671F" }), _jsx("button", { onClick: () => setFilterStatus('notified'), className: `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'notified' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`, children: "\u5DF2\u901A\u77E5" })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "text-sm text-gray-500", children: "\u6392\u5E8F:" }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "text-sm border-none bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer", children: [_jsx("option", { value: "date", children: "\u63D0\u9192\u65F6\u95F4" }), _jsx("option", { value: "title", children: "\u6807\u9898" })] })] })] }), filteredReminders.length > 0 ? (_jsx("div", { className: `
                    ${viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4'
                    : 'flex flex-col gap-2'}
                `, children: filteredReminders.map(reminder => (_jsx(ReminderCard, { reminder: reminder, onEdit: () => onEdit(reminder), onDelete: () => onDelete(reminder.id, reminder.title), viewMode: viewMode }, reminder.id))) })) : (_jsxs("div", { className: "py-20 text-center", children: [_jsx("div", { className: "w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-300", children: _jsx(Icon, { icon: "fa-solid fa-bell-slash", className: "text-3xl" }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900", children: "\u672A\u627E\u5230\u76F8\u5173\u63D0\u9192" }), _jsx("p", { className: "text-gray-500 mt-1", children: "\u5C1D\u8BD5\u8C03\u6574\u641C\u7D22\u8BCD\u6216\u7B5B\u9009\u6761\u4EF6" })] }))] }));
};
