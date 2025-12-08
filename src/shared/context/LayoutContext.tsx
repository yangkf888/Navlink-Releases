import { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
    sidebarContent: ReactNode | null;
    setSidebarContent: (content: ReactNode | null) => void;
    sidebarTitle: string | null;
    setSidebarTitle: (title: string | null) => void;
    collapsed: boolean;
    toggleCollapsed: () => void;
    setCollapsed: (collapsed: boolean) => void;
    // Helper to reset to default
    resetSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);
    const [sidebarTitle, setSidebarTitle] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => setCollapsed(prev => !prev);

    const resetSidebar = () => {
        setSidebarContent(null);
        setSidebarTitle(null);
        // We usually don't reset collapsed state on route change as it's a user preference
    };

    return (
        <LayoutContext.Provider value={{
            sidebarContent,
            setSidebarContent,
            sidebarTitle,
            setSidebarTitle,
            collapsed,
            toggleCollapsed,
            setCollapsed,
            resetSidebar
        }}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
}
