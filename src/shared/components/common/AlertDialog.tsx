import React from 'react';
import { Icon } from './Icon';

interface AlertDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info' | 'warning';
    buttonText?: string;
    showButton?: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
    isOpen,
    title,
    message,
    variant = 'info',
    buttonText = '确定',
    showButton = true,
    onClose,
    children
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && showButton) {
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

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in pointer-events-auto"
        >
            {/* 背景遮罩 - 增加暗度并确保覆盖 */}
            <div
                className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
                onClick={(e) => {
                    e.stopPropagation();
                    if (showButton) onClose();
                }}
            />
            {/* 对话框 - 确保其本身不透传点击 */}
            <div
                className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 标题 */}
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.textColor}`}>
                        <Icon icon={config.icon} className="text-xl" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    </div>
                </div>

                {/* 消息内容 */}
                <div className="pl-13 pr-4 overflow-visible">
                    <p className="text-gray-600 whitespace-pre-line leading-relaxed mb-1">
                        {message}
                    </p>
                    {children && (
                        <div className="mt-4 block clear-both">
                            {children}
                        </div>
                    )}
                </div>

                {/* 按钮 */}
                {showButton && (
                    <div className="flex justify-end mt-6">
                        <button
                            onClick={onClose}
                            className={`px-5 py-2.5 rounded-lg transition-colors font-medium text-white ${config.buttonColor}`}
                        >
                            {buttonText}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
