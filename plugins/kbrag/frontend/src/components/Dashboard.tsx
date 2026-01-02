/**
 * Dashboard 概览组件
 */
import React from 'react';
import { Stats, Category } from '../types';

interface DashboardProps {
    stats: Stats;
    categories?: Category[];
    categoryStats?: Record<string, number>;
    onNavigate: (view: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, categories = [], categoryStats = {}, onNavigate }) => {
    const cards = [
        {
            title: '知识总数',
            value: stats.total,
            icon: 'fas fa-book',
            color: 'bg-blue-500',
            onClick: () => onNavigate('list'),
        },
        {
            title: '已向量化',
            value: stats.embedded,
            icon: 'fas fa-check-circle',
            color: 'bg-green-500',
            onClick: () => onNavigate('list'),
        },
        {
            title: '待处理',
            value: stats.pending,
            icon: 'fas fa-clock',
            color: 'bg-yellow-500',
            onClick: () => onNavigate('config'),
        },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">知识库概览</h1>
                <p className="text-gray-500 text-sm mt-0.5">管理和检索本地知识库</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        onClick={card.onClick}
                        className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex flex-col sm:flex-row items-center sm:gap-4">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.color} rounded-lg flex items-center justify-center mb-2 sm:mb-0`}>
                                <i className={`${card.icon} text-white text-lg sm:text-xl`}></i>
                            </div>
                            <div className="text-center sm:text-left">
                                <p className="text-xs sm:text-sm text-gray-500">{card.title}</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{card.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 分类统计 */}
            {categories.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        <i className="fas fa-folder-open mr-2 text-blue-500"></i>
                        分类统计
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => onNavigate(`category:${cat.name}`)}
                                className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: cat.color }}
                                    ></div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 truncate">
                                        {cat.name}
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-gray-900 mt-1">
                                    {categoryStats[cat.name] || 0}
                                </p>
                            </button>
                        ))}
                        {/* 未分类 */}
                        {categoryStats['未分类'] && categoryStats['未分类'] > 0 && (
                            <button
                                onClick={() => onNavigate('list')}
                                className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                                        未分类
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-gray-900 mt-1">
                                    {categoryStats['未分类']}
                                </p>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 快捷操作 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => onNavigate('list')}
                        className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-center"
                    >
                        <i className="fas fa-plus text-blue-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-700">添加知识</p>
                    </button>
                    <button
                        onClick={() => onNavigate('search')}
                        className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-center"
                    >
                        <i className="fas fa-search text-green-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-700">知识检索</p>
                    </button>
                    <button
                        onClick={() => onNavigate('config')}
                        className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-center"
                    >
                        <i className="fas fa-cog text-purple-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-700">配置 API</p>
                    </button>
                    <button
                        onClick={() => onNavigate('list')}
                        className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-center"
                    >
                        <i className="fas fa-bolt text-yellow-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-700">批量向量化</p>
                    </button>
                </div>
            </div>

            {/* 使用说明 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <h2 className="text-lg font-semibold text-blue-900 mb-3">
                    <i className="fas fa-info-circle mr-2"></i>
                    使用说明
                </h2>
                <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
                    <li>在「配置」页面设置 Embedding API（推荐 OpenAI text-embedding-3-small）</li>
                    <li>通过 Chrome 扩展保存网页内容到知识库</li>
                    <li>在「知识列表」中管理已保存的内容</li>
                    <li>在「知识检索」中测试语义搜索效果</li>
                    <li>AI 对话时将自动检索相关知识</li>
                </ol>
            </div>
        </div>
    );
};
