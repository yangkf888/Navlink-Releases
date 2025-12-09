import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 配置管理面板
 * 包含：时区设置、通知设置、各类通知配置
 */
console.log('[设置面板] 模块加载时间:', new Date().toLocaleTimeString());
import { useState, useEffect } from 'react';
import { Icon } from '../shared/components/Icon';
import { useDialogs } from '../shared/hooks/useDialogs';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';
import { AlertDialog } from '../shared/components/AlertDialog';
// import { AlertDialog } from '@/src/shared/components/common/AlertDialog';
// API基础路径
const API_BASE = '/api/plugins/sub/api';
export const SettingsPanel = ({ onClose, subscriptions, settings, onUpdateSettings, isAuthenticated }) => {
    console.log('[设置面板] 组件渲染时间:', new Date().toLocaleTimeString());
    const [activeSection, setActiveSection] = useState('general');
    const [subscriptionsData, setSubscriptionsData] = useState('[]');
    const [testingNotification, setTestingNotification] = useState(null);
    const { confirmDialog, showConfirm, hideConfirm, alertDialog, showAlert, hideAlert } = useDialogs();
    // 加载订阅数据
    useEffect(() => {
        setSubscriptionsData(JSON.stringify(subscriptions, null, 2));
    }, [subscriptions]);
    // 测试通知函数
    const handleTestNotification = async (platform) => {
        setTestingNotification(platform);
        try {
            const response = await fetch(`${API_BASE}/subscriptions/test-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ platform, settings })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.success) {
                showAlert('测试成功', `${platform.toUpperCase()} 测试通知发送成功！`, 'success');
            }
            else {
                showAlert('测试失败', `${platform.toUpperCase()} 测试失败：${result.message}`, 'error');
            }
        }
        catch (error) {
            console.error('Test notification error:', error);
            showAlert('测试失败', `${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
        finally {
            setTestingNotification(null);
        }
    };
    // 导入数据
    const handleImportData = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            try {
                const formData = new FormData();
                formData.append('file', file);
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    showAlert('认证失败', '未找到登录凭证，请重新登录', 'error');
                    return;
                }
                const response = await fetch(`${API_BASE}/subscriptions/import`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                if (response.ok) {
                    const result = await response.json();
                    showAlert('导入成功', result.message || '数据已成功导入，页面将自动刷新', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                }
                else {
                    const errorData = await response.json();
                    showAlert('导入失败', errorData.error || '数据导入失败，请检查数据格式', 'error');
                }
            }
            catch (error) {
                console.error('Import error:', error);
                showAlert('导入错误', '导入过程中发生错误', 'error');
            }
        };
        input.click();
    };
    // 清空数据
    const handleClearData = async () => {
        showConfirm('确认清空', '确定要清空所有订阅数据吗？此操作不可恢复！', async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${API_BASE}/subscriptions/clear`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    showAlert('清空成功', '所有订阅数据已清空，页面将自动刷新', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                }
                else {
                    showAlert('清空失败', '数据清空失败，请重试', 'error');
                }
            }
            catch (error) {
                showAlert('操作失败', '清空操作失败，请重试', 'error');
            }
            finally {
                hideConfirm();
            }
        });
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-[100] flex justify-center items-center backdrop-blur-sm animate-fade-in p-0 md:p-4", children: _jsxs("div", { className: "bg-white w-full max-w-7xl h-screen md:h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden", children: [_jsxs("div", { className: "h-14 md:h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-10 pt-safe", children: [_jsxs("div", { className: "flex items-center gap-2 md:gap-3", children: [_jsx("div", { className: "w-8 h-8 md:w-9 md:h-9 bg-[var(--theme-primary)] text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-100", children: _jsx(Icon, { icon: "fa-solid fa-gear", className: "text-base md:text-lg" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-base md:text-lg font-bold text-gray-800", children: "\u8BA2\u9605\u7BA1\u7406\u914D\u7F6E" }), _jsx("p", { className: "text-xs text-gray-400 hidden md:block", children: "\u5B9E\u65F6\u4FDD\u5B58\u751F\u6548" })] })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { onClick: onClose, className: "w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors", children: _jsx(Icon, { icon: "fa-solid fa-times", className: "text-lg md:text-xl" }) }) })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx("div", { className: "hidden md:flex w-64 bg-gray-50 border-r border-gray-100 flex-col shrink-0 overflow-y-auto p-4", children: _jsx("div", { className: "space-y-2", children: [
                                    { id: 'general', icon: 'fa-solid fa-gear', label: '常规设置' },
                                    { id: 'notifications', icon: 'fa-solid fa-bell', label: '通知集成' },
                                    { id: 'data', icon: 'fa-solid fa-database', label: '数据管理' },
                                ].map(section => (_jsxs("button", { onClick: () => setActiveSection(section.id), className: `
                                        w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-[15px]
                                        ${activeSection === section.id
                                        ? 'bg-[var(--theme-primary)] text-white shadow-md shadow-red-100'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}
                                    `, children: [_jsx(Icon, { icon: section.icon, className: activeSection === section.id ? 'text-white' : 'text-gray-600' }), _jsx("span", { children: section.label })] }, section.id))) }) }), _jsxs("div", { className: "flex-1 overflow-hidden flex flex-col", children: [_jsx("div", { className: "md:hidden border-b border-gray-200 bg-white sticky top-0 z-10", children: _jsx("div", { className: "flex overflow-x-auto custom-scrollbar", children: [
                                            { id: 'general', icon: 'fa-solid fa-gear', label: '常规' },
                                            { id: 'notifications', icon: 'fa-solid fa-bell', label: '通知' },
                                            { id: 'data', icon: 'fa-solid fa-database', label: '数据' },
                                        ].map(section => (_jsxs("button", { onClick: () => setActiveSection(section.id), className: `
                                            flex-1 min-w-[80px] flex flex-col items-center gap-1 px-4 py-3 transition-all
                                            ${activeSection === section.id
                                                ? 'text-[var(--theme-primary)] border-b-2 border-[var(--theme-primary)]'
                                                : 'text-gray-500'}
                                        `, children: [_jsx(Icon, { icon: section.icon, className: "text-lg" }), _jsx("span", { className: "text-xs font-medium", children: section.label })] }, section.id))) }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-white pb-safe", children: [!isAuthenticated && (_jsxs("div", { className: "mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3", children: [_jsx(Icon, { icon: "fa-solid fa-lock", className: "text-yellow-600 mt-1" }), _jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-yellow-900 mb-1", children: "\u9700\u8981\u767B\u5F55\u624D\u80FD\u4FEE\u6539\u8BBE\u7F6E" }), _jsx("p", { className: "text-sm text-yellow-700", children: "\u60A8\u5F53\u524D\u672A\u767B\u5F55\u3002\u67D0\u4E9B\u8BBE\u7F6E\u9879\u9700\u8981\u767B\u5F55\u540E\u624D\u80FD\u4FEE\u6539\uFF0C\u4EE5\u786E\u4FDD\u6570\u636E\u5B89\u5168\u3002" })] })] })), activeSection === 'general' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-4", children: "\u57FA\u672C\u8BBE\u7F6E" }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "\u914D\u7F6E\u65F6\u533A\u548C\u663E\u793A\u504F\u597D" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [_jsxs("h4", { className: "text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-clock", className: "text-blue-500" }), "\u65F6\u533A\u8BBE\u7F6E"] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u9009\u62E9\u65F6\u533A" }), _jsxs("select", { value: settings.timezone || 'Asia/Shanghai', onChange: (e) => onUpdateSettings({ ...settings, timezone: e.target.value }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent", children: [_jsx("option", { value: "Asia/Shanghai", children: "\u4E2D\u56FD\u6807\u51C6\u65F6\u95F4 (UTC+8)" }), _jsx("option", { value: "America/New_York", children: "\u4E1C\u90E8\u65F6\u95F4 (UTC-5)" }), _jsx("option", { value: "America/Los_Angeles", children: "\u592A\u5E73\u6D0B\u65F6\u95F4 (UTC-8)" }), _jsx("option", { value: "Europe/London", children: "\u4F26\u6566\u65F6\u95F4 (UTC+0)" }), _jsx("option", { value: "Europe/Paris", children: "\u5DF4\u9ECE\u65F6\u95F4 (UTC+1)" }), _jsx("option", { value: "Asia/Tokyo", children: "\u4E1C\u4EAC\u65F6\u95F4 (UTC+9)" }), _jsx("option", { value: "Asia/Dubai", children: "\u8FEA\u62DC\u65F6\u95F4 (UTC+4)" })] }), _jsxs("p", { className: "mt-2 text-xs text-gray-500", children: ["\u5F53\u524D\u65F6\u95F4\uFF1A", new Date().toLocaleString('zh-CN', { timeZone: settings.timezone || 'Asia/Shanghai' })] })] }) })] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [_jsxs("h4", { className: "text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-tags", className: "text-green-500" }), "\u5206\u7C7B\u7BA1\u7406"] }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "\u81EA\u5B9A\u4E49\u8BA2\u9605\u5206\u7C7B\uFF0C\u4FBF\u4E8E\u7BA1\u7406\u548C\u7B5B\u9009" }), _jsx("div", { className: "space-y-2", children: (settings.categories || []).map((category, index) => (_jsxs("div", { className: "flex items-center gap-2 p-2 bg-gray-50 rounded-lg", children: [_jsx(Icon, { icon: "fa-solid fa-tag", className: "text-gray-400" }), _jsx("span", { className: "flex-1 text-sm text-gray-700", children: category }), _jsx("button", { onClick: () => {
                                                                                    const newCategories = settings.categories.filter((_, i) => i !== index);
                                                                                    onUpdateSettings({ ...settings, categories: newCategories });
                                                                                }, className: "text-red-500 hover:text-red-700 transition-colors", title: "\u5220\u9664\u5206\u7C7B", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] }, index))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", placeholder: "\u8F93\u5165\u65B0\u5206\u7C7B\u540D\u79F0", className: "flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent", onKeyDown: (e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    const input = e.target;
                                                                                    const newCategory = input.value.trim();
                                                                                    if (newCategory && !settings.categories.includes(newCategory)) {
                                                                                        onUpdateSettings({
                                                                                            ...settings,
                                                                                            categories: [...settings.categories, newCategory]
                                                                                        });
                                                                                        input.value = '';
                                                                                    }
                                                                                }
                                                                            } }), _jsxs("button", { onClick: (e) => {
                                                                                const input = e.currentTarget.previousElementSibling;
                                                                                const newCategory = input.value.trim();
                                                                                if (newCategory && !settings.categories.includes(newCategory)) {
                                                                                    onUpdateSettings({
                                                                                        ...settings,
                                                                                        categories: [...settings.categories, newCategory]
                                                                                    });
                                                                                    input.value = '';
                                                                                }
                                                                                else if (!newCategory) {
                                                                                    showAlert('请输入分类名称', '请输入分类名称', 'warning');
                                                                                }
                                                                                else {
                                                                                    showAlert('分类已存在', '该分类已存在', 'warning');
                                                                                }
                                                                            }, className: "px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-plus" }), "\u6DFB\u52A0"] })] }), _jsx("p", { className: "text-xs text-gray-500", children: "\u6309 Enter \u952E\u6216\u70B9\u51FB\"\u6DFB\u52A0\"\u6309\u94AE\u6DFB\u52A0\u65B0\u5206\u7C7B" })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [_jsxs("h4", { className: "text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-palette", className: "text-purple-500" }), "\u663E\u793A\u8BBE\u7F6E"] }), _jsxs("div", { className: "space-y-4 mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "\u5361\u7247\u989C\u8272\u6A21\u5F0F" }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", name: "cardColorMode", checked: settings.display?.cardColorMode === 'status', onChange: () => onUpdateSettings({
                                                                                        ...settings,
                                                                                        display: { ...settings.display, cardColorMode: 'status' }
                                                                                    }), className: "text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]" }), _jsx("span", { className: "text-sm text-gray-700", children: "\u72B6\u6001\u989C\u8272\uFF08\u6839\u636E\u5230\u671F\u65F6\u95F4\uFF09" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", name: "cardColorMode", checked: settings.display?.cardColorMode === 'fixed', onChange: () => onUpdateSettings({
                                                                                        ...settings,
                                                                                        display: { ...settings.display, cardColorMode: 'fixed' }
                                                                                    }), className: "text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]" }), _jsx("span", { className: "text-sm text-gray-700", children: "\u56FA\u5B9A\u989C\u8272" })] })] })] }), settings.display?.cardColorMode === 'fixed' && (_jsxs("div", { className: "mb-6 p-4 bg-gray-50 rounded-lg", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u9009\u62E9\u5361\u7247\u989C\u8272" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "color", value: settings.display?.cardColor || '#3b82f6', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                display: { ...settings.display, cardColor: e.target.value }
                                                                            }), className: "w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-700", children: settings.display?.cardColor || '#3b82f6' }), _jsx("p", { className: "text-xs text-gray-500", children: "\u6240\u6709\u5361\u7247\u5C06\u4F7F\u7528\u8BE5\u989C\u8272" })] })] })] })), settings.display?.cardColorMode === 'status' && (_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-3", children: "\u81EA\u5B9A\u4E49\u72B6\u6001\u989C\u8272" }), [
                                                                    { key: 'normal', label: '正常 (15天以上)', default: '#10b981' },
                                                                    { key: 'attention', label: '注意 (8-15天)', default: '#fbbf24' },
                                                                    { key: 'warning', label: '警告 (4-7天)', default: '#fb923c' },
                                                                    { key: 'urgent', label: '紧急 (0-3天)', default: '#ef4444' },
                                                                    { key: 'expired', label: '已过期', default: '#6b7280' },
                                                                ].map(status => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsx("span", { className: "text-sm text-gray-700 font-medium", children: status.label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "color", value: settings.display?.statusColors?.[status.key] || status.default, onChange: (e) => onUpdateSettings({
                                                                                        ...settings,
                                                                                        display: {
                                                                                            ...settings.display,
                                                                                            statusColors: {
                                                                                                ...(settings.display?.statusColors || {
                                                                                                    normal: '#10b981',
                                                                                                    attention: '#fbbf24',
                                                                                                    warning: '#fb923c',
                                                                                                    urgent: '#ef4444',
                                                                                                    expired: '#6b7280',
                                                                                                }),
                                                                                                [status.key]: e.target.value
                                                                                            }
                                                                                        }
                                                                                    }), className: "w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer" }), _jsx("span", { className: "text-xs text-gray-500 w-20 font-mono", children: settings.display?.statusColors?.[status.key] || status.default })] })] }, status.key)))] }))] })] })), activeSection === 'notifications' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-4", children: "\u901A\u77E5\u96C6\u6210" }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "\u914D\u7F6E\u5404\u79CD\u901A\u77E5\u6E20\u9053\u548C\u63D0\u9192\u89C4\u5219" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [_jsxs("h4", { className: "text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-bell-concierge", className: "text-orange-500" }), "\u901A\u77E5\u65F6\u6BB5"] }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "\u9009\u62E9\u5E0C\u671B\u63A5\u6536\u901A\u77E5\u7684\u65F6\u95F4\u6BB5\uFF08\u57FA\u4E8E\u60A8\u8BBE\u7F6E\u7684\u65F6\u533A\uFF09" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u5F00\u59CB\u65F6\u95F4" }), _jsx("input", { type: "time", value: settings.notification?.timeRange?.start || '09:00', onChange: (e) => onUpdateSettings({
                                                                                        ...settings,
                                                                                        notification: {
                                                                                            ...settings.notification,
                                                                                            timeRange: {
                                                                                                ...settings.notification?.timeRange,
                                                                                                start: e.target.value
                                                                                            }
                                                                                        }
                                                                                    }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u7ED3\u675F\u65F6\u95F4" }), _jsx("input", { type: "time", value: settings.notification?.timeRange?.end || '22:00', onChange: (e) => onUpdateSettings({
                                                                                        ...settings,
                                                                                        notification: {
                                                                                            ...settings.notification,
                                                                                            timeRange: {
                                                                                                ...settings.notification?.timeRange,
                                                                                                end: e.target.value
                                                                                            }
                                                                                        }
                                                                                    }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent" })] })] }), _jsx("p", { className: "text-xs text-gray-500", children: "\u53EA\u5728\u8BE5\u65F6\u95F4\u6BB5\u5185\u53D1\u9001\u901A\u77E5" })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [_jsxs("h4", { className: "text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-repeat", className: "text-green-500" }), "\u901A\u77E5\u95F4\u9694\u548C\u6B21\u6570"] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u901A\u77E5\u95F4\u9694\uFF08\u5C0F\u65F6\uFF09" }), _jsx("input", { type: "number", min: "1", max: "24", value: settings.notification?.interval || 6, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                notification: {
                                                                                    ...settings.notification,
                                                                                    interval: parseInt(e.target.value) || 6
                                                                                }
                                                                            }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "\u6BCF\u9694\u591A\u5C11\u5C0F\u65F6\u53D1\u9001\u4E00\u6B21\u901A\u77E5" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u6700\u5927\u901A\u77E5\u6B21\u6570" }), _jsx("input", { type: "number", min: "1", max: "10", value: settings.notification?.maxCount || 3, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                notification: {
                                                                                    ...settings.notification,
                                                                                    maxCount: parseInt(e.target.value) || 3
                                                                                }
                                                                            }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "\u8FBE\u5230\u6B64\u6B21\u6570\u540E\u505C\u6B62\u901A\u77E5" })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-brands fa-telegram", className: "text-blue-600" }), "Telegram \u901A\u77E5"] }), _jsx("p", { className: "text-sm text-blue-700", children: "\u901A\u8FC7 Telegram Bot \u63A5\u6536\u901A\u77E5" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.telegram?.enabled || false, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                telegram: { ...settings.telegram, enabled: e.target.checked }
                                                                            }), className: "w-5 h-5 text-blue-600 rounded focus:ring-blue-500" }), _jsx("span", { className: "text-sm font-medium text-blue-900", children: "\u542F\u7528" })] })] }), settings.telegram?.enabled && (_jsxs("div", { className: "space-y-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-blue-900 mb-2", children: "Bot Token" }), _jsx("input", { type: "text", value: settings.telegram?.botToken || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                telegram: { ...settings.telegram, botToken: e.target.value }
                                                                            }), placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", className: "w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-blue-600", children: "\u4ECE @BotFather \u83B7\u53D6" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-blue-900 mb-2", children: "Chat ID" }), _jsx("input", { type: "text", value: settings.telegram?.chatId || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                telegram: { ...settings.telegram, chatId: e.target.value }
                                                                            }), placeholder: "123456789", className: "w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-blue-600", children: "\u4ECE @userinfobot \u83B7\u53D6" })] }), _jsxs("button", { onClick: () => handleTestNotification('telegram'), disabled: testingNotification === 'telegram' || !settings.telegram?.botToken || !settings.telegram?.chatId, className: "w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-paper-plane" }), testingNotification === 'telegram' ? '发送中...' : '发送测试通知'] })] }))] }), _jsxs("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl border border-purple-200 p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-purple-900 mb-2 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-bell", className: "text-purple-600" }), "NotifyX \u901A\u77E5"] }), _jsx("p", { className: "text-sm text-purple-700", children: "\u901A\u8FC7 NotifyX \u670D\u52A1\u53D1\u9001\u901A\u77E5" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.notifyx?.enabled || false, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                notifyx: { ...settings.notifyx, enabled: e.target.checked }
                                                                            }), className: "w-5 h-5 text-purple-600 rounded focus:ring-purple-500" }), _jsx("span", { className: "text-sm font-medium text-purple-900", children: "\u542F\u7528" })] })] }), settings.notifyx?.enabled && (_jsxs("div", { className: "space-y-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-purple-900 mb-2", children: "API Key" }), _jsx("input", { type: "text", value: settings.notifyx?.apiKey || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                notifyx: { ...settings.notifyx, apiKey: e.target.value }
                                                                            }), placeholder: "your-api-key-here", className: "w-full px-4 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-purple-900 mb-2", children: "Endpoint" }), _jsx("input", { type: "url", value: settings.notifyx?.endpoint || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                notifyx: { ...settings.notifyx, endpoint: e.target.value }
                                                                            }), placeholder: "https://api.notifyx.com/v1/notify", className: "w-full px-4 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" })] }), _jsxs("button", { onClick: () => handleTestNotification('notifyx'), disabled: testingNotification === 'notifyx' || !settings.notifyx?.apiKey, className: "w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-paper-plane" }), testingNotification === 'notifyx' ? '发送中...' : '发送测试通知'] })] }))] }), _jsxs("div", { className: "bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-200 p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-green-900 mb-2 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-link", className: "text-green-600" }), "Webhook \u901A\u77E5"] }), _jsx("p", { className: "text-sm text-green-700", children: "\u901A\u8FC7 Webhook \u53D1\u9001\u901A\u77E5\u5230\u81EA\u5B9A\u4E49\u670D\u52A1" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.webhook?.enabled || false, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                webhook: { ...settings.webhook, enabled: e.target.checked }
                                                                            }), className: "w-5 h-5 text-green-600 rounded focus:ring-green-500" }), _jsx("span", { className: "text-sm font-medium text-green-900", children: "\u542F\u7528" })] })] }), settings.webhook?.enabled && (_jsxs("div", { className: "space-y-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-green-900 mb-2", children: "Webhook URL" }), _jsx("input", { type: "url", value: settings.webhook?.url || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                webhook: { ...settings.webhook, url: e.target.value }
                                                                            }), placeholder: "https://your-server.com/webhook", className: "w-full px-4 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-green-900 mb-2", children: "HTTP \u65B9\u6CD5" }), _jsxs("select", { value: settings.webhook?.method || 'POST', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                webhook: { ...settings.webhook, method: e.target.value }
                                                                            }), className: "w-full px-4 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent", children: [_jsx("option", { value: "POST", children: "POST" }), _jsx("option", { value: "GET", children: "GET" })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-green-900 mb-2", children: ["\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934 (JSON \u683C\u5F0F)", _jsx("span", { className: "text-xs text-green-600 ml-2", children: "\u53EF\u9009" })] }), _jsx("textarea", { value: settings.webhook?.headers || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                webhook: { ...settings.webhook, headers: e.target.value }
                                                                            }), placeholder: '{"Authorization": "Bearer YOUR_TOKEN", "Custom-Header": "value"}', className: "w-full px-4 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm", rows: 3 }), _jsxs("p", { className: "mt-1 text-xs text-green-600", children: ["\u4F8B\uFF1A", '{', "\"Authorization\": \"Bearer token\"", '}'] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-green-900 mb-2", children: ["\u6D88\u606F\u6A21\u677F (JSON \u683C\u5F0F)", _jsx("span", { className: "text-xs text-green-600 ml-2", children: "\u53EF\u9009" })] }), _jsx("textarea", { value: settings.webhook?.template || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                webhook: { ...settings.webhook, template: e.target.value }
                                                                            }), placeholder: '{"text": "{{content}}", "title": "{{title}}"}', className: "w-full px-4 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm", rows: 4 }), _jsxs("p", { className: "mt-1 text-xs text-green-600", children: ["\u652F\u6301\u53D8\u91CF\uFF1A", '{{', "title", '}}', " ", '{{', "content", '}}', " ", '{{', "subscriptions", '}}', " ", '{{', "timestamp", '}}'] })] }), _jsxs("button", { onClick: () => handleTestNotification('webhook'), disabled: testingNotification === 'webhook' || !settings.webhook?.url, className: "w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-paper-plane" }), testingNotification === 'webhook' ? '发送中...' : '发送测试通知'] })] }))] }), _jsxs("div", { className: "bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl border border-orange-200 p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-orange-900 mb-2 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-brands fa-apple", className: "text-orange-600" }), "Bark \u901A\u77E5"] }), _jsx("p", { className: "text-sm text-orange-700", children: "\u901A\u8FC7 Bark \u53D1\u9001 iOS \u63A8\u9001\u901A\u77E5" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.bark?.enabled || false, onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                bark: { ...settings.bark, enabled: e.target.checked }
                                                                            }), className: "w-5 h-5 text-orange-600 rounded focus:ring-orange-500" }), _jsx("span", { className: "text-sm font-medium text-orange-900", children: "\u542F\u7528" })] })] }), settings.bark?.enabled && (_jsxs("div", { className: "space-y-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-orange-900 mb-2", children: "Device Key" }), _jsx("input", { type: "text", value: settings.bark?.deviceKey || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                bark: { ...settings.bark, deviceKey: e.target.value }
                                                                            }), placeholder: "your-device-key", className: "w-full px-4 py-2 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-orange-600", children: "\u4ECE Bark App \u4E2D\u83B7\u53D6" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-orange-900 mb-2", children: "\u670D\u52A1\u5668\u5730\u5740" }), _jsx("input", { type: "url", value: settings.bark?.server || '', onChange: (e) => onUpdateSettings({
                                                                                ...settings,
                                                                                bark: { ...settings.bark, server: e.target.value }
                                                                            }), placeholder: "https://api.day.app", className: "w-full px-4 py-2 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("p", { className: "mt-1 text-xs text-orange-600", children: "\u9ED8\u8BA4\u4F7F\u7528\u5B98\u65B9\u670D\u52A1\u5668" })] }), _jsxs("button", { onClick: () => handleTestNotification('bark'), disabled: testingNotification === 'bark' || !settings.bark?.deviceKey, className: "w-full mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-paper-plane" }), testingNotification === 'bark' ? '发送中...' : '发送测试通知'] })] }))] })] })), activeSection === 'data' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-xl font-bold text-gray-900 mb-2 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-database", className: "text-blue-500" }), "\u6570\u636E\u7BA1\u7406"] }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "\u5BFC\u51FA\u3001\u5BFC\u5165\u548C\u5907\u4EFD\u8BA2\u9605\u6570\u636E" })] }), _jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-xl border border-blue-200 shadow-sm", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-bold text-blue-800 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-download" }), "\u5BFC\u51FA\u8BA2\u9605\u6570\u636E"] }), _jsx("p", { className: "text-sm text-blue-600 mt-1", children: "\u4FDD\u5B58\u6240\u6709\u8BA2\u9605\u6570\u636E\u5230\u672C\u5730\uFF0C\u7528\u4E8E\u5907\u4EFD\u6216\u8FC1\u79FB" })] }), _jsx("div", { className: "flex gap-2", children: _jsxs("button", { onClick: async () => {
                                                                            try {
                                                                                const token = localStorage.getItem('auth_token');
                                                                                const response = await fetch(`${API_BASE}/subscriptions/export`, {
                                                                                    headers: {
                                                                                        'Authorization': `Bearer ${token}`
                                                                                    }
                                                                                });
                                                                                if (!response.ok) {
                                                                                    throw new Error('服务器返回错误');
                                                                                }
                                                                                const blob = await response.blob();
                                                                                const url = URL.createObjectURL(blob);
                                                                                const link = document.createElement('a');
                                                                                link.href = url;
                                                                                link.download = `subscriptions-backup-${new Date().toISOString().split('T')[0]}.json`;
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                document.body.removeChild(link);
                                                                                URL.revokeObjectURL(url);
                                                                            }
                                                                            catch (error) {
                                                                                showAlert('下载失败', '无法下载数据，请重试', 'error');
                                                                            }
                                                                        }, className: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-sm", type: "button", children: [_jsx(Icon, { icon: "fa-solid fa-file-arrow-down" }), "\u4E0B\u8F7D\u6587\u4EF6"] }) })] }), _jsx("textarea", { readOnly: true, value: subscriptionsData, className: "w-full h-48 font-mono text-xs bg-white/80 text-gray-700 border border-blue-200 rounded-lg p-4 resize-none", onClick: (e) => e.target.select() })] }), _jsxs("div", { className: "bg-gradient-to-br from-green-50 to-green-100/50 p-6 rounded-xl border border-green-200 shadow-sm", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("h3", { className: "text-lg font-bold text-green-800 flex items-center gap-2 mb-2", children: [_jsx(Icon, { icon: "fa-solid fa-upload" }), "\u5BFC\u5165\u8BA2\u9605\u6570\u636E"] }), _jsx("p", { className: "text-sm text-green-600", children: "\u4ECE\u672C\u5730\u6587\u4EF6\u6062\u590D\u8BA2\u9605\u6570\u636E" })] }), _jsxs("div", { className: "bg-white/80 p-4 rounded-lg border-2 border-dashed border-green-300", children: [_jsxs("button", { onClick: handleImportData, className: "w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-file-import" }), "\u9009\u62E9\u6587\u4EF6\u5BFC\u5165"] }), _jsx("p", { className: "text-xs text-green-600 mt-3 text-center", children: "\u26A0\uFE0F \u5BFC\u5165\u5C06\u8986\u76D6\u73B0\u6709\u6570\u636E\uFF0C\u8BF7\u5148\u5907\u4EFD" })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-red-50 to-red-100/50 p-6 rounded-xl border border-red-200 shadow-sm", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("h3", { className: "text-lg font-bold text-red-800 flex items-center gap-2 mb-2", children: [_jsx(Icon, { icon: "fa-solid fa-trash-can" }), "\u6E05\u7A7A\u6240\u6709\u6570\u636E"] }), _jsx("p", { className: "text-sm text-red-600", children: "\u5220\u9664\u6240\u6709\u8BA2\u9605\u8BB0\u5F55\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D" })] }), _jsxs("button", { onClick: handleClearData, className: "w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-exclamation-triangle" }), "\u6E05\u7A7A\u6240\u6709\u6570\u636E"] })] }), _jsxs("div", { className: "bg-white p-6 rounded-xl border border-gray-200", children: [_jsxs("h4", { className: "text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-chart-pie" }), "\u6570\u636E\u7EDF\u8BA1"] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200", children: [_jsx("p", { className: "text-sm text-purple-600 mb-1 font-medium", children: "\u8BA2\u9605\u603B\u6570" }), _jsx("p", { className: "text-3xl font-bold text-purple-800", children: JSON.parse(subscriptionsData).length })] }), _jsxs("div", { className: "bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200", children: [_jsx("p", { className: "text-sm text-indigo-600 mb-1 font-medium", children: "\u6570\u636E\u5927\u5C0F" }), _jsxs("p", { className: "text-3xl font-bold text-indigo-800", children: [(new Blob([subscriptionsData]).size / 1024).toFixed(2), " KB"] })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-orange-50 to-orange-100/50 p-6 rounded-xl border border-orange-200 shadow-sm", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("h3", { className: "text-lg font-bold text-orange-800 flex items-center gap-2 mb-2", children: [_jsx(Icon, { icon: "fa-solid fa-bell-concierge" }), "\u7ACB\u5373\u68C0\u67E5\u901A\u77E5"] }), _jsx("p", { className: "text-sm text-orange-600", children: "\u624B\u52A8\u89E6\u53D1\u8BA2\u9605\u5230\u671F\u68C0\u67E5\u5E76\u53D1\u9001\u901A\u77E5\uFF08\u7528\u4E8E\u6D4B\u8BD5\uFF09" })] }), _jsxs("button", { onClick: async () => {
                                                                console.log('[前端] 点击了检查按钮');
                                                                if (!isAuthenticated) {
                                                                    showAlert('需要登录', '请先登录后再执行此操作！', 'error');
                                                                    return;
                                                                }
                                                                console.log('[前端] 准备发送请求...');
                                                                try {
                                                                    const token = localStorage.getItem('auth_token');
                                                                    console.log('[前端] Token:', token ? '存在' : '不存在');
                                                                    const requestBody = { force: true };
                                                                    console.log('[前端] 请求Body:', requestBody);
                                                                    const response = await fetch(`${API_BASE}/subscriptions/check-expiry`, {
                                                                        method: 'POST',
                                                                        headers: {
                                                                            'Content-Type': 'application/json',
                                                                            'Authorization': `Bearer ${token}`
                                                                        },
                                                                        body: JSON.stringify(requestBody)
                                                                    });
                                                                    console.log('[前端] 收到响应:', response.status);
                                                                    const result = await response.json();
                                                                    console.log('[前端] 响应结果:', result);
                                                                    if (result.success) {
                                                                        showAlert('检查完成', result.message, 'success');
                                                                    }
                                                                    else {
                                                                        showAlert('检查失败', result.message, 'error');
                                                                    }
                                                                }
                                                                catch (error) {
                                                                    console.error('[前端] 请求失败:', error);
                                                                    showAlert('检查失败', error instanceof Error ? error.message : '未知错误', 'error');
                                                                }
                                                            }, disabled: !isAuthenticated, className: "w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium", children: [_jsx(Icon, { icon: "fa-solid fa-rocket" }), "\u7ACB\u5373\u68C0\u67E5\u5E76\u53D1\u9001\u901A\u77E5"] }), _jsx("p", { className: "text-xs text-orange-600 mt-3 text-center", children: "\uD83D\uDD14 \u5C06\u7ACB\u5373\u68C0\u67E5\u6240\u6709\u9700\u8981\u63D0\u9192\u7684\u8BA2\u9605\u5E76\u53D1\u9001\u901A\u77E5" })] })] }))] })] })] }), confirmDialog && (_jsx(ConfirmDialog, { isOpen: confirmDialog.isOpen, title: confirmDialog.title, message: confirmDialog.message, onConfirm: confirmDialog.onConfirm, onCancel: hideConfirm })), alertDialog && (_jsx(AlertDialog, { isOpen: alertDialog.isOpen, title: alertDialog.title, message: alertDialog.message, onClose: hideAlert }))] }) }));
};
