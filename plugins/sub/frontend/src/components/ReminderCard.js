import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../shared/components/Icon';
export const ReminderCard = ({ reminder, onEdit, onDelete, viewMode }) => {
    // 计算是否已过期
    const reminderDateTime = new Date(`${reminder.reminderDate}T${reminder.reminderTime}`);
    const now = new Date();
    const isPast = reminderDateTime < now;
    // 格式化日期时间
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };
    if (viewMode === 'list') {
        // 列表视图
        return (_jsx("div", { className: `bg-white rounded-xl border p-4 hover:shadow-md transition-all group ${reminder.notified ? 'border-gray-200 opacity-60' : 'border-purple-200'}`, children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("div", { className: `w-1 h-12 rounded-full ${reminder.notified ? 'bg-gray-300' : isPast ? 'bg-orange-500' : 'bg-purple-500'}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("h3", { className: "text-base font-semibold text-gray-900 truncate", children: reminder.title }), reminder.notified && (_jsx("span", { className: "px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full", children: "\u5DF2\u901A\u77E5" })), !reminder.isActive && (_jsx("span", { className: "px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full", children: "\u5DF2\u7981\u7528" }))] }), reminder.description && (_jsx("p", { className: "text-sm text-gray-600 line-clamp-1", children: reminder.description }))] }), _jsxs("div", { className: "text-right shrink-0", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: formatDate(reminder.reminderDate) }), _jsx("div", { className: "text-xs text-purple-600", children: reminder.reminderTime })] }), _jsxs("div", { className: "flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0", children: [_jsx("button", { onClick: onEdit, className: "p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors", title: "\u7F16\u8F91", children: _jsx(Icon, { icon: "fa-solid fa-edit" }) }), _jsx("button", { onClick: onDelete, className: "p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors", title: "\u5220\u9664", children: _jsx(Icon, { icon: "fa-solid fa-trash" }) })] })] }) }));
    }
    // 卡片视图
    // 根据状态获取颜色
    const getCardColor = () => {
        if (reminder.notified)
            return '#9ca3af'; // gray-400
        if (isPast)
            return '#f97316'; // orange-500
        return '#a855f7'; // purple-500
    };
    const cardColor = getCardColor();
    return (_jsxs("div", { className: "group relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1", children: [_jsx("div", { className: "absolute inset-0 opacity-90", style: {
                    background: `linear-gradient(to bottom right, ${cardColor}, ${cardColor})`
                } }), _jsxs("div", { className: "absolute inset-0 opacity-10", children: [_jsx("div", { className: "absolute -right-8 -top-8 w-32 h-32 bg-white rounded-full" }), _jsx("div", { className: "absolute -left-4 -bottom-4 w-24 h-24 bg-white rounded-full" })] }), _jsxs("div", { className: "relative p-5 text-white flex flex-col h-full min-h-[200px]", children: [_jsxs("div", { className: "absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200", children: [_jsx("button", { onClick: onEdit, className: "w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-all", title: "\u7F16\u8F91", children: _jsx(Icon, { icon: "fa-solid fa-pen", className: "text-xs" }) }), _jsx("button", { onClick: onDelete, className: "w-8 h-8 rounded-full bg-white/20 hover:bg-red-600 backdrop-blur-md flex items-center justify-center transition-all", title: "\u5220\u9664", children: _jsx(Icon, { icon: "fa-solid fa-trash", className: "text-xs" }) })] }), _jsxs("div", { className: "mb-3", children: [_jsx("h3", { className: "font-bold text-xl mb-2 line-clamp-1 pr-16", title: reminder.title, children: reminder.title }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [reminder.notified && (_jsx("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full", children: "\u5DF2\u901A\u77E5" })), !reminder.isActive && (_jsx("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full", children: "\u5DF2\u7981\u7528" })), isPast && !reminder.notified && (_jsx("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full", children: "\u5DF2\u8FC7\u671F" }))] })] }), reminder.description && (_jsx("p", { className: "text-xs text-white/80 mb-3 line-clamp-2", title: reminder.description, children: reminder.description })), _jsx("div", { className: "mt-auto", children: _jsxs("div", { className: "bg-white/20 backdrop-blur-md rounded-xl p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-xs opacity-90", children: "\u63D0\u9192\u65E5\u671F" }), _jsx("span", { className: "text-xs font-medium", children: formatDate(reminder.reminderDate) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs opacity-90", children: "\u63D0\u9192\u65F6\u95F4" }), _jsx("span", { className: "text-sm font-bold", children: reminder.reminderTime })] })] }) })] })] }));
};
