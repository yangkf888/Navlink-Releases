import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * 自定义提醒表单组件
 */
import { useState, useEffect } from 'react';
import { Icon } from '../shared/components/Icon';
import { getCurrentTimeString } from '../utils/dateUtils';
export const ReminderForm = ({ initialDate, reminder, timezone, onSave, onCancel }) => {
    const [title, setTitle] = useState(reminder?.title || '');
    const [description, setDescription] = useState(reminder?.description || '');
    const [reminderDate, setReminderDate] = useState(reminder?.reminderDate || initialDate || '');
    const [reminderTime, setReminderTime] = useState(reminder?.reminderTime || getCurrentTimeString(timezone));
    const [isActive, setIsActive] = useState(reminder?.isActive ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // 设置默认时间为今天
    useEffect(() => {
        if (!reminderDate && initialDate) {
            setReminderDate(initialDate);
        }
    }, [initialDate]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        // 验证
        if (!title.trim()) {
            setError('请输入提醒标题');
            return;
        }
        if (!reminderDate) {
            setError('请选择提醒日期');
            return;
        }
        if (!reminderTime) {
            setError('请选择提醒时间');
            return;
        }
        // 验证日期不能是过去
        const selectedDateTime = new Date(`${reminderDate}T${reminderTime}`);
        const now = new Date();
        if (selectedDateTime < now && !reminder) {
            setError('提醒时间不能早于当前时间');
            return;
        }
        try {
            setSaving(true);
            setError('');
            await onSave({
                title: title.trim(),
                description: description.trim(),
                reminderDate,
                reminderTime,
                isActive
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900", children: reminder ? '编辑提醒' : '新建提醒' }), _jsx("button", { type: "button", onClick: onCancel, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] }), error && (_jsxs("div", { className: "bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-exclamation-circle" }), error] })), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["\u63D0\u9192\u6807\u9898 ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "\u4F8B\u5982\uFF1A\u56E2\u961F\u4F1A\u8BAE\u3001\u7F34\u7EB3\u7269\u4E1A\u8D39\u7B49", className: "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", maxLength: 100 })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u63CF\u8FF0\u4FE1\u606F\uFF08\u53EF\u9009\uFF09" }), _jsx("textarea", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "\u8865\u5145\u8BF4\u660E...", rows: 3, className: "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none", maxLength: 500 })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["\u63D0\u9192\u65E5\u671F ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "date", value: reminderDate, onChange: (e) => setReminderDate(e.target.value), className: "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["\u63D0\u9192\u65F6\u95F4 ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "time", value: reminderTime, onChange: (e) => setReminderTime(e.target.value), className: "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", id: "isActive", checked: isActive, onChange: (e) => setIsActive(e.target.checked), className: "w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" }), _jsx("label", { htmlFor: "isActive", className: "text-sm text-gray-700", children: "\u542F\u7528\u6B64\u63D0\u9192" })] }), _jsxs("div", { className: "flex gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onCancel, className: "flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium", children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", disabled: saving, className: "flex-1 px-4 py-2.5 bg-[var(--theme-primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2", children: saving ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), "\u4FDD\u5B58\u4E2D..."] })) : (_jsxs(_Fragment, { children: [_jsx(Icon, { icon: "fa-solid fa-check" }), "\u4FDD\u5B58"] })) })] })] }));
};
