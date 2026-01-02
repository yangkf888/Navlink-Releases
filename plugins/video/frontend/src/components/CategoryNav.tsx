import { useState, useEffect } from 'react';
import { Category } from '../types';

interface CategoryNavProps {
    categories: Category[];
    sourceId: number;
    currentCategoryId?: string;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

export function CategoryNav({ categories, sourceId, currentCategoryId, onNavigate }: CategoryNavProps) {
    const [activeTopLevelId, setActiveTopLevelId] = useState<string | null>(null);

    // Filter top-level categories (Same as Sidebar logic)
    const topLevelCats = categories.filter(c => !c.parent_id || c.parent_id === 0);

    // Identify active top-level category based on currentCategoryId
    useEffect(() => {
        if (!currentCategoryId) {
            setActiveTopLevelId(null);
            return;
        }

        // Check if current ID is a top-level category
        const isTopLevel = topLevelCats.some(c => c.type_id === currentCategoryId);
        if (isTopLevel) {
            setActiveTopLevelId(currentCategoryId);
            return;
        }

        // Check if current ID is a sub-category, find its parent
        const currentCat = categories.find(c => c.type_id === currentCategoryId);
        if (currentCat && currentCat.parent_id) {
            const parentId = String(currentCat.parent_id);
            // Verify parent is in topLevelCats (it should be)
            if (topLevelCats.some(c => c.type_id === parentId)) {
                setActiveTopLevelId(parentId);
            }
        }
    }, [currentCategoryId, categories, topLevelCats]);

    // Handle clicking a top-level category
    const handleTopLevelClick = (cat: Category) => {
        const subCats = categories.filter(c =>
            c.parent_id === parseInt(cat.type_id) ||
            (c.parent_id && String(c.parent_id) === cat.type_id)
        );

        setActiveTopLevelId(cat.type_id);
        onNavigate('category', {
            sourceId: sourceId,
            categoryId: cat.type_id,
            categoryName: cat.name,
            subCategories: subCats
        });
    };

    // Handle clicking a sub-category
    const handleSubLevelClick = (sub: Category) => {
        onNavigate('category', {
            sourceId: sourceId,
            categoryId: sub.type_id,
            categoryName: sub.name
        });
    };

    // Get sub-categories for the active top-level category
    const activeSubCats = activeTopLevelId
        ? categories.filter(c =>
            c.parent_id === parseInt(activeTopLevelId) ||
            (c.parent_id && String(c.parent_id) === activeTopLevelId)
        )
        : [];

    // Helper for icons (Same as Sidebar logic)
    const getIcon = (name: string): string => {
        const icons: Record<string, string> = {
            '电影': 'fas fa-film',
            '连续剧': 'fas fa-tv',
            '电视剧': 'fas fa-tv',
            '剧集': 'fas fa-tv',
            '综艺': 'fas fa-masks-theater',
            '动漫': 'fas fa-dragon',
            '动画': 'fas fa-dragon',
            '纪录片': 'fas fa-video',
            '明星': 'fas fa-star',
            '更新': 'fas fa-clock',
            '热榜': 'fas fa-fire',
            '资讯': 'fas fa-newspaper',
        };
        for (const [key, icon] of Object.entries(icons)) {
            if (name.includes(key)) return icon;
        }
        return 'fas fa-folder';
    };

    return (
        <div className="w-full bg-gray-900/80 border-b border-gray-800 backdrop-blur-md sticky top-0 z-20 transition-colors duration-300">
            {/* Top Level Categories Row */}
            <div className="flex overflow-x-auto no-scrollbar px-4 py-3 gap-3 mask-linear-fade">
                {topLevelCats.map(cat => {
                    const isActive = activeTopLevelId === cat.type_id;
                    const icon = getIcon(cat.name);

                    return (
                        <button
                            key={cat.type_id}
                            onClick={() => handleTopLevelClick(cat)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
                                ${isActive
                                    ? 'bg-blue-600/90 text-white shadow-md shadow-blue-500/20 scale-105'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'}
                            `}
                        >
                            <i className={icon}></i>
                            {cat.name}
                        </button>
                    );
                })}
            </div>

            {/* Sub Categories Row (Visible if Active Top Level has subs) */}
            {activeSubCats.length > 0 && (
                <div className="flex items-center overflow-x-auto no-scrollbar px-4 py-2 border-t border-gray-800/50 bg-gray-950/30 gap-2 transition-colors duration-300">
                    <span className="flex items-center text-sm text-gray-500 font-bold px-2 uppercase tracking-wider shrink-0 mr-1 select-none">
                        {topLevelCats.find(c => c.type_id === activeTopLevelId)?.name}
                    </span>
                    <div className="h-4 w-px bg-gray-700 mx-1 shrink-0"></div>
                    {activeSubCats.map(sub => {
                        const isSubActive = currentCategoryId === sub.type_id;

                        return (
                            <button
                                key={sub.type_id}
                                onClick={() => handleSubLevelClick(sub)}
                                className={`
                                    px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-all duration-200
                                    ${isSubActive
                                        ? 'bg-gray-800 text-white font-bold'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}
                                `}
                            >
                                {sub.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
