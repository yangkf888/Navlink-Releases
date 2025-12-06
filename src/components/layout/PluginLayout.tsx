import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useConfig } from '@/shared/context/ConfigContext';
import TopNavbar from '@/shared/components/layout/TopNavbar';
import { AIChatModal } from '../../apps/navlink/components/ai/AIChatModal';
import SearchModal from '../../apps/navlink/components/common/SearchModal';

// Helper to determine if a color is light or dark
const isLightColor = (color?: string) => {
    if (!color) return true; // Default to light background if unknown

    // Quick check for common light/dark keywords
    if (color === 'white' || color === 'transparent') return true;
    if (color === 'black') return false;

    // Handle Hex
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        // Expand shorthand (e.g. "03F") to full form ("0033FF")
        const fullHex = hex.length === 3
            ? hex.split('').map(x => x + x).join('')
            : hex;

        const r = parseInt(fullHex.substring(0, 2), 16);
        const g = parseInt(fullHex.substring(2, 4), 16);
        const b = parseInt(fullHex.substring(4, 6), 16);

        // YIQ brightness formula
        return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    }

    // Default to true (light) for safety
    return true;
};

import Sidebar from '@/shared/components/layout/Sidebar';

const PluginLayout: React.FC = () => {
    const { config, isAuthenticated, logout } = useConfig();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showAIChatModal, setShowAIChatModal] = useState(false);

    const handleUserIconClick = () => {
        if (isAuthenticated) {
            window.location.href = '/admin/dashboard';
        } else {
            window.location.href = '/admin/login';
        }
    };

    // Determine if we should use dark text based on background color
    const bgColor = config.theme?.backgroundColor || '#f1f2f3';
    const useDarkText = isLightColor(bgColor);

    return (
        <div className="min-h-screen bg-[var(--theme-bg)] font-sans text-[var(--theme-text)]">
            {/* Search Modal */}
            {showSearchModal && (
                <SearchModal
                    config={config}
                    isAuthenticated={isAuthenticated}
                    onClose={() => setShowSearchModal(false)}
                    onAIModeClick={() => setShowAIChatModal(true)}
                />
            )}

            <TopNavbar
                config={config}
                toggleSidebar={() => setMobileOpen(!mobileOpen)}
                mobileOpen={mobileOpen}
                onUserClick={handleUserIconClick}
                onLogout={logout}
                isAuthenticated={isAuthenticated}
                onSearchClick={() => setShowSearchModal(true)}
                forceDarkText={useDarkText}
            />

            <div className="pt-20 w-full h-[calc(100vh)] box-border flex relative">
                {/* Sidebar Injection */}
                <Sidebar
                    config={config}
                    activeCategory={""} // Plugins usually don't have home categories
                    onScrollTo={() => { }}
                    mobileOpen={mobileOpen}
                    setMobileOpen={setMobileOpen}
                    isAuthenticated={isAuthenticated}
                />

                {/* Main Content Area */}
                <div className="flex-1 h-full overflow-hidden relative">
                    <Outlet />
                </div>
            </div>

            {/* AI Chat Modal */}
            <AIChatModal isOpen={showAIChatModal} onClose={() => setShowAIChatModal(false)} />
        </div>
    );
};

export default PluginLayout;
