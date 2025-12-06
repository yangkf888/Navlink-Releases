import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-[1000] flex items-center justify-center bg-black/50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl p-6 max-w-md mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: title }), _jsx("p", { className: "text-gray-600 mb-6", children: message }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition", children: "\u53D6\u6D88" }), _jsx("button", { onClick: onConfirm, className: "px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition", children: "\u786E\u8BA4" })] })] }) }));
};
