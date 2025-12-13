/**
 * Sub 应用 - 订阅管理系统（插件版本）
 * 功能：跟踪各类订阅服务的到期时间，提供智能提醒
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Subscription } from './types/subscription';
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

import { DEFAULT_SETTINGS, NotificationSettings } from './types/settings';
import { useCustomReminders } from './hooks/useCustomReminders';
import { ReminderForm } from './components/ReminderForm';
import { CustomReminder } from './types/reminder';
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
    const [activeView, setActiveView] = useState<'dashboard' | 'list' | 'calendar' | 'reminders' | 'settings'>(() => {
        return (localStorage.getItem('sub_active_view') as any) || 'dashboard';
    });

    // Settings State
    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [editingReminder, setEditingReminder] = useState<CustomReminder | null>(null);

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
                } else {
                    const saved = localStorage.getItem('sub_notification_settings');
                    if (saved) {
                        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                    }
                }
            } catch (error) {
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
    const handleUpdateSettings = async (newSettings: NotificationSettings) => {
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
        } catch (error) {
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

    const handleEdit = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setShowModal(true);
    };

    const handleSave = async (data: Partial<Subscription>) => {
        try {
            if (editingSubscription) {
                await updateSubscription(editingSubscription.id, data);
            } else {
                await createSubscription(data as Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>);
            }
            setShowModal(false);
            setEditingSubscription(null);
        } catch (error) {
            alert('操作失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleDelete = async (id: string, name: string) => {
        showConfirm('确认删除', `确定要删除订阅「${name}」吗？`, async () => {
            try {
                await deleteSubscription(id);
            } catch (error) {
                alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
            } finally {
                hideConfirm();
            }
        });
    };

    // Reminder handlers
    const handleAddReminder = () => {
        setEditingReminder(null);
        setShowReminderModal(true);
    };

    const handleEditReminder = (reminder: CustomReminder) => {
        setEditingReminder(reminder);
        setShowReminderModal(true);
    };

    const handleSaveReminder = async (data: any) => {
        try {
            if (editingReminder) {
                await updateReminder(editingReminder.id, data);
            } else {
                await createReminder(data);
            }
            setShowReminderModal(false);
            setEditingReminder(null);
        } catch (error) {
            alert('操作失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleDeleteReminder = async (id: string, title: string) => {
        showConfirm('确认删除', `确定要删除提醒「${title}」吗？`, async () => {
            try {
                await deleteReminder(id);
            } catch (error) {
                alert('删除失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
            } finally {
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

    // 使用 postMessage 发送侧边栏配置到主应用
    useEffect(() => {
        // 检查是否在iframe中
        const isInIframe = window.parent !== window;
        console.log('[Sub Plugin] isInIframe:', isInIframe, 'activeView:', activeView);

        if (!isInIframe) return;

        const sidebarConfig = {
            title: '通知中心',
            subtitle: '订阅与事项的到期提醒',
            items: [
                { id: 'dashboard', label: '仪表盘', icon: 'fas fa-home' },
                { id: 'list', label: '订阅列表', icon: 'fas fa-list' },
                { id: 'calendar', label: '日历视图', icon: 'fas fa-calendar' },
                { id: 'reminders', label: '提醒事项', icon: 'fas fa-bell' },
                { id: 'settings', label: '设置', icon: 'fas fa-cog' }
            ],
            activeId: activeView
        };

        console.log('[Sub Plugin] Sending sidebar config:', sidebarConfig);
        window.parent.postMessage({
            type: 'PLUGIN_SET_SIDEBAR',
            payload: sidebarConfig
        }, '*');
    }, [activeView]);

    // 🔑 组件挂载时立即发送一次配置（不等待数据加载）
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        console.log('[Sub Plugin] Component mounted, sending initial config');
        window.parent.postMessage({
            type: 'PLUGIN_SET_SIDEBAR',
            payload: {
                title: '通知中心',
                subtitle: '订阅与事项的到期提醒',
                items: [
                    { id: 'dashboard', label: '仪表盘', icon: 'fas fa-home' },
                    { id: 'list', label: '订阅列表', icon: 'fas fa-list' },
                    { id: 'calendar', label: '日历视图', icon: 'fas fa-calendar' },
                    { id: 'reminders', label: '提醒事项', icon: 'fas fa-bell' },
                    { id: 'settings', label: '设置', icon: 'fas fa-cog' }
                ],
                activeId: 'dashboard'
            }
        }, '*');
    }, []);

    // 监听来自主应用的侧边栏点击事件
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SIDEBAR_ITEM_CLICKED') {
                const itemId = event.data.payload.itemId;
                setActiveView(itemId as any);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!isLoaded || loading || remindersLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }



    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50 text-gray-900 font-sans">
            <style>{themeStyles}</style>

            <ReminderToast reminders={reminders} />



            {/* Main Layout - Content Only */}
            <div className="flex-1 min-h-0 relative p-4 lg:p-6 overflow-y-auto">
                {activeView === 'dashboard' && (
                    <Dashboard
                        subscriptions={subscriptions}
                        reminders={customReminders}
                        onNavigate={(view) => setActiveView(view as any)}
                        onAdd={handleAdd}
                        onEditReminder={handleEditReminder}
                        onDeleteReminder={handleDeleteReminder}
                        settings={settings}
                    />
                )}
                {activeView === 'list' && (
                    <SubscriptionList
                        subscriptions={subscriptions}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onAdd={handleAdd}
                        settings={settings}
                    />
                )}
                {activeView === 'calendar' && (
                    <CalendarView subscriptions={subscriptions} settings={settings} />
                )}
                {activeView === 'reminders' && (
                    <ReminderList
                        reminders={customReminders}
                        onEdit={handleEditReminder}
                        onDelete={handleDeleteReminder}
                        onAdd={handleAddReminder}
                    />
                )}
                {activeView === 'settings' && (
                    <SettingsPanel
                        onClose={() => setActiveView('dashboard')}
                        subscriptions={subscriptions}
                        settings={settings}
                        onUpdateSettings={handleUpdateSettings}
                        isAuthenticated={isAuthenticated}
                    />
                )}

            </div>

            {/* Modals */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} maxWidth="2xl">
                <SubscriptionForm
                    subscription={editingSubscription}
                    onSave={handleSave}
                    onCancel={() => setShowModal(false)}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                />
            </Modal>

            <Modal isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} maxWidth="lg">
                <ReminderForm
                    reminder={editingReminder}
                    timezone={settings.timezone}
                    onSave={handleSaveReminder}
                    onCancel={() => setShowReminderModal(false)}
                />
            </Modal>

            {
                confirmDialog && (
                    <ConfirmDialog
                        isOpen={confirmDialog.isOpen}
                        title={confirmDialog.title}
                        message={confirmDialog.message}
                        onConfirm={confirmDialog.onConfirm}
                        onCancel={hideConfirm}
                    />
                )
            }
        </div >
    );
}

export default SubApp;
