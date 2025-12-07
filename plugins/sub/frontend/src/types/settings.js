export const DEFAULT_SETTINGS = {
    timezone: 'Asia/Shanghai',
    enableNotifications: true,
    categories: ['个人', '家庭', '工作', '娱乐', '工具'],
    notification: {
        timeRange: {
            start: '09:00',
            end: '22:00'
        },
        interval: 6, // 6 hours
        maxCount: 3 // max 3 times
    },
    display: {
        currency: 'CNY',
        currencySymbol: '¥',
        showWidgets: true,
        weekStart: 1, // Monday
        cardColorMode: 'status', // Default to status-based colors
        cardColor: '#3b82f6', // Blue as default fixed color
        statusColors: {
            normal: '#10b981', // green-500
            attention: '#fbbf24', // yellow-400
            warning: '#fb923c', // orange-400
            urgent: '#ef4444', // red-500
            expired: '#6b7280', // gray-500
        },
    },
    defaults: {
        periodValue: 1,
        periodUnit: 'month',
        reminderValue: 3,
        reminderUnit: 'day',
    },
    telegram: {
        enabled: false,
        botToken: '',
        chatId: ''
    },
    notifyx: {
        enabled: false,
        apiKey: '',
        endpoint: ''
    },
    webhook: {
        enabled: false,
        url: '',
        method: 'POST',
        headers: '',
        template: ''
    },
    bark: {
        enabled: false,
        deviceKey: '',
        server: 'https://api.day.app'
    }
};
