import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Icon } from '../../shared/components/Icon';
import { calculateDaysRemaining, getLocalDateString } from '../../utils/dateUtils';
import { useCustomReminders } from '../../hooks/useCustomReminders';
import { ReminderForm } from '../ReminderForm';
import { Modal } from '../Modal';
import { useDialogs } from '../../shared/hooks/useDialogs';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
export const CalendarView = ({ subscriptions, settings }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { reminders, createReminder, updateReminder, deleteReminder } = useCustomReminders();
    const { confirmDialog, showConfirm, hideConfirm } = useDialogs();
    // 自定义提醒状态
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [editingReminder, setEditingReminder] = useState(undefined);
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };
    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };
    // Map subscriptions to dates in the current month
    const subsByDate = useMemo(() => {
        const map = {};
        subscriptions.forEach(sub => {
            const expiry = new Date(sub.expiryDate);
            // Check if expiry is in current displayed month/year
            if (expiry.getMonth() === currentDate.getMonth() && expiry.getFullYear() === currentDate.getFullYear()) {
                const day = expiry.getDate();
                if (!map[day])
                    map[day] = [];
                map[day].push(sub);
            }
            // Handle recurring subscriptions logic could be complex here, 
            // for now we stick to the explicit expiryDate as per current simple logic
        });
        return map;
    }, [subscriptions, currentDate]);
    // Map custom reminders to dates in the current month
    const remindersByDate = useMemo(() => {
        const map = {};
        reminders.forEach(reminder => {
            const reminderDateObj = new Date(reminder.reminderDate);
            if (reminderDateObj.getMonth() === currentDate.getMonth() &&
                reminderDateObj.getFullYear() === currentDate.getFullYear()) {
                const day = reminderDateObj.getDate();
                if (!map[day])
                    map[day] = [];
                map[day].push(reminder);
            }
        });
        return map;
    }, [reminders, currentDate]);
    const [selectedSub, setSelectedSub] = useState(null);
    const [selectedReminder, setSelectedReminder] = useState(null);
    // 处理添加提醒
    const handleAddReminder = (dateStr) => {
        setSelectedDate(dateStr);
        setEditingReminder(undefined);
        setShowReminderModal(true);
    };
    // 保存提醒
    const handleSaveReminder = async (data) => {
        if (editingReminder) {
            await updateReminder(editingReminder.id, data);
        }
        else {
            await createReminder(data);
        }
        setShowReminderModal(false);
        setSelectedDate('');
        setEditingReminder(undefined);
    };
    // 删除提醒
    const handleDeleteReminder = async (id) => {
        showConfirm('确认删除', '确定要删除这个提醒吗？', async () => {
            hideConfirm();
            await deleteReminder(id);
            setSelectedReminder(null);
        });
    };
    const renderCalendarDays = () => {
        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(_jsx("div", { className: "h-32 bg-gray-50/50 border border-gray-100/50" }, `empty-${i}`));
        }
        // Days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const subs = subsByDate[day] || [];
            const dayReminders = remindersByDate[day] || [];
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isToday = new Date().toDateString() === dateObj.toDateString();
            const isFuture = dateObj >= new Date(new Date().setHours(0, 0, 0, 0));
            const dateStr = getLocalDateString(dateObj, settings.timezone);
            days.push(_jsxs("div", { className: `h-32 border border-gray-100 p-2 relative group transition-colors hover:bg-gray-50 ${isToday ? 'bg-blue-50/30' : 'bg-white'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsxs("div", { className: `text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`, children: [day, isToday && _jsx("span", { className: "ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full", children: "\u4ECA\u5929" })] }), isFuture && (_jsx("button", { onClick: () => handleAddReminder(dateStr), className: "opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 text-xs", title: "\u6DFB\u52A0\u63D0\u9192", children: _jsx(Icon, { icon: "fa-solid fa-plus-circle" }) }))] }), _jsxs("div", { className: "space-y-1 overflow-y-auto max-h-[calc(100%-24px)] custom-scrollbar", children: [subs.map(sub => (_jsxs("div", { onClick: () => setSelectedSub(sub), className: "flex items-center gap-1.5 p-1.5 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer", children: [_jsx("div", { className: "w-1 h-6 rounded-full bg-[var(--theme-primary)]" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-medium text-gray-800 truncate", children: sub.name }), _jsxs("p", { className: "text-[10px] text-gray-500", children: ["\u00A5", sub.price] })] })] }, sub.id))), dayReminders.map(reminder => (_jsxs("div", { onClick: () => setSelectedReminder(reminder), className: "flex items-center gap-1.5 p-1.5 rounded-lg bg-purple-50 border border-purple-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer", children: [_jsx("div", { className: "w-1 h-6 rounded-full bg-purple-500" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-medium text-gray-800 truncate", children: reminder.title }), _jsx("p", { className: "text-[10px] text-purple-600", children: reminder.reminderTime })] })] }, reminder.id)))] })] }, day));
        }
        return days;
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative", children: [_jsxs("div", { className: "p-6 border-b border-gray-100 flex justify-between items-center", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-800 flex items-center gap-2", children: [_jsx(Icon, { icon: "fa-solid fa-calendar-alt", className: "text-[var(--theme-primary)]" }), currentDate.getFullYear(), "\u5E74 ", monthNames[currentDate.getMonth()]] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handlePrevMonth, className: "p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors", children: _jsx(Icon, { icon: "fa-solid fa-chevron-left" }) }), _jsx("button", { onClick: () => setCurrentDate(new Date()), className: "px-3 py-1.5 text-sm font-medium hover:bg-gray-100 rounded-lg text-gray-600 transition-colors", children: "\u4ECA\u5929" }), _jsx("button", { onClick: handleNextMonth, className: "p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors", children: _jsx(Icon, { icon: "fa-solid fa-chevron-right" }) })] })] }), _jsx("div", { className: "grid grid-cols-7 bg-gray-50 border-b border-gray-100", children: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(day => (_jsx("div", { className: "py-3 text-center text-sm font-medium text-gray-500", children: day }, day))) }), _jsx("div", { className: "grid grid-cols-7", children: renderCalendarDays() }), selectedSub && (_jsx("div", { className: "absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4", onClick: () => setSelectedSub(null), children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-in", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl", children: selectedSub.icon ? _jsx("img", { src: selectedSub.icon, className: "w-8 h-8 object-contain" }) : _jsx(Icon, { icon: "fa-solid fa-cube", className: "text-gray-400" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg text-gray-900", children: selectedSub.name }), _jsx("p", { className: "text-sm text-gray-500", children: selectedSub.category })] })] }), _jsx("button", { onClick: () => setSelectedSub(null), className: "text-gray-400 hover:text-gray-600", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] }), _jsxs("div", { className: "space-y-3 mb-6", children: [_jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u4EF7\u683C" }), _jsxs("span", { className: "font-medium text-gray-900", children: ["\u00A5", selectedSub.price] })] }), _jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u5230\u671F\u65E5" }), _jsx("span", { className: "font-medium text-gray-900", children: selectedSub.expiryDate })] }), _jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u5269\u4F59\u5929\u6570" }), _jsxs("span", { className: "font-medium text-[var(--theme-primary)]", children: [calculateDaysRemaining(selectedSub.expiryDate), " \u5929"] })] }), selectedSub.notes && (_jsxs("div", { className: "py-2", children: [_jsx("span", { className: "text-gray-500 text-sm block mb-1", children: "\u5907\u6CE8" }), _jsx("p", { className: "text-sm text-gray-700 bg-gray-50 p-2 rounded-lg", children: selectedSub.notes })] }))] }), _jsx("button", { onClick: () => setSelectedSub(null), className: "w-full py-2.5 bg-[var(--theme-primary)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity", children: "\u5173\u95ED" })] }) })), selectedReminder && (_jsx("div", { className: "absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4", onClick: () => setSelectedReminder(null), children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-in", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center", children: _jsx(Icon, { icon: "fa-solid fa-bell", className: "text-purple-600 text-xl" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg text-gray-900", children: selectedReminder.title }), _jsx("p", { className: "text-sm text-gray-500", children: "\u81EA\u5B9A\u4E49\u63D0\u9192" })] })] }), _jsx("button", { onClick: () => setSelectedReminder(null), className: "text-gray-400 hover:text-gray-600", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] }), _jsxs("div", { className: "space-y-3 mb-6", children: [_jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u63D0\u9192\u65E5\u671F" }), _jsx("span", { className: "font-medium text-gray-900", children: selectedReminder.reminderDate })] }), _jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u63D0\u9192\u65F6\u95F4" }), _jsx("span", { className: "font-medium text-gray-900", children: selectedReminder.reminderTime })] }), _jsxs("div", { className: "flex justify-between py-2 border-b border-gray-50", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\u72B6\u6001" }), _jsx("span", { className: `text-sm font-medium ${selectedReminder.isActive ? 'text-green-600' : 'text-gray-400'}`, children: selectedReminder.isActive ? '已启用' : '已禁用' })] }), selectedReminder.description && (_jsxs("div", { className: "py-2", children: [_jsx("span", { className: "text-gray-500 text-sm block mb-1", children: "\u63CF\u8FF0" }), _jsx("p", { className: "text-sm text-gray-700 bg-gray-50 p-2 rounded-lg", children: selectedReminder.description })] }))] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => {
                                        setEditingReminder(selectedReminder);
                                        setSelectedDate(selectedReminder.reminderDate);
                                        setSelectedReminder(null);
                                        setShowReminderModal(true);
                                    }, className: "flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors", children: "\u7F16\u8F91" }), _jsx("button", { onClick: () => handleDeleteReminder(selectedReminder.id), className: "flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors", children: "\u5220\u9664" })] })] }) })), _jsx(Modal, { isOpen: showReminderModal, onClose: () => setShowReminderModal(false), maxWidth: "md", children: _jsx(ReminderForm, { initialDate: selectedDate, reminder: editingReminder, timezone: settings.timezone, onSave: handleSaveReminder, onCancel: () => setShowReminderModal(false) }) }), confirmDialog && (_jsx(ConfirmDialog, { isOpen: confirmDialog.isOpen, title: confirmDialog.title, message: confirmDialog.message, onConfirm: confirmDialog.onConfirm, onCancel: hideConfirm }))] }));
};
