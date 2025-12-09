/**
 * 自定义提醒数据管理 Hook
 */
import { useState, useEffect } from 'react';
// 使用相对路径,依赖base标签解析
const API_BASE = '/api/plugins/sub/api';
export const useCustomReminders = () => {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // 加载所有自定义提醒
    const loadReminders = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE}/custom-reminders`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!response.ok)
                throw new Error('Failed to load reminders');
            const data = await response.json();
            setReminders(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('Load reminders error:', err);
        }
        finally {
            setLoading(false);
        }
    };
    // 创建提醒
    const createReminder = async (reminder) => {
        try {
            const response = await fetch(`${API_BASE}/custom-reminders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reminder)
            });
            if (!response.ok)
                throw new Error('Failed to create reminder');
            const newReminder = await response.json();
            setReminders(prev => [...prev, newReminder]);
            return newReminder;
        }
        catch (err) {
            console.error('Create reminder error:', err);
            throw err;
        }
    };
    // 更新提醒
    const updateReminder = async (id, updates) => {
        try {
            const response = await fetch(`${API_BASE}/custom-reminders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            if (!response.ok)
                throw new Error('Failed to update reminder');
            const updated = await response.json();
            setReminders(prev => prev.map(r => r.id === id ? updated : r));
            return updated;
        }
        catch (err) {
            console.error('Update reminder error:', err);
            throw err;
        }
    };
    // 删除提醒
    const deleteReminder = async (id) => {
        try {
            const response = await fetch(`${API_BASE}/custom-reminders/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok)
                throw new Error('Failed to delete reminder');
            setReminders(prev => prev.filter(r => r.id !== id));
        }
        catch (err) {
            console.error('Delete reminder error:', err);
            throw err;
        }
    };
    // 初始加载
    useEffect(() => {
        loadReminders();
    }, []);
    return {
        reminders,
        loading,
        error,
        loadReminders,
        createReminder,
        updateReminder,
        deleteReminder
    };
};
