import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
export const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    return (_jsx("div", { className: `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in`, children: message }));
};
