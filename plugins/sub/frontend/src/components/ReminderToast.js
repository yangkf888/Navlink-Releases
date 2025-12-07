import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 提醒Toast通知组件
 * 显示在右上角的通知消息
 */
import { useEffect, useState } from 'react';
import { Icon } from '../shared/components/Icon';
export const ReminderToast = ({ reminders }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    useEffect(() => {
        if (reminders.length > 0 && !isDismissed) {
            // 延迟显示，产生滑入动画效果
            setTimeout(() => setIsVisible(true), 500);
        }
    }, [reminders, isDismissed]);
    if (reminders.length === 0 || isDismissed)
        return null;
    const urgentCount = reminders.filter(r => r.urgency === 'urgent').length;
    const warningCount = reminders.filter(r => r.urgency === 'warning').length;
    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => setIsDismissed(true), 300);
    };
    return (_jsx("div", { className: `fixed top-20 right-4 z-50 transition-all duration-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`, children: _jsxs("div", { className: "bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-orange-200 overflow-hidden max-w-md", children: [_jsx("div", { className: "h-1 bg-gradient-to-r from-orange-400 via-red-400 to-pink-400" }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center", children: _jsx(Icon, { icon: "fa-solid fa-bell", className: "text-orange-600 text-lg animate-pulse" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "\u8BA2\u9605\u5230\u671F\u63D0\u9192" }), _jsxs("p", { className: "text-xs text-gray-500", children: ["\u60A8\u6709 ", reminders.length, " \u6761\u8BA2\u9605\u9700\u8981\u5173\u6CE8"] })] })] }), _jsx("button", { onClick: handleDismiss, className: "text-gray-400 hover:text-gray-600 transition-colors p-1", children: _jsx(Icon, { icon: "fa-solid fa-times", className: "text-sm" }) })] }), _jsxs("div", { className: "flex gap-2 mb-3", children: [urgentCount > 0 && (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg border border-red-200", children: [_jsx(Icon, { icon: "fa-solid fa-exclamation-circle", className: "text-red-600 text-xs" }), _jsxs("span", { className: "text-xs font-medium text-red-700", children: [urgentCount, " \u7D27\u6025"] })] })), warningCount > 0 && (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-lg border border-yellow-200", children: [_jsx(Icon, { icon: "fa-solid fa-exclamation-triangle", className: "text-yellow-600 text-xs" }), _jsxs("span", { className: "text-xs font-medium text-yellow-700", children: [warningCount, " \u8B66\u544A"] })] }))] }), _jsx("div", { className: "space-y-2 max-h-40 overflow-y-auto", children: reminders.slice(0, 3).map((reminder, index) => (_jsxs("div", { className: "flex items-center gap-2 p-2 bg-gray-50/50 rounded-lg", children: [_jsx(Icon, { icon: reminder.urgency === 'urgent' ? 'fa-solid fa-circle' : 'fa-regular fa-circle', className: `text-xs ${reminder.urgency === 'urgent' ? 'text-red-500' : 'text-yellow-500'}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-gray-900 truncate", children: reminder.subscription.name }), _jsx("p", { className: "text-xs text-gray-500", children: reminder.message })] })] }, reminder.subscription.id))) }), reminders.length > 3 && (_jsx("div", { className: "mt-2 text-center", children: _jsxs("p", { className: "text-xs text-gray-400", children: ["\u8FD8\u6709 ", reminders.length - 3, " \u6761\u63D0\u9192..."] }) }))] })] }) }));
};
