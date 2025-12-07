import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../shared/components/Icon';
import { formatDate } from '../utils/dateUtils';
export const ReminderPanel = ({ reminders, onClose }) => {
    if (reminders.length === 0)
        return null;
    return (_jsx("div", { className: "mb-6 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl shadow-lg", children: _jsxs("div", { className: "p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Icon, { icon: "fa-solid fa-bell", className: "text-orange-600 text-xl mr-2 animate-pulse" }), _jsxs("h3", { className: "text-lg font-semibold text-gray-900", children: ["\u8BA2\u9605\u5230\u671F\u63D0\u9192 (", reminders.length, ")"] })] }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] }), _jsx("div", { className: "space-y-2", children: reminders.map((reminder) => {
                        const iconClass = reminder.urgency === 'urgent'
                            ? 'fa-solid fa-exclamation-circle text-red-600'
                            : reminder.urgency === 'warning'
                                ? 'fa-solid fa-exclamation-triangle text-yellow-600'
                                : 'fa-solid fa-info-circle text-blue-600';
                        const bgClass = reminder.urgency === 'urgent'
                            ? 'bg-red-50 border-red-200'
                            : reminder.urgency === 'warning'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-blue-50 border-blue-200';
                        return (_jsxs("div", { className: `p-3 rounded-lg border ${bgClass} flex items-start gap-3`, children: [_jsx(Icon, { icon: iconClass, className: "mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: reminder.message }), _jsxs("p", { className: "text-xs text-gray-600 mt-1", children: ["\u5230\u671F\u65E5\u671F: ", formatDate(reminder.subscription.expiryDate, 'short'), reminder.subscription.autoRenew && (_jsxs("span", { className: "ml-2 text-green-600", children: [_jsx(Icon, { icon: "fa-solid fa-sync", className: "mr-1" }), "\u81EA\u52A8\u7EED\u8BA2"] }))] })] })] }, reminder.subscription.id));
                    }) })] }) }));
};
