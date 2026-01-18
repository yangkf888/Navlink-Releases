import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
    icon: LucideIcon;
    label: string;
    value: number;
    subtitle?: React.ReactNode;
    iconBgColor?: string;
    iconColor?: string;
}

export default function StatCard({
    icon: Icon,
    label,
    value,
    subtitle,
    iconBgColor = 'bg-blue-50',
    iconColor = 'text-blue-600'
}: Props) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className={`w-12 h-12 ${iconBgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={iconColor} size={24} />
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">{label}</div>
                    <div className="text-3xl font-bold text-gray-900">{value}</div>
                    {subtitle && (
                        <div className="mt-1">{subtitle}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
