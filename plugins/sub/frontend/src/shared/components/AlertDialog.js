import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const AlertDialog = ({ isOpen, title, message, onClose }) => {
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-[1000] flex items-center justify-center bg-black/50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl p-6 max-w-md mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: title }), _jsx("p", { className: "text-gray-600 mb-6", children: message }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition", children: "\u786E\u5B9A" }) })] }) }));
};
