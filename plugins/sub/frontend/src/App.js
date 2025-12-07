import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
// Layout & Views
import { SubLayout } from './components/layout/SubLayout';
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
    // Theme Styles
    const themeStyles = `
        :root {
            --theme-primary: #f1404b;
            --theme-bg: #f8f9fa;
            --theme-text: #444444;
        }
    `;
    if (!isLoaded || loading || remindersLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50", children: _jsx("div", { className: "w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "h-screen flex flex-col overflow-hidden bg-gray-50 text-gray-900 font-sans", children: [_jsx("style", { children: themeStyles }), _jsx(ReminderToast, { reminders: reminders }), _jsx("div", { className: "flex-1 min-h-0 relative", children: _jsxs(SubLayout, { activeView: activeView, onViewChange: setActiveView, isAuthenticated: isAuthenticated, onShowLogin: () => { }, mobileOpen: mobileOpen, onMobileClose: () => setMobileOpen(false), children: [activeView === 'dashboard' && (_jsx(Dashboard, { subscriptions: subscriptions, reminders: customReminders, onNavigate: (view) => setActiveView(view), onAdd: handleAdd, onEditReminder: handleEditReminder, onDeleteReminder: handleDeleteReminder, settings: settings })), activeView === 'list' && (_jsx(SubscriptionList, { subscriptions: subscriptions, onEdit: handleEdit, onDelete: handleDelete, onAdd: handleAdd, settings: settings })), activeView === 'calendar' && (_jsx(CalendarView, { subscriptions: subscriptions, settings: settings })), activeView === 'reminders' && (_jsx(ReminderList, { reminders: customReminders, onEdit: handleEditReminder, onDelete: handleDeleteReminder, onAdd: handleAddReminder })), activeView === 'settings' && (_jsx(SettingsPanel, { onClose: () => setActiveView('dashboard'), subscriptions: subscriptions, settings: settings, onUpdateSettings: handleUpdateSettings, isAuthenticated: isAuthenticated }))] }) }), _jsx(Modal, { isOpen: showModal, onClose: () => setShowModal(false), maxWidth: "2xl", children: _jsx(SubscriptionForm, { subscription: editingSubscription, onSave: handleSave, onCancel: () => setShowModal(false), settings: settings, onUpdateSettings: handleUpdateSettings }) }), _jsx(Modal, { isOpen: showReminderModal, onClose: () => setShowReminderModal(false), maxWidth: "lg", children: _jsx(ReminderForm, { reminder: editingReminder, onSave: handleSaveReminder, onCancel: () => setShowReminderModal(false) }) }), confirmDialog && (_jsx(ConfirmDialog, { isOpen: confirmDialog.isOpen, title: confirmDialog.title, message: confirmDialog.message, onConfirm: confirmDialog.onConfirm, onCancel: hideConfirm }))] }));
}
export default SubApp;
