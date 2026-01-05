/**
 * 网盘筛选组件
 * 桌面端：横向标签栏
 * 移动端：筛选按钮 + 底部抽屉
 */
import { useState, useEffect } from 'react';

interface FilterOption {
    value: string | number;
    count: number;
}

interface FiltersData {
    genres: FilterOption[];
    years: FilterOption[];
    areas: FilterOption[];
    actors: FilterOption[];
    studios: FilterOption[];
}

interface ActiveFilters {
    genres?: string;
    year?: number;
    area?: string;
    actor?: string;
    studio?: string;
}

interface NetdiskFilterProps {
    sourceId: number;
    onFilterChange: (filters: ActiveFilters) => void;
    isMobile?: boolean;
}

export function NetdiskFilter({ sourceId, onFilterChange, isMobile = false }: NetdiskFilterProps) {
    const [filters, setFilters] = useState<FiltersData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [showDrawer, setShowDrawer] = useState(false);

    // 加载筛选选项
    useEffect(() => {
        loadFilters();
    }, [sourceId]);

    const loadFilters = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/plugins/video/api/netdisk/media/filters?sourceId=${sourceId}`);
            const data = await res.json();
            if (data.success) {
                setFilters(data.data);
            }
        } catch (err) {
            console.error('Failed to load filters:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterSelect = (category: string, value: string | number | null) => {
        const newFilters = { ...activeFilters };
        if (value === null) {
            delete (newFilters as any)[category];
        } else {
            (newFilters as any)[category] = value;
        }
        setActiveFilters(newFilters);
        onFilterChange(newFilters);
        setExpandedCategory(null);
    };

    const clearAllFilters = () => {
        setActiveFilters({});
        onFilterChange({});
        setShowDrawer(false);
    };

    const getActiveFilterCount = () => {
        return Object.keys(activeFilters).length;
    };

    const categories = [
        { key: 'genres', label: '类型', icon: 'fas fa-tags' },
        { key: 'years', label: '年份', icon: 'fas fa-calendar' },
        { key: 'areas', label: '地区', icon: 'fas fa-globe' },
        { key: 'actors', label: '演员', icon: 'fas fa-user' },
        { key: 'studios', label: '制片厂', icon: 'fas fa-building' }
    ];

    // 将 categories key 映射到 ActiveFilters key
    const getFilterKey = (catKey: string): string => {
        const keyMap: Record<string, string> = {
            'years': 'year',
            'areas': 'area',
            'actors': 'actor',
            'studios': 'studio'
        };
        return keyMap[catKey] || catKey;
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 text-gray-400 text-sm">
                <i className="fas fa-spinner animate-spin"></i>
                <span>加载筛选...</span>
            </div>
        );
    }

    if (!filters || (filters.genres.length === 0 && filters.years.length === 0 && filters.areas.length === 0 && filters.actors.length === 0 && filters.studios.length === 0)) {
        return null;
    }

    // 移动端：筛选按钮 + 底部抽屉
    if (isMobile) {
        return (
            <>
                {/* 筛选按钮 */}
                <button
                    onClick={() => setShowDrawer(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${getActiveFilterCount() > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                >
                    <i className="fas fa-filter"></i>
                    <span>筛选</span>
                    {getActiveFilterCount() > 0 && (
                        <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                            {getActiveFilterCount()}
                        </span>
                    )}
                </button>

                {/* 底部抽屉 */}
                {showDrawer && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowDrawer(false)}>
                        {/* 遮罩 */}
                        <div className="absolute inset-0 bg-black/60"></div>

                        {/* 抽屉内容 */}
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl max-h-[70vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* 抽屉头部 */}
                            <div className="sticky top-0 bg-gray-900 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">筛选</h3>
                                <div className="flex items-center gap-2">
                                    {getActiveFilterCount() > 0 && (
                                        <button
                                            onClick={clearAllFilters}
                                            className="text-sm text-gray-400 hover:text-white"
                                        >
                                            清空
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowDrawer(false)}
                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>

                            {/* 筛选选项 */}
                            <div className="p-4 space-y-6">
                                {categories.map(cat => {
                                    const options = (filters as any)[cat.key] as FilterOption[];
                                    if (!options || options.length === 0) return null;

                                    return (
                                        <div key={cat.key}>
                                            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                                <i className={cat.icon}></i>
                                                {cat.label}
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => handleFilterSelect(getFilterKey(cat.key), null)}
                                                    className={`px-3 py-1.5 rounded text-sm transition-colors ${!(activeFilters as any)[getFilterKey(cat.key)]
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-800 text-gray-300'
                                                        }`}
                                                >
                                                    全部
                                                </button>
                                                {options.slice(0, 20).map(opt => (
                                                    <button
                                                        key={String(opt.value)}
                                                        onClick={() => handleFilterSelect(
                                                            getFilterKey(cat.key),
                                                            opt.value
                                                        )}
                                                        className={`px-3 py-1.5 rounded text-sm transition-colors ${(activeFilters as any)[getFilterKey(cat.key)] === opt.value
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        {opt.value}
                                                        <span className="ml-1 text-xs opacity-60">({opt.count})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 确定按钮 */}
                            <div className="sticky bottom-0 bg-gray-900 px-4 py-3 border-t border-gray-800">
                                <button
                                    onClick={() => setShowDrawer(false)}
                                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium"
                                >
                                    确定
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // 桌面端：横向标签栏
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {categories.map(cat => {
                const options = (filters as any)[cat.key] as FilterOption[];
                if (!options || options.length === 0) return null;

                const filterKey = getFilterKey(cat.key);
                const activeValue = (activeFilters as any)[filterKey];
                const isExpanded = expandedCategory === cat.key;

                return (
                    <div key={cat.key} className="relative">
                        {/* 分类按钮 */}
                        <button
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${activeValue
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                        >
                            <i className={`${cat.icon} text-xs`}></i>
                            <span>{activeValue || cat.label}</span>
                            <i className={`fas fa-chevron-down text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                        </button>

                        {/* 选项下拉 */}
                        {isExpanded && (
                            <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-20 min-w-[200px] max-h-[300px] overflow-y-auto">
                                <button
                                    onClick={() => handleFilterSelect(filterKey, null)}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${!activeValue ? 'text-blue-400' : 'text-gray-300'
                                        }`}
                                >
                                    全部
                                </button>
                                {options.map(opt => (
                                    <button
                                        key={String(opt.value)}
                                        onClick={() => handleFilterSelect(filterKey, opt.value)}
                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between ${activeValue === opt.value ? 'text-blue-400' : 'text-gray-300'
                                            }`}
                                    >
                                        <span>{opt.value}</span>
                                        <span className="text-xs text-gray-500">({opt.count})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* 清空按钮 */}
            {getActiveFilterCount() > 0 && (
                <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    <i className="fas fa-times-circle"></i>
                    清空筛选
                </button>
            )}
        </div>
    );
}
