import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from './Icon';
export const AlertDialog = ({ isOpen, title, message, variant = 'info', buttonText = '确定', onClose }) => {
    if (!isOpen)
        return null;
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    const variantConfig = {
        success: {
            bgColor: 'bg-green-100',
            textColor: 'text-green-600',
            icon: 'fa-solid fa-circle-check',
            buttonColor: 'bg-green-500 hover:bg-green-600'
        },
        error: {
            bgColor: 'bg-red-100',
            textColor: 'text-red-600',
            icon: 'fa-solid fa-circle-xmark',
            buttonColor: 'bg-red-500 hover:bg-red-600'
        },
        warning: {
            bgColor: 'bg-orange-100',
            textColor: 'text-orange-600',
            icon: 'fa-solid fa-triangle-exclamation',
            buttonColor: 'bg-orange-500 hover:bg-orange-600'
        },
        info: {
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-600',
            icon: 'fa-solid fa-info-circle',
            buttonColor: 'bg-blue-500 hover:bg-blue-600'
        }
    };
    const config = variantConfig[variant];
    return (_jsxs("div", { className: "fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in", onClick: handleBackdropClick, children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in", children: [_jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.textColor}`, children: _jsx(Icon, { icon: config.icon, className: "text-xl" }) }), _jsx("div", { className: "flex-1", children: _jsx("h3", { className: "text-lg font-bold text-gray-900", children: title }) })] }), _jsx("p", { className: "text-gray-600 mb-6 whitespace-pre-line leading-relaxed pl-13", children: message }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: onClose, className: `px-5 py-2.5 rounded-lg transition-colors font-medium text-white ${config.buttonColor}`, children: buttonText }) })] })] }));
};
