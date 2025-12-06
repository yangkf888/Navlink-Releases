import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Icon } from '../common/Icon';
export default function LoginDialog({ onClose, onLogin }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useConfig();
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(password);
            onLogin();
            onClose();
        }
        catch (err) {
            setError(err.message || 'Login failed');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in", children: _jsxs("div", { className: "bg-white rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-800", children: "\u7BA1\u7406\u5458\u767B\u5F55" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: _jsx(Icon, { icon: "fa-solid fa-xmark", className: "text-xl" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent outline-none transition-all", placeholder: "\u8BF7\u8F93\u5165\u5BC6\u7801", autoFocus: true }), _jsx(Icon, { icon: "fa-solid fa-lock", className: "absolute left-3.5 top-3.5 text-gray-400" })] }), error && _jsx("p", { className: "mt-2 text-sm text-red-500", children: error })] }), _jsxs("div", { className: "flex gap-4 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors", disabled: loading, children: "Cancel" }), _jsxs("button", { type: "submit", disabled: loading, className: "w-full bg-[var(--theme-primary)] text-white py-2.5 rounded-lg font-medium hover:brightness-110 transition-all shadow-lg shadow-red-100 disabled:opacity-70 flex items-center justify-center gap-2", children: [loading && _jsx(Icon, { icon: "fa-solid fa-circle-notch", className: "animate-spin" }), loading ? '登录中...' : '登录'] })] })] })] }) }));
}
