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

    // 主题管理
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('sub_theme') as 'light' | 'dark') || 'light';
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


    // 发送空 Sidebar 配置到主应用（使用插件内部侧边栏）
    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

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
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }



    return (
        <>
            <ReminderToast reminders={reminders} />

            <div className="flex h-screen bg-transparent overflow-hidden">
                {/* 桌面端侧边栏 */}
                <div className="hidden lg:flex w-56 flex-shrink-0 border-r border-gray-200 bg-white">
                    <div className="flex flex-col w-full">
                        {/* 侧边栏标题 */}
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-primary)] to-purple-600">
                                通知管理
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">订阅与事项提醒</p>
                        </div>
                        {/* 菜单项 */}
                        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                            {[
                                { id: 'dashboard', label: '仪表盘', icon: 'fa-solid fa-chart-pie' },
                                { id: 'list', label: '订阅列表', icon: 'fa-solid fa-list' },
                                { id: 'calendar', label: '日历视图', icon: 'fa-solid fa-calendar-alt' },
                                { id: 'reminders', label: '提醒列表', icon: 'fa-solid fa-bell' },
                                { id: 'settings', label: '设置', icon: 'fa-solid fa-cog' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveView(item.id as typeof activeView)}
                                    className={`
                                        w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                        ${activeView === item.id
                                            ? 'bg-[var(--theme-primary)] text-white shadow-md'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    <i className={`${item.icon} w-5 mr-3 ${activeView === item.id ? 'text-white' : 'text-gray-400'}`}></i>
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        {/* 主题切换按钮 - 桌面端 */}
                        <div className="p-3 border-t border-gray-100">
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all"
                            >
                                <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5`}></i>
                                <span>{theme === 'light' ? '黑暗模式' : '明亮模式'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 移动端侧边栏抽屉 */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-[100] lg:hidden">
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setMobileOpen(false)}
                        />
                        <div className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-2xl flex flex-col">
                            {/* 移动端侧边栏标题 */}
                            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
                                <span className="text-lg font-bold text-gray-800">通知管理</span>
                                <button
                                    onClick={() => setMobileOpen(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>
                            {/* 移动端菜单项 */}
                            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                                {[
                                    { id: 'dashboard', label: '仪表盘', icon: 'fa-solid fa-chart-pie' },
                                    { id: 'list', label: '订阅列表', icon: 'fa-solid fa-list' },
                                    { id: 'calendar', label: '日历视图', icon: 'fa-solid fa-calendar-alt' },
                                    { id: 'reminders', label: '提醒列表', icon: 'fa-solid fa-bell' },
                                    { id: 'settings', label: '设置', icon: 'fa-solid fa-cog' },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveView(item.id as typeof activeView);
                                            setMobileOpen(false);
                                        }}
                                        className={`
                                            w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                            ${activeView === item.id
                                                ? 'bg-[var(--theme-primary)] text-white shadow-md'
                                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                            }
                                        `}
                                    >
                                        <i className={`${item.icon} w-5 mr-3 ${activeView === item.id ? 'text-white' : 'text-gray-400'}`}></i>
                                        {item.label}
                                    </button>
                                ))}
                            </nav>

                            {/* 主题切换按钮 - 移动端 */}
                            <div className="p-3 border-t border-gray-100">
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all"
                                >
                                    <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} w-5`}></i>
                                    <span>{theme === 'light' ? '黑暗模式' : '明亮模式'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 主内容区域 */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* 移动端顶部栏 */}
                    <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <i className="fa-solid fa-bars text-lg"></i>
                            </button>
                            <h1 className="text-lg font-bold text-gray-800">通知管理</h1>
                        </div>
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
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
                </div>
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
        </>
    );
}

export default SubApp;
