import React from 'react';
import { Activity } from 'lucide-react';

export default function Monitor() {
    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">监控面板</h1>
                <p className="text-gray-600 mt-1">实时监控系统运行状态</p>
            </div>

            <div className="bg-white rounded-lg shadow p-8 text-center">
                <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">监控功能开发中</h3>
                <p className="text-gray-600">
                    系统监控功能正在开发中,敬请期待...
                </p>
            </div>
        </div>
    );
}
