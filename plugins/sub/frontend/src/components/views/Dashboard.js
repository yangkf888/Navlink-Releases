import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Icon } from '../../shared/components/Icon';
import { SubscriptionCard } from '../SubscriptionCard';
import { ReminderCard } from '../ReminderCard';
import { convertToCNY } from '../../utils/currencyUtils';
export const Dashboard = ({ subscriptions, reminders, onNavigate, onAdd, onEditReminder, onDeleteReminder, settings }) => {
    // 统计数据计算
    const stats = useMemo(() => {
        const activeSubs = subscriptions.filter(s => s.isActive);
        const totalMonthly = activeSubs.reduce((acc, sub) => {
            let monthlyPrice = 0;
            if (sub.periodUnit === 'month')
                monthlyPrice = sub.price / sub.periodValue;
            else if (sub.periodUnit === 'year')
                monthlyPrice = sub.price / (sub.periodValue * 12);
            else if (sub.periodUnit === 'day')
                monthlyPrice = sub.price / (sub.periodValue / 30);
            // 将每月支出转换为人民币
            const monthlyPriceInCNY = convertToCNY(monthlyPrice, sub.currency);
            return acc + monthlyPriceInCNY;
        }, 0);
        const totalYearly = totalMonthly * 12;
        // 计算即将到期 (未来30天内)
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);
        const upcoming = activeSubs.filter(sub => {
            const expiry = new Date(sub.expiryDate);
            return expiry >= today && expiry <= next30Days;
        }).length;
        return {
            monthly: totalMonthly,
            yearly: totalYearly,
            count: activeSubs.length,
            upcoming
        };
    }, [subscriptions]);
    // 获取最近添加/更新的订阅 (Top 4)
    const recentSubs = useMemo(() => {
        return [...subscriptions]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 4);
    }, [subscriptions]);
    // 获取未过期、未通知的提醒 (Top 4)
    const activeReminders = useMemo(() => {
        const now = new Date();
        return reminders
            .filter(reminder => {
            if (!reminder.isActive || reminder.notified)
                return false;
            const reminderDateTime = new Date(`${reminder.reminderDate}T${reminder.reminderTime}`);
            return reminderDateTime >= now;
        })
            .sort((a, b) => {
            const dateA = new Date(`${a.reminderDate}T${a.reminderTime}`);
            const dateB = new Date(`${b.reminderDate}T${b.reminderTime}`);
            return dateA.getTime() - dateB.getTime();
        })
            .slice(0, 4);
    }, [reminders]);
    const currencySymbol = settings.display?.currencySymbol || '¥';
    const showWidgets = settings.display?.showWidgets ?? true;
    return (_jsxs("div", { className: "space-y-8 animate-fade-in pt-2 px-8", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "\u4EEA\u8868\u76D8" }), _jsx("p", { className: "text-gray-500 mt-1", children: "\u6B22\u8FCE\u56DE\u6765,\u67E5\u770B\u60A8\u7684\u8BA2\u9605\u6982\u89C8" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { onClick: () => onNavigate('list'), className: "px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium shadow-sm", children: [_jsx(Icon, { icon: "fa-solid fa-list" }), "\u7BA1\u7406\u8BA2\u9605"] }), _jsxs("button", { onClick: onAdd, className: "px-4 py-2 bg-[var(--theme-primary)] text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 font-medium shadow-lg shadow-red-100", children: [_jsx(Icon, { icon: "fa-solid fa-plus" }), "\u65B0\u5EFA\u8BA2\u9605"] })] })] }), showWidgets && (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4", children: [_jsxs("div", { className: "bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-100 relative overflow-hidden group", children: [_jsx("div", { className: "absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110" }), _jsxs("div", { className: "relative z-10", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3 opacity-90", children: [_jsx(Icon, { icon: "fa-solid fa-calendar-check" }), _jsx("span", { className: "text-sm font-medium", children: "\u6708\u5EA6\u652F\u51FA" })] }), _jsxs("div", { className: "text-3xl font-bold mb-1", children: ["\u00A5", stats.monthly.toFixed(0)] }), _jsx("div", { className: "text-xs opacity-70", children: "\u9884\u4F30\u6BCF\u6708\u56FA\u5B9A\u652F\u51FA\uFF08\u5DF2\u6298\u7B97CNY\uFF09" })] })] }), _jsxs("div", { className: "bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform", children: _jsx(Icon, { icon: "fa-solid fa-wallet" }) }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "\u5E74\u5EA6\u603B\u652F\u51FA" })] }), _jsxs("div", { className: "text-2xl font-bold text-gray-900 mb-1", children: ["\u00A5", stats.yearly.toFixed(0)] }), _jsx("div", { className: "text-xs text-gray-400", children: "\u57FA\u4E8E\u5F53\u524D\u8BA2\u9605\u8BA1\u7B97\uFF08\u5DF2\u6298\u7B97CNY\uFF09" })] }), _jsxs("div", { className: "bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform", children: _jsx(Icon, { icon: "fa-solid fa-layer-group" }) }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "\u6D3B\u8DC3\u8BA2\u9605" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900 mb-1", children: stats.count }), _jsx("div", { className: "text-xs text-gray-400", children: "\u6B63\u5728\u751F\u6548\u7684\u670D\u52A1" })] }), _jsxs("div", { className: "bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform", children: _jsx(Icon, { icon: "fa-solid fa-clock" }) }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "\u5373\u5C06\u5230\u671F" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900 mb-1", children: stats.upcoming }), _jsx("div", { className: "text-xs text-gray-400", children: "\u672A\u676530\u5929\u5185\u9700\u7EED\u8D39" })] })] })), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: "\u8BA2\u9605\u5217\u8868" }), _jsxs("button", { onClick: () => onNavigate('list'), className: "text-sm text-[var(--theme-primary)] hover:opacity-80 font-medium flex items-center gap-1", children: ["\u67E5\u770B\u5168\u90E8", _jsx(Icon, { icon: "fa-solid fa-arrow-right" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4", children: [recentSubs.map(sub => (_jsx(SubscriptionCard, { subscription: sub, settings: settings }, sub.id))), recentSubs.length === 0 && (_jsxs("div", { className: "col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200", children: [_jsx("div", { className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400", children: _jsx(Icon, { icon: "fa-solid fa-inbox", className: "text-2xl" }) }), _jsx("p", { className: "text-gray-500", children: "\u6682\u65E0\u8BA2\u9605\u6570\u636E" }), _jsx("button", { onClick: onAdd, className: "mt-3 text-[var(--theme-primary)] font-medium hover:underline", children: "\u7ACB\u5373\u6DFB\u52A0" })] }))] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: "\u63D0\u9192\u5217\u8868" }), _jsxs("button", { onClick: () => onNavigate('reminders'), className: "text-sm text-purple-600 hover:opacity-80 font-medium flex items-center gap-1", children: ["\u67E5\u770B\u5168\u90E8", _jsx(Icon, { icon: "fa-solid fa-arrow-right" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4", children: [activeReminders.map(reminder => (_jsx(ReminderCard, { reminder: reminder, onEdit: () => onEditReminder(reminder), onDelete: () => onDeleteReminder(reminder.id, reminder.title), viewMode: "grid" }, reminder.id))), activeReminders.length === 0 && (_jsxs("div", { className: "col-span-full py-12 text-center bg-purple-50 rounded-2xl border border-dashed border-purple-200", children: [_jsx("div", { className: "w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400", children: _jsx(Icon, { icon: "fa-solid fa-bell-slash", className: "text-2xl" }) }), _jsx("p", { className: "text-gray-500", children: "\u6682\u65E0\u6D3B\u8DC3\u63D0\u9192" })] }))] })] })] }));
};
