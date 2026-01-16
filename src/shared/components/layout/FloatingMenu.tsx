import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TopNavItem } from '../../types';
import { Icon } from '../common/Icon';
import { getContrastColor } from '../../utils/color';
import { useConfig } from '../../context/ConfigContext';

interface FloatingMenuProps {
    items: TopNavItem[];
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ items }) => {
    const { config } = useConfig();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted || !items || items.length === 0) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Menu Items */}
            <div className={`fixed bottom-24 right-6 z-[95] flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                {items.map((item, index) => (
                    <a
                        key={item.id}
                        href={item.url}
                        className="flex items-center gap-3 bg-white text-gray-800 px-5 py-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-95 transition-all transform"
                        style={{
                            transitionDelay: `${isOpen ? (items.length - 1 - index) * 50 : 0}ms`
                        }}
                        onClick={() => setIsOpen(false)}
                    >
                        <span className="font-medium text-sm">{item.title}</span>
                        <div className="w-8 h-8 rounded-full bg-[var(--theme-primary)]/10 flex items-center justify-center"
                            style={{ color: getContrastColor(config.theme?.primaryColor || '#f1404b') === '#000000' ? 'var(--theme-primary)' : 'var(--theme-primary)' }}
                        >
                            <Icon icon={item.icon} />
                        </div>
                    </a>
                ))}
            </div>

            {/* Main FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-xl transition-all duration-300 transform hover:scale-105 active:scale-95
                    ${isOpen ? 'bg-gray-800 rotate-45 text-white' : 'bg-[var(--theme-primary)]'}
                `}
                style={{
                    color: !isOpen ? getContrastColor(config.theme?.primaryColor || '#f1404b') : undefined
                }}
            >
                <Icon icon="fa-solid fa-plus" />
            </button>
        </>,
        document.body
    );
};
