import React from 'react';
import { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

interface Props {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    iconBgColor?: string;
    iconColor?: string;
}

export default function QuickAction({ 
    icon: Icon, 
    label, 
    onClick, 
    iconBgColor = 'bg-blue-50', 
    iconColor = 'text-blue-600' 
}: Props) {
    return (
        <button
            onClick={onClick}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all group text-left w-full"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}>
                        <Icon className={iconColor} size={20} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                </div>
                <ChevronRight className="text-gray-400 group-hover:text-blue-600 transition-colors" size={18} />
            </div>
        </button>
    );
}
