import { jsx as _jsx } from "react/jsx-runtime";
import { Icon as IconifyIcon } from '@iconify/react';
export const Icon = ({ icon, className = '', style, onClick }) => {
    // Check if the icon string is an Iconify icon (contains a colon, e.g., "mdi:home")
    // or if it explicitly starts with "iconify:" (custom convention if needed, but colon is standard)
    const isIconify = icon.includes(':');
    if (isIconify) {
        return _jsx(IconifyIcon, { icon: icon, className: className, style: style, onClick: onClick });
    }
    // Default to FontAwesome
    return _jsx("i", { onClick: onClick, className: `${icon} ${className}`, style: style });
};
