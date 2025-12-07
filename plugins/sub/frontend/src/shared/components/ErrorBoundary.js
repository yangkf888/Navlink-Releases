import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from 'react';
class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                hasError: false,
                error: null,
                retryCount: 0,
            }
        });
        Object.defineProperty(this, "handleRetry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.props.onReset?.();
                this.setState(prevState => ({
                    hasError: false,
                    error: null,
                    retryCount: prevState.retryCount + 1
                }));
            }
        });
    }
    static getDerivedStateFromError(error) {
        // Only update hasError and error, preserve retryCount
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error(`Uncaught error in ErrorBoundary (${this.props.name || 'Global'}):`, error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (_jsxs("div", { className: "p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-800", children: [_jsx("h2", { className: "text-lg font-semibold mb-2", children: "\u51FA\u9519\u4E86" }), _jsxs("p", { className: "text-sm mb-2", children: ["\u7EC4\u4EF6 ", this.props.name ? `(${this.props.name})` : '', " \u53D1\u751F\u9519\u8BEF\u3002"] }), _jsxs("details", { className: "text-xs text-gray-600 cursor-pointer", children: [_jsx("summary", { children: "\u67E5\u770B\u9519\u8BEF\u8BE6\u60C5" }), _jsx("pre", { className: "mt-2 whitespace-pre-wrap", children: this.state.error?.stack || this.state.error?.toString() })] }), _jsx("button", { className: "mt-4 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm transition-colors", onClick: this.handleRetry, children: "\u91CD\u8BD5" })] }));
        }
        return (_jsx(React.Fragment, { children: this.props.children }, this.state.retryCount));
    }
}
export default ErrorBoundary;
