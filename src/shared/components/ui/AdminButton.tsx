import React from 'react';

/**
 * 后台管理系统统一按钮组件
 * 设计原则：
 * 1. 选中状态统一使用红底白字 (bg-red-500 text-white)
 * 2. 所有状态都有明确的视觉反馈
 * 3. 保持一致的圆角、间距和过渡效果
 */

type ButtonVariant = 
    | 'primary'        // 主要操作按钮（蓝色）
    | 'secondary'      // 次要操作按钮（白色边框）
    | 'success'        // 成功/确认按钮（绿色）
    | 'danger'         // 危险操作按钮（浅红）
    | 'danger-solid'   // 危险操作按钮（深红）
    | 'warning'        // 警告按钮（黄色）
    | 'ghost'          // 幽灵按钮（透明）
    | 'outline'        // 轮廓按钮（主题色边框）
    | 'selected'       // 选中状态按钮（红底白字）
    | 'link';          // 链接样式按钮

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    fullWidth?: boolean;
}

export const Button = ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    icon,
    iconPosition = 'left',
    loading = false,
    fullWidth = false,
    className = '', 
    disabled,
    ...props 
}: ButtonProps) => {
    // 按钮变体样式定义
    const variants: Record<ButtonVariant, string> = {
        // 主要操作 - 蓝色背景
        primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm disabled:bg-blue-300',
        
        // 次要操作 - 白色背景带边框
        secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400',
        
        // 成功/确认 - 绿色背景
        success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm disabled:bg-green-300',
        
        // 危险操作 - 浅红背景（警示但不强烈）
        danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 active:bg-red-200 disabled:bg-red-50 disabled:text-red-300',
        
        // 危险操作 - 深红背景（强烈警示）
        'danger-solid': 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm disabled:bg-red-300',
        
        // 警告 - 黄色背景
        warning: 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 shadow-sm disabled:bg-yellow-300',
        
        // 幽灵按钮 - 透明背景
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 disabled:text-gray-300',
        
        // 轮廓按钮 - 主题色边框
        outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100 disabled:border-blue-300 disabled:text-blue-300',
        
        // 选中状态 - 红底白字（统一标准）
        selected: 'bg-red-500 text-white shadow-sm hover:bg-red-600 active:bg-red-700 disabled:bg-red-300',
        
        // 链接样式 - 无背景下划线
        link: 'text-blue-600 hover:text-blue-700 hover:underline active:text-blue-800 disabled:text-blue-300'
    };

    // 尺寸样式定义
    const sizes: Record<ButtonSize, string> = {
        xs: 'px-2 py-1 text-xs',
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    // 圆角样式（根据尺寸调整）
    const roundedStyles: Record<ButtonSize, string> = {
        xs: 'rounded',
        sm: 'rounded-md',
        md: 'rounded-lg',
        lg: 'rounded-lg'
    };

    return (
        <button
            className={`
                ${variants[variant]}
                ${sizes[size]}
                ${roundedStyles[size]}
                ${fullWidth ? 'w-full' : ''}
                font-medium
                transition-all duration-200
                flex items-center justify-center gap-2
                disabled:cursor-not-allowed disabled:opacity-60
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                ${variant === 'link' ? '' : 'whitespace-nowrap'}
                ${className}
            `}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {icon && iconPosition === 'left' && !loading && icon}
            {children}
            {icon && iconPosition === 'right' && !loading && icon}
        </button>
    );
};

/**
 * 切换按钮组件（用于单选/多选场景）
 */
interface ToggleButtonProps extends Omit<ButtonProps, 'variant'> {
    active?: boolean;
}

export const ToggleButton = ({ active = false, children, className = '', ...props }: ToggleButtonProps) => {
    return (
        <Button
            variant={active ? 'selected' : 'ghost'}
            className={`${active ? 'ring-2 ring-red-200' : ''} ${className}`}
            {...props}
        >
            {children}
        </Button>
    );
};

/**
 * 按钮组组件（用于多个按钮组合）
 */
interface ButtonGroupProps {
    children: React.ReactNode;
    className?: string;
}

export const ButtonGroup = ({ children, className = '' }: ButtonGroupProps) => {
    return (
        <div className={`inline-flex rounded-lg shadow-sm ${className}`}>
            {React.Children.map(children, (child, index) => {
                if (React.isValidElement(child)) {
                    const isFirst = index === 0;
                    const isLast = index === React.Children.count(children) - 1;
                    return React.cloneElement(child as React.ReactElement<any>, {
                        className: `
                            ${(child as any).props.className || ''}
                            ${!isFirst ? '-ml-px' : ''}
                            ${isFirst ? 'rounded-r-none' : ''}
                            ${isLast ? 'rounded-l-none' : ''}
                            ${!isFirst && !isLast ? 'rounded-none' : ''}
                        `
                    });
                }
                return child;
            })}
        </div>
    );
};
