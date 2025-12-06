import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from './Icon';
export const ConfirmDialog = ({ isOpen, title, message, confirmText = '确定', cancelText = '取消', confirmVariant = 'danger', onConfirm, onCancel }) => {
    if (!isOpen)
        return null;
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };
    return (_jsxs("div", { className: "fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in", onClick: handleBackdropClick, children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in", children: [_jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${confirmVariant === 'danger'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-blue-100 text-blue-600'}`, children: _jsx(Icon, { icon: confirmVariant === 'danger' ? 'fa-solid fa-exclamation-triangle' : 'fa-solid fa-info-circle', className: "text-xl" }) }), _jsx("div", { className: "flex-1", children: _jsx("h3", { className: "text-lg font-bold text-gray-900", children: title }) })] }), _jsx("p", { className: "text-gray-600 mb-6 whitespace-pre-line leading-relaxed pl-13", children: message }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { onClick: onCancel, className: "px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium", children: cancelText }), _jsx("button", { onClick: onConfirm, className: `px-5 py-2.5 rounded-lg transition-colors font-medium text-white ${confirmVariant === 'danger'
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-blue-500 hover:bg-blue-600'}`, children: confirmText })] })] })] }));
};
