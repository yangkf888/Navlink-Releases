import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 通用Modal弹窗组件
 * 移动端优化：全屏弹窗、滑动进入、触摸友好
 */
import { useEffect } from 'react';
export const Modal = ({ isOpen, onClose, children, maxWidth = 'lg', title }) => {
    // 移动端防止背景滚动
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);
    if (!isOpen)
        return null;
    const maxWidthClasses = {
        'sm': 'max-w-sm',
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl'
    };
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 overflow-hidden", "aria-labelledby": "modal-title", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in", onClick: onClose, "aria-hidden": "true" }), _jsx("div", { className: "fixed inset-0 flex items-end md:items-center justify-center p-0 md:p-4", children: _jsxs("div", { className: `
                        w-full ${maxWidthClasses[maxWidth]}
                        bg-white 
                        rounded-t-3xl md:rounded-2xl
                        shadow-2xl
                        transform transition-all
                        animate-slide-up md:animate-fade-in
                        max-h-[95vh] md:max-h-[90vh]
                        flex flex-col
                        overflow-hidden
                    `, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "md:hidden flex justify-center py-2 bg-gray-50", children: _jsx("div", { className: "w-12 h-1.5 bg-gray-300 rounded-full" }) }), _jsx("div", { className: "flex-1 overflow-y-auto custom-scrollbar", children: _jsx("div", { className: "p-4 sm:p-6", children: children }) })] }) })] }));
};
