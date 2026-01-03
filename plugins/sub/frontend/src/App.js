import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Sub 应用 - 订阅管理系统（插件版本）
 * 功能：跟踪各类订阅服务的到期时间，提供智能提醒
 */
import { useState, useEffect, useMemo } from 'react';
import { SubscriptionForm } from './components/SubscriptionForm';
import { Modal } from './components/Modal';
import { ReminderToast } from './components/ReminderToast';
import { SettingsPanel } from './components/SettingsPanel';
import { checkReminders } from './utils/reminderUtils';
import { useSubscriptions } from './hooks/useSubscriptions';
import { Dashboard } from './components/views/Dashboard';
import { SubscriptionList } from './components/views/SubscriptionList';
import { CalendarView } from './components/views/CalendarView';
import { ReminderList } from './components/views/ReminderList';
import { DEFAULT_SETTINGS } from './types/settings';
import { useCustomReminders } from './hooks/useCustomReminders';
import { ReminderForm } from './components/ReminderForm';
import { useDialogs } from './shared/hooks/useDialogs';
import { ConfirmDialog } from './shared/components/ConfirmDialog';
// API基础路径
const API_BASE = '/api/plugins/sub/api';
// 不再需要从URL获取token，直接使用主应用的认证状态
function SubApp() {
    // App state - simplified without ConfigContext
    const [isLoaded, setIsLoaded] = useState(false);
    const [isAuthenticated] = useState(true); // Plugin assumes main app handles auth
    const { subscriptions, loading, loadSubscriptions, createSubscription, updateSubscription, deleteSubscription } = useSubscriptions();
    const { reminders: customReminders, loading: remindersLoading, createReminder, updateReminder, deleteReminder } = useCustomReminders();
    const { confirmDialog, showConfirm, hideConfirm } = useDialogs();
    // View State
    const [activeView, setActiveView] = useState(() => {
        return localStorage.getItem('sub_active_view') || 'dashboard';
    });
    // 主题管理
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('sub_theme') || 'light';
    });
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sub_theme', theme);
        // 同步主题到主应用
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'PLUGIN_THEME_CHANGED',
                payload: { theme }
            }, '*');
        }
    }, [theme]);
    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };
    // Settings State
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState(null);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [editingReminder, setEditingReminder] = useState(null);
    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${API_BASE}/subscriptions/settings/notifications`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (response.ok) {
                    const serverSettings = await response.json();
                    const merged = {
                        ...DEFAULT_SETTINGS,
                        ...serverSettings,
                        display: { ...DEFAULT_SETTINGS.display, ...serverSettings.display },
                        defaults: { ...DEFAULT_SETTINGS.defaults, ...serverSettings.defaults }
                    };
                    setSettings(merged);
                    localStorage.setItem('sub_notification_settings', JSON.stringify(merged));
                }
                else {
                    const saved = localStorage.getItem('sub_notification_settings');
                    if (saved) {
                        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                    }
                }
            }
            catch (error) {
                console.error('[设置] 加载失败:', error);
            }
            setIsLoaded(true);
        };
        loadSettings();
    }, []);
    // Persist view state
    useEffect(() => {
        if (activeView !== 'settings') {
            localStorage.setItem('sub_active_view', activeView);
        }
    }, [activeView]);
    // Persist settings
    const handleUpdateSettings = async (newSettings) => {
        setSettings(newSettings);
        localStorage.setItem('sub_notification_settings', JSON.stringify(newSettings));
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE}/subscriptions/settings/notifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(newSettings)
            });
            if (!response.ok) {
                console.error('[设置] 保存失败: HTTP', response.status);
                throw new Error(`HTTP ${response.status}`);
            }
            console.log('[设置] 保存成功');
        }
        catch (error) {
            console.error('[设置] 保存失败:', error);
            alert('设置保存失败，请检查网络连接');
        }
    };
    // Calculate reminders
    const reminders = useMemo(() => {
        return checkReminders(subscriptions);
    }, [subscriptions]);
    // Subscription handlers
    const handleAdd = () => {
        setEditingSubscription(null);
        setShowModal(true);
    };
    const handleEdit = (subscription) => {
        setEditingSubscription(subscription);
        setShowModal(true);
    };
    const handleSave = async (data) => {
        try {
            if (editingSubscription) {
                await updateSubscription(editingSubscription.id, data);
            }
            else {
                await createSubscription(data);
            }
            setShowModal(false);
            setEditingSubscription(null);
        }
        catch (error) {
            alert('操作失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };
    const handleDelete = async (id, name) => {
        showConfirm('确认删除', `确定要删除订阅「${name}」吗？`, async () => {
            try {
                await deleteSubscription(id);
            }
            catch (error) {
                alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
            finally {
                hideConfirm();
            }
        });
    };
    // Reminder handlers
    const handleAddReminder = () => {
        setEditingReminder(null);
        setShowReminderModal(true);
    };
    const handleEditReminder = (reminder) => {
        setEditingReminder(reminder);
        setShowReminderModal(true);
    };
    const handleSaveReminder = async (data) => {
        try {
            if (editingReminder) {
                await updateReminder(editingReminder.id, data);
            }
            else {
                await createReminder(data);
            }
            setShowReminderModal(false);
            setEditingReminder(null);
        }
        catch (error) {
            alert('操作失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };
    const handleDeleteReminder = async (id, title) => {
        showConfirm('确认删除', `确定要删除提醒「${title}」吗？`, async () => {
            try {
                await deleteReminder(id);
            }
            catch (error) {
                alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
            finally {
                hideConfirm();
            }
        });
    };
    // 发送空 Sidebar 配置到主应用（使用插件内部侧边栏）
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe)
            return;
        let count = 0;
        const maxAttempts = 5;
        const sendMessage = () => {
            // 发送空侧边栏配置
            window.parent.postMessage({
                type: 'PLUGIN_SET_SIDEBAR',
                payload: {
                    title: '通知中心',
                    subtitle: '订阅与事项的到期提醒',
                    items: [],
                    activeId: ''
                }
            }, '*');
            // 请求隐藏 Header（默认仅移动端隐藏，桌面端保持显示）
            window.parent.postMessage({
                type: 'PLUGIN_REQUEST_HIDE_HEADER',
                payload: { hideHeader: false }
            }, '*');
            count++;
            if (count < maxAttempts) {
                setTimeout(sendMessage, 500);
            }
        };
        sendMessage();
    }, []);
    if (!isLoaded || loading || remindersLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50", children: _jsx("div", { className: "w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(ReminderToast, { reminders: reminders }), _jsxs("div", { className: "flex h-screen bg-transparent overflow-hidden", children: [_jsx("div", { className: "hidden lg:flex w-56 flex-shrink-0 border-r border-gray-200 bg-white", children: _jsxs("div", { className: "flex flex-col w-full", children: [_jsxs("div", { className: "p-4 border-b border-gray-100", children: [_jsx("h2", { className: "text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-primary)] to-purple-600", children: "\u901A\u77E5\u7BA1\u7406" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "\u8BA2\u9605\u4E0E\u4E8B\u9879\u63D0\u9192" })] }), _jsx("nav", { className: "flex-1 p-2 space-y-1 overflow-y-auto", children: [
                                        { id: 'dashboard', label: '仪表盘', icon: 'fa-solid fa-chart-pie' },
                                        { id: 'list', label: '订阅列表', icon: 'fa-solid fa-list' },
                                        { id: 'calendar', label: '日历视图', icon: 'fa-solid fa-calendar-alt' },
                                        { id: 'reminders', label: '提醒列表', icon: 'fa-solid fa-bell' },
                                        { id: 'settings', label: '设置', icon: 'fa-solid fa-cog' },
                                    ].map((item) => (_jsxs("button", { onClick: () => setActiveView(item.id), className: `
                                        w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                        ${activeView === item.id
                                            ? 'bg-[var(--theme-primary)] text-white shadow-md'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                                    `, children: [_jsx("i", { className: `${item.icon} w-5 mr-3 ${activeView === item.id ? 'text-white' : 'text-gray-400'}` }), item.label] }, item.id))) }), _jsx("div", { className: "p-3 border-t border-gray-100", children: _jsxs("button", { onClick: toggleTheme, className: "w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all", children: [_jsx("i", { className: `fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5` }), _jsx("span", { children: theme === 'light' ? '黑暗模式' : '明亮模式' })] }) })] }) }), mobileOpen && (_jsxs("div", { className: "fixed inset-0 z-[100] lg:hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black/50 backdrop-blur-sm", onClick: () => setMobileOpen(false) }), _jsxs("div", { className: "absolute left-0 top-0 bottom-0 w-60 bg-white shadow-2xl flex flex-col", children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-gray-100", children: [_jsx("span", { className: "text-lg font-bold text-gray-800", children: "\u901A\u77E5\u7BA1\u7406" }), _jsx("button", { onClick: () => setMobileOpen(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("i", { className: "fa-solid fa-times" }) })] }), _jsx("nav", { className: "flex-1 p-2 space-y-1 overflow-y-auto", children: [
                                            { id: 'dashboard', label: '仪表盘', icon: 'fa-solid fa-chart-pie' },
                                            { id: 'list', label: '订阅列表', icon: 'fa-solid fa-list' },
                                            { id: 'calendar', label: '日历视图', icon: 'fa-solid fa-calendar-alt' },
                                            { id: 'reminders', label: '提醒列表', icon: 'fa-solid fa-bell' },
                                            { id: 'settings', label: '设置', icon: 'fa-solid fa-cog' },
                                        ].map((item) => (_jsxs("button", { onClick: () => {
                                                setActiveView(item.id);
                                                setMobileOpen(false);
                                            }, className: `
                                            w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                            ${activeView === item.id
                                                ? 'bg-[var(--theme-primary)] text-white shadow-md'
                                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                                        `, children: [_jsx("i", { className: `${item.icon} w-5 mr-3 ${activeView === item.id ? 'text-white' : 'text-gray-400'}` }), item.label] }, item.id))) }), _jsx("div", { className: "p-3 border-t border-gray-100", children: _jsxs("button", { onClick: toggleTheme, className: "w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all", children: [_jsx("i", { className: `fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5` }), _jsx("span", { children: theme === 'light' ? '黑暗模式' : '明亮模式' })] }) })] })] })), _jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsx("div", { className: "lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setMobileOpen(true), className: "p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors", children: _jsx("i", { className: "fa-solid fa-bars text-lg" }) }), _jsx("h1", { className: "text-lg font-bold text-gray-800", children: "\u901A\u77E5\u7BA1\u7406" })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 lg:p-6", children: [activeView === 'dashboard' && (_jsx(Dashboard, { subscriptions: subscriptions, reminders: customReminders, onNavigate: (view) => setActiveView(view), onAdd: handleAdd, onEditReminder: handleEditReminder, onDeleteReminder: handleDeleteReminder, settings: settings })), activeView === 'list' && (_jsx(SubscriptionList, { subscriptions: subscriptions, onEdit: handleEdit, onDelete: handleDelete, onAdd: handleAdd, settings: settings })), activeView === 'calendar' && (_jsx(CalendarView, { subscriptions: subscriptions, settings: settings })), activeView === 'reminders' && (_jsx(ReminderList, { reminders: customReminders, onEdit: handleEditReminder, onDelete: handleDeleteReminder, onAdd: handleAddReminder })), activeView === 'settings' && (_jsx(SettingsPanel, { onClose: () => setActiveView('dashboard'), subscriptions: subscriptions, settings: settings, onUpdateSettings: handleUpdateSettings, isAuthenticated: isAuthenticated }))] })] })] }), _jsx(Modal, { isOpen: showModal, onClose: () => setShowModal(false), maxWidth: "2xl", children: _jsx(SubscriptionForm, { subscription: editingSubscription, onSave: handleSave, onCancel: () => setShowModal(false), settings: settings, onUpdateSettings: handleUpdateSettings }) }), _jsx(Modal, { isOpen: showReminderModal, onClose: () => setShowReminderModal(false), maxWidth: "lg", children: _jsx(ReminderForm, { reminder: editingReminder, timezone: settings.timezone, onSave: handleSaveReminder, onCancel: () => setShowReminderModal(false) }) }), confirmDialog && (_jsx(ConfirmDialog, { isOpen: confirmDialog.isOpen, title: confirmDialog.title, message: confirmDialog.message, onConfirm: confirmDialog.onConfirm, onCancel: hideConfirm }))] }));
}
export default SubApp;
