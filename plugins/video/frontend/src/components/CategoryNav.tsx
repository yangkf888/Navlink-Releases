import { useState, useEffect, useRef } from 'react';
import { Category } from '../types';

interface CategoryNavProps {
    categories: Category[];
    sourceId: number;
    currentCategoryId?: string;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

// 展开按钮 ref
let expandButtonRef: HTMLButtonElement | null = null;

export function CategoryNav({ categories, sourceId, currentCategoryId, onNavigate }: CategoryNavProps) {
    const [activeTopLevelId, setActiveTopLevelId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Filter top-level categories (Same as Sidebar logic) and exclude empty ones
    const topLevelCats = categories.filter(c =>
        (!c.parent_id || c.parent_id === 0) &&
        (c.has_content === undefined || c.has_content === 1)  // 过滤空分类
    );

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

    // 导航时自动收起
    useEffect(() => {
        setIsExpanded(false);
    }, [sourceId, currentCategoryId]);

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

    // 检测是否超过一行
    useEffect(() => {
        const checkOverflow = () => {
            if (contentRef.current && containerRef.current) {
                // 如果内容高度显著大于容器高度（一行的典型高度约 56px）
                setHasMore(contentRef.current.scrollHeight > 60);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [topLevelCats]);

    // 监听滚动收起
    const lastScrollTop = useRef(0);

    useEffect(() => {
        // 查找滚动容器：优先查找 iframe 内的主滚动容器，然后尝试多个候选
        const scrollContainer = document.querySelector('.custom-scrollbar') ||
            document.querySelector('.overflow-y-auto') ||
            document.documentElement;

        const handleScroll = () => {
            if (isExpanded && scrollContainer) {
                const currentScrollTop = scrollContainer instanceof HTMLElement
                    ? scrollContainer.scrollTop
                    : window.scrollY;
                // 仅向下滚动超过 30px 时收起（降低阈值提高移动端响应速度）
                if (currentScrollTop - lastScrollTop.current > 30) {
                    setIsExpanded(false);
                }
            }
        };

        // 点击外部区域收起（移动端优化）
        const handleClickOutside = (e: MouseEvent) => {
            // 排除展开按钮和分类容器
            if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // 也排除展开按钮本身
                if (expandButtonRef && expandButtonRef.contains(e.target as Node)) {
                    return;
                }
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            // 记录当前滚动位置
            lastScrollTop.current = scrollContainer instanceof HTMLElement
                ? scrollContainer.scrollTop
                : window.scrollY;

            // 延迟添加监听，避免点击展开按钮时立即触发收起
            const timer = setTimeout(() => {
                if (scrollContainer instanceof HTMLElement) {
                    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
                } else {
                    window.addEventListener('scroll', handleScroll, { passive: true });
                }
                // 使用 mousedown 而不是 click，更及时响应
                document.addEventListener('mousedown', handleClickOutside);
            }, 300); // 增加延迟时间避免立即触发

            return () => {
                clearTimeout(timer);
                if (scrollContainer instanceof HTMLElement) {
                    scrollContainer.removeEventListener('scroll', handleScroll);
                } else {
                    window.removeEventListener('scroll', handleScroll);
                }
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isExpanded, sourceId, currentCategoryId]);

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
        <div className="w-full bg-gray-900/80 border-b border-gray-800 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300">
            {/* Top Level Categories Row */}
            <div
                ref={containerRef}
                className={`
                    relative px-4 transition-all duration-300 ease-in-out overflow-hidden
                    ${isExpanded ? 'max-h-[500px] py-3' : 'max-h-[64px] py-3'}
                `}
            >
                <div ref={contentRef} className="flex flex-wrap gap-2">
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
            </div>

            {/* 下拉箭头 */}
            {hasMore && (
                <div className="flex justify-center pb-1 -mt-1 scale-90">
                    <button
                        ref={(el) => { expandButtonRef = el; }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className={`
                            w-8 h-4 flex items-center justify-center bg-gray-800/30 hover:bg-gray-700/50 rounded-b-lg transition-all
                            ${isExpanded ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500'}
                        `}
                    >
                        <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </button>
                </div>
            )}

            {/* Sub Categories Row (Visible if Active Top Level has subs) */}
            {activeSubCats.length > 0 && (
                <div className="flex flex-wrap items-center px-4 py-2 border-t border-gray-800/50 bg-gray-950/30 gap-2 transition-colors duration-300">
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
