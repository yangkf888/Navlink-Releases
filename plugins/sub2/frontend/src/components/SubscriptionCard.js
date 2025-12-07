import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../shared/components/Icon';
import { getSubscriptionStatus, calculateDaysRemaining, formatDate } from '../utils/dateUtils';
export const SubscriptionCard = ({ subscription, onEdit, onDelete, settings, viewMode = 'grid' }) => {
    const status = getSubscriptionStatus(subscription);
    const daysRemaining = calculateDaysRemaining(subscription.expiryDate);
    // 使用订阅自己的币种符号，如果没有则使用全局默认
    const currencySymbol = subscription.currencySymbol || settings?.display?.currencySymbol || '¥';
    const cardColorMode = settings?.display?.cardColorMode || 'status';
    const customCardColor = settings?.display?.cardColor || '#3b82f6';
    const statusColors = settings?.display?.statusColors || {
        normal: '#10b981',
        attention: '#fbbf24',
        warning: '#fb923c',
        urgent: '#ef4444',
        expired: '#6b7280',
    };
    // 根据状态获取卡片的背景色
    const getCardColor = () => {
        // 如果是固定颜色模式，使用自定义颜色
        if (cardColorMode === 'fixed') {
            return customCardColor;
        }
        // 状态颜色模式 - 使用自定义状态颜色
        if (!subscription.isActive || daysRemaining < 0) {
            return statusColors.expired;
        }
        if (daysRemaining <= 3) {
            return statusColors.urgent;
        }
        if (daysRemaining <= 7) {
            return statusColors.warning;
        }
        if (daysRemaining <= 15) {
            return statusColors.attention;
        }
        return statusColors.normal;
    };
    // 获取状态文本
    const getStatusText = () => {
        if (!subscription.isActive)
            return '已停用';
        if (daysRemaining < 0)
            return '已过期';
        if (daysRemaining === 0)
            return '今天到期';
        if (daysRemaining <= 3)
            return `${daysRemaining}天后到期`;
        if (daysRemaining <= 7)
            return `${daysRemaining}天后到期`;
        return `${daysRemaining}天后到期`;
    };
    // 获取固定颜色（用于list模式的简单背景）
    const getFixedColor = () => {
        if (cardColorMode === 'fixed') {
            return customCardColor;
        }
        // 状态颜色
        if (!subscription.isActive || daysRemaining < 0)
            return '#6b7280'; // gray-500
        if (daysRemaining <= 3)
            return '#ef4444'; // red-500
        if (daysRemaining <= 7)
            return '#fb923c'; // orange-400
        if (daysRemaining <= 15)
            return '#fbbf24'; // yellow-400
        return '#10b981'; // green-500
    };
    const getPeriodText = () => {
        if (subscription.periodUnit === 'month' && subscription.periodValue === 1)
            return '月';
        if (subscription.periodUnit === 'year' && subscription.periodValue === 1)
            return '年';
        if (subscription.periodUnit === 'day')
            return `${subscription.periodValue}天`;
        return `${subscription.periodValue}${subscription.periodUnit === 'month' ? '月' : '年'}`;
    };
    // List View Layout
    if (viewMode === 'list') {
        return (_jsx("div", { className: "group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border-l-4", style: { borderLeftColor: getFixedColor() }, children: _jsxs("div", { className: "p-3 flex items-center gap-3", children: [_jsx("div", { className: "w-2.5 h-2.5 rounded-full flex-shrink-0", style: { backgroundColor: getFixedColor() } }), _jsxs("div", { className: "flex-1 grid grid-cols-8 gap-3 items-center", children: [_jsx("div", { className: "font-semibold text-gray-900 text-[15px] truncate", title: subscription.name, children: subscription.name }), _jsx("div", { className: "flex justify-center", children: _jsx("span", { className: "text-[13px] text-gray-500 bg-gray-100 px-2.5 py-1 rounded whitespace-nowrap", children: subscription.category || '未分类' }) }), _jsx("div", { className: "flex justify-center", children: subscription.customType ? (_jsx("span", { className: "text-[13px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded whitespace-nowrap", children: subscription.customType })) : (_jsx("span", { className: "text-[13px] text-gray-400", children: "-" })) }), _jsx("div", { className: "flex justify-center", children: subscription.reminderValue && subscription.reminderValue > 0 ? (_jsxs("span", { className: "text-[13px] text-yellow-600 whitespace-nowrap flex items-center gap-1", children: [_jsx(Icon, { icon: "fa-solid fa-bell", className: "text-[11px]" }), subscription.reminderValue, subscription.reminderUnit === 'day' ? '天' : 'h'] })) : (_jsx("span", { className: "text-[13px] text-gray-400", children: "-" })) }), _jsx("div", { className: "flex justify-center", children: subscription.notes ? (_jsx("span", { className: "text-[13px] text-gray-500 truncate max-w-full", title: subscription.notes, children: subscription.notes })) : subscription.autoRenew ? (_jsx("span", { className: "text-green-600 text-[13px]", title: "\u81EA\u52A8\u7EED\u8D39", children: _jsx(Icon, { icon: "fa-solid fa-rotate", className: "text-[11px]" }) })) : !subscription.isActive ? (_jsx("span", { className: "text-[13px] text-gray-500 bg-gray-100 px-2.5 py-1 rounded", children: "\u505C\u7528" })) : (_jsx("span", { className: "text-[13px] text-gray-400", children: "-" })) }), _jsxs("div", { className: "text-right", children: [_jsxs("span", { className: "font-bold text-gray-900 text-[15px]", children: [currencySymbol, subscription.price || 0] }), _jsxs("span", { className: "text-[13px] text-gray-500", children: ["/", getPeriodText()] })] }), _jsx("div", { className: "flex justify-center", children: subscription.startDate ? (_jsxs("span", { className: "text-[13px] text-gray-500 whitespace-nowrap flex items-center gap-1", children: [_jsx(Icon, { icon: "fa-solid fa-calendar-plus", className: "text-[11px]" }), formatDate(subscription.startDate, 'short')] })) : (_jsx("span", { className: "text-[13px] text-gray-400", children: "-" })) }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-[14px] text-gray-600", children: formatDate(subscription.expiryDate, 'short') }), _jsx("div", { className: `text-[13px] font-medium ${daysRemaining < 0 ? 'text-gray-500' :
                                            daysRemaining <= 3 ? 'text-red-500' :
                                                daysRemaining <= 7 ? 'text-orange-500' :
                                                    'text-gray-500'}`, children: daysRemaining < 0 ? '已过期' : daysRemaining === 0 ? '今天到期' : `${daysRemaining}天后` })] })] }), (onEdit || onDelete) && (_jsxs("div", { className: "flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0", children: [onEdit && (_jsx("button", { onClick: (e) => { e.stopPropagation(); onEdit(subscription); }, className: "w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors", title: "\u7F16\u8F91", children: _jsx(Icon, { icon: "fa-solid fa-pen", className: "text-xs" }) })), onDelete && (_jsx("button", { onClick: (e) => { e.stopPropagation(); onDelete(subscription.id, subscription.name); }, className: "w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-500 hover:text-white flex items-center justify-center text-gray-600 transition-all", title: "\u5220\u9664", children: _jsx(Icon, { icon: "fa-solid fa-trash", className: "text-xs" }) }))] }))] }) }));
    }
    // Grid View Layout (Card)
    const cardColor = getCardColor();
    return (_jsxs("div", { className: "group relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1", children: [_jsx("div", { className: "absolute inset-0 opacity-90", style: {
                    background: `linear-gradient(to bottom right, ${cardColor}, ${cardColor})`
                } }), _jsxs("div", { className: "absolute inset-0 opacity-10", children: [_jsx("div", { className: "absolute -right-8 -top-8 w-32 h-32 bg-white rounded-full" }), _jsx("div", { className: "absolute -left-4 -bottom-4 w-24 h-24 bg-white rounded-full" })] }), _jsxs("div", { className: "relative p-5 text-white flex flex-col h-full min-h-[200px]", children: [(onEdit || onDelete) && (_jsxs("div", { className: "absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200", children: [onEdit && (_jsx("button", { onClick: (e) => { e.stopPropagation(); onEdit(subscription); }, className: "w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-all", title: "\u7F16\u8F91", children: _jsx(Icon, { icon: "fa-solid fa-pen", className: "text-xs" }) })), onDelete && (_jsx("button", { onClick: (e) => { e.stopPropagation(); onDelete(subscription.id, subscription.name); }, className: "w-8 h-8 rounded-full bg-white/20 hover:bg-red-600 backdrop-blur-md flex items-center justify-center transition-all", title: "\u5220\u9664", children: _jsx(Icon, { icon: "fa-solid fa-trash", className: "text-xs" }) }))] })), _jsxs("div", { className: "mb-3", children: [_jsx("h3", { className: "font-bold text-xl mb-2 line-clamp-1 pr-16", title: subscription.name, children: subscription.name }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsx("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full", children: subscription.category || '未分类' }), subscription.customType && (_jsx("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full", children: subscription.customType })), Boolean(subscription.autoRenew) && (_jsxs("span", { className: "text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1", children: [_jsx(Icon, { icon: "fa-solid fa-rotate", className: "text-[10px]" }), "\u81EA\u52A8\u7EED\u8D39"] }))] })] }), subscription.notes && (_jsx("p", { className: "text-xs text-white/80 mb-3 line-clamp-2", title: subscription.notes, children: subscription.notes })), _jsxs("div", { className: "mt-auto", children: [_jsx("div", { className: "flex items-baseline justify-between mb-3", children: _jsxs("div", { children: [_jsxs("span", { className: "text-3xl font-bold", children: [currencySymbol, subscription.price || 0] }), _jsxs("span", { className: "text-sm ml-1 opacity-80", children: ["/", getPeriodText()] })] }) }), _jsxs("div", { className: "bg-white/20 backdrop-blur-md rounded-xl p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-xs opacity-90", children: "\u4E0B\u6B21\u7EED\u8D39" }), _jsx("span", { className: "text-xs font-medium", children: formatDate(subscription.expiryDate, 'short') })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs opacity-90", children: "\u8DDD\u79BB\u5230\u671F" }), _jsx("span", { className: "text-sm font-bold", children: daysRemaining < 0 ? '已过期' : daysRemaining === 0 ? '今天' : `${daysRemaining}天` })] })] })] })] })] }));
};
