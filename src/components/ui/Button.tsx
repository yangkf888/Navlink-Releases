import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success" | "warning" | "link";
    size?: "xs" | "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
    fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, fullWidth, children, disabled, ...props }, ref) => {

        // Variant Styles
        const variants = {
            // Primary: Use theme color with brightness hover effect
            primary: "bg-[var(--theme-primary,#2563eb)] text-white hover:brightness-110 active:scale-[0.98] shadow-md hover:shadow-lg border border-transparent",
            // Secondary: Subtle gray
            secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-750",
            // Outline: Themed border
            outline: "bg-transparent border border-[var(--theme-primary,#e5e7eb)] text-[var(--theme-primary,#374151)] hover:bg-[var(--theme-primary)] hover:text-white active:bg-[var(--theme-primary)]/90 dark:border-gray-600 dark:text-gray-300",
            // Ghost: Subtle hover
            ghost: "bg-transparent text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 active:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
            // Destructive: Red
            destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm hover:shadow",
            // Success: Green
            success: "bg-green-500 text-white hover:bg-green-600 active:bg-green-700 shadow-sm hover:shadow",
            // Warning: Yellow/Orange
            warning: "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm hover:shadow",
            // Link: Text only
            link: "text-[var(--theme-primary,#2563eb)] underline-offset-4 hover:underline p-0 h-auto font-normal",
        };

        // Size Styles
        const sizes = {
            xs: "h-7 px-2 text-xs rounded",
            sm: "h-8 px-3 text-xs rounded-md",
            md: "h-10 px-4 text-sm rounded-lg",
            lg: "h-12 px-6 text-base rounded-lg",
            icon: "h-9 w-9 p-0 flex items-center justify-center rounded-lg", // Standardized icon size
        };

        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center font-medium transition-all duration-200 select-none",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#2563eb)]/30 focus:ring-offset-1",
                    "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:shadow-none",
                    variants[variant],
                    size !== 'icon' && sizes[size], // Apply size styles if not icon (icon has its own fixed size)
                    size === 'icon' && sizes.icon,
                    fullWidth && "w-full",
                    className
                )}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                )}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export { Button };
