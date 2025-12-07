import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 订阅表单组件
 * 用于添加和编辑订阅
 */
import { useState, useEffect } from 'react';
import { Icon } from '../shared/components/Icon';
import { getTodayDate } from '../utils/dateUtils';
export const SubscriptionForm = ({ subscription, onSave, onCancel, settings, onUpdateSettings }) => {
    const [formData, setFormData] = useState({
        name: subscription?.name || '',
        customType: subscription?.customType || '',
        category: subscription?.category || '',
        notes: subscription?.notes || '',
        isActive: subscription?.isActive ?? true,
        autoRenew: subscription?.autoRenew ?? false,
        startDate: subscription?.startDate || getTodayDate(),
        expiryDate: subscription?.expiryDate || '',
        periodValue: subscription?.periodValue || settings?.defaults?.periodValue || 1,
        periodUnit: subscription?.periodUnit || settings?.defaults?.periodUnit || 'month',
        reminderValue: subscription?.reminderValue || settings?.defaults?.reminderValue || 3,
        reminderUnit: subscription?.reminderUnit || settings?.defaults?.reminderUnit || 'day',
        useLunar: subscription?.useLunar || false,
        price: subscription?.price || 0,
        currency: subscription?.currency || settings?.display?.currency || 'CNY',
        currencySymbol: subscription?.currencySymbol || settings?.display?.currencySymbol || '¥',
        icon: subscription?.icon || ''
    });
    // 编辑模式：填充现有数据
    useEffect(() => {
        if (subscription) {
            setFormData({
                ...subscription,
                // 确保币种字段有默认值（仅在初始化时使用settings的值）
                currency: subscription.currency || settings?.display?.currency || 'CNY',
                currencySymbol: subscription.currencySymbol || settings?.display?.currencySymbol || '¥'
            });
        }
    }, [subscription]); // 不依赖settings，避免全局settings变化时重置表单
    // 自动计算到期时间
    useEffect(() => {
        // 仅在非编辑模式或用户手动修改了相关字段时触发
        // 这里简化为：只要相关字段变化且有开始时间，就尝试计算
        if (formData.startDate && formData.periodValue && formData.periodUnit) {
            const date = new Date(formData.startDate);
            const { periodValue, periodUnit } = formData;
            switch (periodUnit) {
                case 'day':
                    date.setDate(date.getDate() + periodValue);
                    break;
                case 'month':
                    date.setMonth(date.getMonth() + periodValue);
                    break;
                case 'year':
                    date.setFullYear(date.getFullYear() + periodValue);
                    break;
            }
            // 格式化为 YYYY-MM-DD
            const newExpiry = date.toISOString().split('T')[0];
            // 只有当计算出的日期不同时才更新，避免死循环（虽然这里依赖项明确，不太会）
            // 另外，如果是编辑模式，可能用户不想覆盖原有的到期时间？
            // 用户需求是“新建或修改时...自动计算”。我们假设用户修改周期就是为了更新到期时间。
            if (newExpiry !== formData.expiryDate) {
                setFormData(prev => ({ ...prev, expiryDate: newExpiry }));
            }
        }
    }, [formData.startDate, formData.periodValue, formData.periodUnit]);
    const handleSubmit = (e) => {
        e.preventDefault();
        // 验证必填字段
        if (!formData.name || !formData.expiryDate) {
            alert('请填写订阅名称和到期日期');
            return;
        }
        onSave(formData);
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const isEditMode = !!subscription;
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 md:space-y-6", children: [_jsx("div", { className: "flex items-center justify-between pb-3 md:pb-4 border-b border-gray-200", children: _jsxs("h3", { className: "text-lg md:text-xl font-semibold text-gray-900", children: [_jsx(Icon, { icon: isEditMode ? 'fa-solid fa-edit' : 'fa-solid fa-plus', className: "mr-2" }), isEditMode ? '编辑订阅' : '添加订阅'] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["\u8BA2\u9605\u540D\u79F0 ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => handleChange('name', e.target.value), placeholder: "\u4F8B\u5982\uFF1ANetflix\u3001iCloud \u7B49", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u7C7B\u578B" }), _jsx("input", { type: "text", value: formData.customType, onChange: (e) => handleChange('customType', e.target.value), placeholder: "\u6D41\u5A92\u4F53\u3001\u4E91\u670D\u52A1\u3001\u8F6F\u4EF6\u8BA2\u9605\u7B49", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u5206\u7C7B" }), _jsx("input", { type: "text", value: formData.category, onChange: (e) => handleChange('category', e.target.value), placeholder: "\u4E2A\u4EBA\u3001\u5DE5\u4F5C\u3001\u5BB6\u5EAD\u7B49", list: "category-options", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" }), _jsx("datalist", { id: "category-options", children: (settings?.categories || ['个人', '家庭', '工作']).map((cat) => (_jsx("option", { value: cat }, cat))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u4EF7\u683C" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: "0", step: "0.01", value: formData.price || 0, onChange: (e) => handleChange('price', parseFloat(e.target.value) || 0), placeholder: "0.00", className: "flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" }), _jsxs("select", { value: formData.currency || 'CNY', onChange: (e) => {
                                            const currency = e.target.value;
                                            const symbolMap = {
                                                'CNY': '¥',
                                                'USD': '$',
                                                'EUR': '€',
                                                'GBP': '£'
                                            };
                                            // 更新当前订阅的币种
                                            handleChange('currency', currency);
                                            handleChange('currencySymbol', symbolMap[currency] || '¥');
                                        }, className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white", children: [_jsx("option", { value: "CNY", children: "\u00A5 CNY" }), _jsx("option", { value: "USD", children: "$ USD" }), _jsx("option", { value: "EUR", children: "\u20AC EUR" }), _jsx("option", { value: "GBP", children: "\u00A3 GBP" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u5F00\u59CB\u65E5\u671F" }), _jsx("input", { type: "date", value: formData.startDate, onChange: (e) => handleChange('startDate', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["\u5230\u671F\u65E5\u671F ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "date", value: formData.expiryDate, onChange: (e) => handleChange('expiryDate', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u7EED\u8BA2\u5468\u671F" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: "1", value: formData.periodValue, onChange: (e) => handleChange('periodValue', parseInt(e.target.value)), className: "flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" }), _jsxs("select", { value: formData.periodUnit, onChange: (e) => handleChange('periodUnit', e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white", children: [_jsx("option", { value: "day", children: "\u5929" }), _jsx("option", { value: "month", children: "\u6708" }), _jsx("option", { value: "year", children: "\u5E74" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u63D0\u524D\u63D0\u9192" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: "1", value: formData.reminderValue, onChange: (e) => handleChange('reminderValue', parseInt(e.target.value)), className: "flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" }), _jsxs("select", { value: formData.reminderUnit, onChange: (e) => handleChange('reminderUnit', e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white", children: [_jsx("option", { value: "hour", children: "\u5C0F\u65F6" }), _jsx("option", { value: "day", children: "\u5929" })] })] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "\u5907\u6CE8" }), _jsx("textarea", { value: formData.notes, onChange: (e) => handleChange('notes', e.target.value), placeholder: "\u6DFB\u52A0\u5907\u6CE8\u4FE1\u606F...", rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" })] }), _jsxs("div", { className: "md:col-span-2 space-y-3", children: [_jsxs("label", { className: "flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: formData.isActive, onChange: (e) => handleChange('isActive', e.target.checked), className: "w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "\u542F\u7528\u6B64\u8BA2\u9605" })] }), _jsxs("label", { className: "flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: formData.autoRenew, onChange: (e) => handleChange('autoRenew', e.target.checked), className: "w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "\u81EA\u52A8\u7EED\u8BA2" })] })] })] }), _jsxs("div", { className: "flex gap-3 justify-end pt-4 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: onCancel, className: "px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors", children: "\u53D6\u6D88" }), _jsxs("button", { type: "submit", className: "px-5 py-2 bg-[var(--theme-primary)] hover:opacity-90 text-white rounded-lg font-medium transition-opacity shadow-md hover:shadow-lg", children: [_jsx(Icon, { icon: "fa-solid fa-save", className: "mr-2" }), isEditMode ? '保存修改' : '添加订阅'] })] })] }));
};
