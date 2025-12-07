import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Icon } from '../../shared/components/Icon';
export const SubLayout = ({ children, activeView, onViewChange, isAuthenticated, onShowLogin, mobileOpen, onMobileClose }) => {
    const [collapsed, setCollapsed] = useState(false);
    const handleViewChange = (view) => {
        // 如果要打开设置且未登录，提示登录
        if (view === 'settings' && !isAuthenticated) {
            alert('⚠️ 请先登录后再访问设置！');
            if (onShowLogin)
                onShowLogin();
            return;
        }
        onViewChange(view);
        // 移动端点击后关闭侧边栏
        if (window.innerWidth < 1024)
            onMobileClose();
    };
    const menuItems = [
        { id: 'dashboard', label: '仪表盘', icon: 'fa-solid fa-chart-pie' },
        { id: 'list', label: '订阅列表', icon: 'fa-solid fa-list' },
        { id: 'calendar', label: '日历视图', icon: 'fa-solid fa-calendar-alt' },
        { id: 'reminders', label: '提醒列表', icon: 'fa-solid fa-bell' },
        { id: 'settings', label: '设置', icon: 'fa-solid fa-cog' },
    ];
    // 桌面端侧边栏宽度
    const widthClass = collapsed ? 'w-[68px]' : 'w-[220px]';
    const SidebarContent = ({ isDesktop = false }) => (_jsxs(_Fragment, { children: [!isDesktop && (_jsxs("div", { className: "h-[60px] flex items-center px-6 border-b border-gray-100 bg-white", children: [_jsx("span", { className: "text-lg font-bold text-gray-800", children: "\u901A\u77E5\u7BA1\u7406" }), _jsx("button", { onClick: onMobileClose, className: "ml-auto text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center", children: _jsx(Icon, { icon: "fa-solid fa-times" }) })] })), isDesktop && !collapsed && (_jsxs("div", { className: "p-6 pt-4", children: [_jsx("h2", { className: "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-primary)] to-purple-600", children: "\u901A\u77E5\u7BA1\u7406" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "\u4E0D\u9057\u6F0F\u4EFB\u4F55\u91CD\u8981\u901A\u77E5" })] })), _jsx("nav", { className: "flex-1 px-2 lg:px-4 space-y-1 lg:space-y-2 py-2 overflow-y-auto custom-scrollbar", children: menuItems.map((item) => (_jsxs("button", { onClick: () => handleViewChange(item.id), className: `
                            w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                            ${activeView === item.id
                        ? 'bg-[var(--theme-primary)] text-white shadow-md shadow-[var(--theme-primary)]/30'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'}
                            ${collapsed && isDesktop ? 'justify-center px-2' : ''}
                        `, title: collapsed && isDesktop ? item.label : '', children: [_jsx(Icon, { icon: item.icon, className: `
                                ${collapsed && isDesktop ? 'text-lg' : 'mr-3'}
                                ${activeView === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
                            ` }), (!collapsed || !isDesktop) && item.label] }, item.id))) }), isDesktop && (_jsx("div", { className: "p-4 border-t border-gray-100", children: _jsx("button", { onClick: () => setCollapsed(!collapsed), className: `
                            w-full flex items-center justify-center px-4 py-2 text-sm text-gray-500 hover:text-[var(--theme-primary)] 
                            hover:bg-gray-50 rounded-lg transition-colors
                            ${collapsed ? '' : 'gap-2'}
                        `, title: collapsed ? '展开' : '收起', children: collapsed ? (_jsx(Icon, { icon: "fa-solid fa-angles-right" })) : (_jsxs(_Fragment, { children: [_jsx(Icon, { icon: "fa-solid fa-angles-left" }), _jsx("span", { children: "\u6536\u8D77" })] })) }) }))] }));
    return (_jsxs("div", { className: "flex h-full overflow-hidden", children: [_jsx("aside", { className: `
                hidden lg:flex flex-col flex-shrink-0
                bg-white/80 backdrop-blur-md border-r border-gray-200/50 shadow-sm z-20 pt-2
                transition-all duration-300 ease-in-out
                ${widthClass}
            `, children: _jsx(SidebarContent, { isDesktop: true }) }), _jsx("aside", { className: `
                fixed inset-y-0 left-0 w-[240px] bg-white z-[70] shadow-2xl 
                transform transition-transform duration-300 ease-in-out
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:hidden flex flex-col
            `, children: _jsx(SidebarContent, { isDesktop: false }) }), mobileOpen && (_jsx("div", { className: "fixed inset-0 bg-black/40 z-[65] lg:hidden backdrop-blur-sm", onClick: onMobileClose })), _jsx("main", { className: "flex-1 overflow-y-auto custom-scrollbar pt-2", children: children })] }));
};
