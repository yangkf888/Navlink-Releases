import React from 'react';
import { Icon } from '@/shared/components/common/Icon';
import { useLayout } from '@/shared/context/LayoutContext';
import type { DockerView } from './Sidebar';

interface DockerSidebarProps {
    activeView: DockerView;
    onViewChange: (view: DockerView) => void;
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    collapsed: boolean;
    toggleCollapsed: () => void;
}

const menuItems: { id: DockerView | 'overview'; label: string; icon: string }[] = [
    { id: 'overview', label: '总览', icon: 'fa-solid fa-globe' },
    { id: 'dashboard', label: '概览', icon: 'fa-solid fa-dashboard' },
    { id: 'containers', label: '容器', icon: 'fa-solid fa-box' },
    { id: 'images', label: '镜像', icon: 'fa-solid fa-layer-group' },
    { id: 'networks', label: '网络', icon: 'fa-solid fa-network-wired' },
    { id: 'volumes', label: '卷', icon: 'fa-solid fa-database' },
    { id: 'servers', label: '服务器', icon: 'fa-solid fa-server' }
];

const DockerSidebar: React.FC<DockerSidebarProps> = ({
    activeView,
    onViewChange,
    mobileOpen,
    setMobileOpen
}) => {
    const { collapsed, toggleCollapsed } = useLayout();
    // We only need to render the content (menu items) logic.
    // The container (sticky/fixed positioning, scrollbars, mobile drawer) is handled by the parent Sidebar component.

    return (
        <div className="space-y-1 py-2">
            <nav className="space-y-1">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onViewChange(item.id);
                            // We don't need to handle mobileOpen here as the parent Sidebar handles the drawer closing
                            // when we might want to close it? Actually parent Sidebar doesn't know when we click.
                            // But usually sidebar links close the sidebar on mobile.
                            // We can use a global event or context, but for now let's just change view.
                            if (window.innerWidth < 1024 && setMobileOpen) {
                                setMobileOpen(false);
                            }
                        }}
                        className={`
                  w-full flex items-center px-4 py-3 text-[14px] font-medium rounded-lg transition-all duration-200 group
                  ${activeView === item.id
                                ? 'text-white bg-[var(--theme-primary)] shadow-md shadow-red-200'
                                : 'text-gray-600 hover:bg-white hover:text-[var(--theme-primary)] hover:shadow-sm'
                            }
                  ${collapsed ? 'justify-center px-0' : ''}
              `}
                        title={collapsed ? item.label : ''}
                    >
                        <div className={`${collapsed ? 'text-lg w-auto mr-0' : 'w-6 text-center mr-2'} ${activeView === item.id ? 'text-white' : 'text-gray-400 group-hover:text-[var(--theme-primary)]'} flex items-center justify-center`}>
                            <Icon icon={item.icon} />
                        </div>
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && <div className="ml-auto opacity-0 group-hover:opacity-50 text-xs"><Icon icon="fa-solid fa-angle-right" /></div>}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default DockerSidebar;
