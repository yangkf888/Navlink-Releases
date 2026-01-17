import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SiteConfig, PromoItem, LinkItem } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import { useConfig } from '@/shared/context/ConfigContext';
import { LinkEditModal } from './LinkEditModal';
import { ensureProtocol } from '@/shared/utils/url';
import { ConfirmModal } from '@/shared/components/common/ConfirmModal';
import { getContrastColor } from '@/shared/utils/color';

// --- Sortable Item Component ---
interface SortableItemProps {
    id: string;
    item: PromoItem;
    isManageMode: boolean;
    isAuthenticated: boolean;
    onEditClick: (e: React.MouseEvent, item: PromoItem) => void;
    onDeleteClick: (e: React.MouseEvent, item: PromoItem) => void;
    contrastColor: string;
    promoBgColor: string;
    promoCardBgColor: string;
    promoCardHoverBgColor: string;
}

const SortableItem = ({ id, item, isManageMode, isAuthenticated, onEditClick, onDeleteClick, contrastColor, promoBgColor, promoCardBgColor, promoCardHoverBgColor }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id,
        disabled: !isManageMode
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.3 : 1,
    };

    const itemContrastColor = getContrastColor(promoCardBgColor);
    const itemHoverBg = promoCardHoverBgColor || promoCardBgColor;
    const itemHoverContrastColor = getContrastColor(itemHoverBg);
    const isItemDarkBg = itemContrastColor === '#ffffff';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="p-1.5 h-full"
            {...attributes}
            {...listeners}
        >
            <div className={`relative group h-full rounded-lg transition-all duration-200 ${isDragging ? 'shadow-2xl ring-2 ring-[var(--theme-primary)]' : ''
                }`}>
                <a
                    href={!isManageMode ? ensureProtocol(item.url || '') : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                        if (isManageMode) e.preventDefault();
                    }}
                    className={`promo-card flex items-center gap-2 p-2.5 rounded-lg transition-all duration-200 h-full relative border
                        ${isDragging ? 'bg-white border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]' : 'border-transparent'}
                        ${!isManageMode ? 'cursor-pointer' : 'cursor-move'}
                    `}
                    style={{
                        backgroundColor: !isDragging ? promoCardBgColor : undefined,
                        borderColor: !isDragging ? promoBgColor : undefined,
                        '--hover-bg': itemHoverBg,
                        '--hover-text': itemHoverContrastColor,
                        color: itemContrastColor
                    } as React.CSSProperties}
                >
                    {!item.isAd && item.icon && (
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                            {item.icon.includes('fa-') || item.icon.includes(':') ? (
                                <Icon icon={item.icon} className="text-[28px]" style={{ color: item.color || '#ddd' }} />
                            ) : (
                                <img src={item.icon} className="w-7 h-7 object-contain" alt="" />
                            )}
                        </div>
                    )}
                    {item.isAd && (
                        <span
                            className="text-[10px] border rounded px-1 flex-shrink-0 transition-colors"
                            style={{ borderColor: 'currentColor', opacity: 0.6 }}
                        >
                            Ad
                        </span>
                    )}
                    <span
                        className="text-xs font-medium truncate group-hover:text-[var(--theme-primary)] transition-colors flex-1"
                        style={{ color: 'inherit' }}
                    >
                        {item.title}
                    </span>

                    {/* Health Info & Status Dot */}
                    {item.health && (
                        <div className="absolute bottom-1 right-1 z-10 flex items-center justify-end">
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[10px] font-bold mr-1 whitespace-nowrap ${item.health.isHealthy ? 'text-green-500' : 'text-red-500'}`}>
                                {item.health.isHealthy ? `${item.health.responseTime || 0}ms` : '失效'}
                            </div>
                            {!item.health.isHealthy && (
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm animate-pulse" />
                            )}
                        </div>
                    )}
                </a>

                {isAuthenticated && isManageMode && (
                    <div className="absolute -top-2 -right-2 flex gap-1 animate-fade-in z-10">
                        <button
                            onClick={(e) => onEditClick(e, item)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="w-6 h-6 bg-white text-blue-500 rounded-full shadow-md hover:bg-blue-50 flex items-center justify-center border border-gray-100"
                            title="编辑"
                        >
                            <Icon icon="fa-solid fa-pen" className="text-[10px]" />
                        </button>
                        <button
                            onClick={(e) => onDeleteClick(e, item)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="w-6 h-6 bg-white text-red-500 rounded-full shadow-md hover:bg-red-50 flex items-center justify-center border border-gray-100"
                            title="删除"
                        >
                            <Icon icon="fa-solid fa-trash" className="text-[10px]" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PromoArea = () => {
    const { config, setConfig, isAuthenticated } = useConfig();
    const [activeTabName, setActiveTabName] = useState(config.promo?.[0]?.name || '');
    const [isExpanded, setIsExpanded] = useState(false);
    const [limit, setLimit] = useState(24); // Default max items for 3 rows on large screens

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<LinkItem | undefined>(undefined);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<PromoItem | undefined>(undefined);

    // Manage Mode State
    const [isManageMode, setIsManageMode] = useState(false);

    // Validate active tab existence
    useEffect(() => {
        if (!config.promo?.find(p => p.name === activeTabName)) {
            setActiveTabName(config.promo?.[0]?.name || '');
        }
    }, [config.promo, activeTabName]);

    // Reset expansion when tab changes
    useEffect(() => {
        setIsExpanded(false);
    }, [activeTabName]);

    // Force expand when in manage mode
    useEffect(() => {
        if (isManageMode) {
            setIsExpanded(true);
        }
    }, [isManageMode]);

    // Calculate the number of items for 3 rows based on current screen width/grid columns
    useEffect(() => {
        const calculateLimit = () => {
            const width = window.innerWidth;
            let cols = 2; // Default mobile grid-cols-2

            // Match the grid classes: grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8
            if (width >= 1280) { // xl
                cols = 8;
            } else if (width >= 1024) { // lg
                cols = 6;
            } else if (width >= 768) { // md
                cols = 4;
            }

            setLimit(cols * 3); // 3 Rows
        };

        calculateLimit();
        window.addEventListener('resize', calculateLimit);
        return () => window.removeEventListener('resize', calculateLimit);
    }, []);

    // Memoize active tab and items to prevent recalculation
    const activeTab = config.promo?.find(p => p.name === activeTabName) || config.promo?.[0];

    const allItems = activeTab?.items || [];

    // Determine visible items
    const visibleItems = (isExpanded || isManageMode) ? allItems : allItems.slice(0, limit);

    const showExpandButton = allItems.length > limit && !isManageMode;

    // Stable callbacks
    const handleTabClick = useCallback((tabName: string) => {
        setActiveTabName(tabName);
    }, []);

    const toggleExpand = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    // Admin Handlers
    const handleAddClick = () => {
        setEditingItem(undefined);
        setShowModal(true);
    };

    const handleEditClick = (e: React.MouseEvent, item: PromoItem) => {
        e.preventDefault();
        e.stopPropagation();
        // Convert PromoItem to LinkItem format
        setEditingItem({
            id: item.id,
            title: item.title,
            url: item.url || '',
            description: '',
            icon: item.icon,
            color: item.color
        });
        setShowModal(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, item: PromoItem) => {
        e.preventDefault();
        e.stopPropagation();
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;

        const newConfig = { ...config };
        const tabIndex = newConfig.promo?.findIndex(p => p.name === activeTabName);
        if (tabIndex !== undefined && tabIndex !== -1 && newConfig.promo) {
            newConfig.promo[tabIndex].items = newConfig.promo[tabIndex].items.filter(i => i.id !== itemToDelete.id);
            setConfig(newConfig);
        }

        setItemToDelete(undefined);
    };

    const handleSaveLink = (newItem: LinkItem) => {
        const newConfig = { ...config };
        const tabIndex = newConfig.promo?.findIndex(p => p.name === activeTabName);
        if (tabIndex === undefined || tabIndex === -1 || !newConfig.promo) return;

        const items = [...newConfig.promo[tabIndex].items];

        if (editingItem) {
            // Edit
            const itemIndex = items.findIndex(i => i.id === editingItem.id);
            if (itemIndex !== -1) {
                // Preserve isAd property if it exists
                const originalItem = items[itemIndex];
                items[itemIndex] = {
                    ...newItem,
                    isAd: originalItem.isAd,
                    color: newItem.color || '#000000',
                    icon: newItem.icon || 'fa-solid fa-link'
                };
            }
        } else {
            // Add
            items.push({
                ...newItem,
                isAd: false,
                color: newItem.color || '#000000',
                icon: newItem.icon || 'fa-solid fa-link'
            });
        }

        newConfig.promo[tabIndex].items = items;
        setConfig(newConfig);
    };

    const handleMoveLink = (item: LinkItem, targetTabName: string) => {
        const newConfig = { ...config };
        const sourceTabIndex = newConfig.promo?.findIndex(p => p.name === activeTabName);
        const targetTabIndex = newConfig.promo?.findIndex(p => p.name === targetTabName);

        if (sourceTabIndex === undefined || sourceTabIndex === -1 || targetTabIndex === undefined || targetTabIndex === -1 || !newConfig.promo) return;

        // Remove from source tab
        newConfig.promo[sourceTabIndex].items = newConfig.promo[sourceTabIndex].items.filter(i => i.id !== item.id);

        // Add to target tab (preserve isAd property)
        const sourceItem = config.promo?.[sourceTabIndex].items.find(i => i.id === item.id);
        newConfig.promo[targetTabIndex].items.push({
            ...item,
            isAd: sourceItem?.isAd || false,
            color: item.color || '#000000',
            icon: item.icon || 'fa-solid fa-link'
        });

        setConfig(newConfig);
    };

    const handleCrossSectionMove = (item: LinkItem, targetSection: 'category' | 'promo', targetId: string, targetSubId?: string) => {
        const newConfig = { ...config };

        if (targetSection === 'category') {
            // Move from promo to category
            const sourceTabIndex = newConfig.promo?.findIndex(p => p.name === activeTabName);
            if (sourceTabIndex === undefined || sourceTabIndex === -1 || !newConfig.promo) return;

            // Remove from source promo tab
            newConfig.promo[sourceTabIndex].items = newConfig.promo[sourceTabIndex].items.filter(i => i.id !== item.id);

            // Add to target category
            const targetCatIndex = newConfig.categories.findIndex(c => c.id === targetId);
            if (targetCatIndex !== -1) {
                if (targetSubId) {
                    // Add to subcategory
                    const targetSubIndex = newConfig.categories[targetCatIndex].subCategories!.findIndex(
                        s => s.name === targetSubId
                    );
                    if (targetSubIndex !== -1) {
                        newConfig.categories[targetCatIndex].subCategories![targetSubIndex].items.push(item);
                    }
                } else {
                    // Add to main category
                    if (!newConfig.categories[targetCatIndex].items) {
                        newConfig.categories[targetCatIndex].items = [];
                    }
                    newConfig.categories[targetCatIndex].items!.push(item);
                }
            }
        } else {
            // Move within promo tabs (same as handleMoveLink)
            handleMoveLink(item, targetId);
            return; // Don't call setConfig again
        }

        setConfig(newConfig);
    };

    // dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const newConfig = { ...config };
        const tabIndex = newConfig.promo?.findIndex(p => p.name === activeTabName);
        if (tabIndex === undefined || tabIndex === -1 || !newConfig.promo) return;

        const items = [...newConfig.promo[tabIndex].items];
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            newConfig.promo[tabIndex].items = arrayMove(items, oldIndex, newIndex);
            setConfig(newConfig);
        }
    };

    const promoBgColor = config.theme?.promoBgColor || '#ffffff';
    const promoCardBgColor = config.theme?.promoCardBgColor || '#f3f4f6';
    const promoCardHoverBgColor = config.theme?.promoCardHoverBgColor || '#e5e7eb';
    const contrastColor = getContrastColor(promoBgColor);
    const isDarkBg = contrastColor === '#ffffff';

    return (
        <div className="w-full z-20 relative promo-container">
            <div
                className="rounded-xl shadow-lg p-5 animate-fade-in transition-all duration-500"
                style={{
                    backgroundColor: promoBgColor
                }}
            >
                <div
                    className={`flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4 mb-4 border-b pb-3 transition-colors duration-500 ${isDarkBg ? 'border-white/10' : 'border-gray-200/50'}`}
                >
                    <div className="flex items-center gap-2 text-sm select-none flex-shrink-0">
                        <Icon icon={config.theme?.promoIcon || "fa-solid fa-fire"} className="text-red-500" />
                        <span
                            className="font-bold transition-colors duration-500"
                            style={{
                                fontSize: `${config.theme?.promoCategoryTitleSize || 16}px`,
                                color: contrastColor
                            }}
                        >
                            {config.theme?.promoTitle ?? "热门网址"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto sm:flex-1 pb-2 sm:pb-0" style={{ scrollbarWidth: 'thin' }}>
                        {config.promo?.map((tab) => {
                            const isActive = activeTabName === tab.name;
                            // If the tab has a URL, render it as a link
                            if (tab.url) {
                                return (
                                    <a
                                        key={tab.name}
                                        href={ensureProtocol(tab.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-1.5 rounded-lg font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1 flex-shrink-0"
                                        style={{
                                            fontSize: `${config.theme?.promoSubCategoryTitleSize || 12}px`,
                                            color: isDarkBg ? (isActive ? '#fff' : 'rgba(255,255,255,0.6)') : (isActive ? '#374151' : '#6b7280')
                                        }}
                                    >
                                        {tab.name} <Icon icon="fa-solid fa-arrow-up-right-from-square" className="text-[10px] opacity-50" />
                                    </a>
                                );
                            }

                            // Otherwise, render it as a tab switcher button
                            return (
                                <button
                                    key={tab.name}
                                    onClick={() => handleTabClick(tab.name)}
                                    className={`
                                        px-4 py-1.5 rounded-lg font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
                                        ${isActive
                                            ? 'bg-[var(--theme-primary)]'
                                            : isDarkBg ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}
                                    `}
                                    style={{
                                        fontSize: `${config.theme?.promoSubCategoryTitleSize || 12}px`,
                                        color: isActive
                                            ? getContrastColor(config.theme?.primaryColor || '#f1404b')
                                            : undefined
                                    }}
                                >
                                    {tab.name}
                                </button>
                            );
                        })}
                    </div>

                    {isAuthenticated && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsManageMode(!isManageMode)}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 border ${isManageMode ? 'bg-orange-50 text-orange-600 border-orange-200' : isDarkBg ? 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <Icon icon={isManageMode ? "fa-solid fa-check" : "fa-solid fa-gear"} />
                                {isManageMode ? '完成' : '管理'}
                            </button>
                            <button
                                onClick={handleAddClick}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${isDarkBg ? 'bg-white/10 text-white/70 hover:bg-[var(--theme-primary)] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-[var(--theme-primary)] hover:text-white'}`}
                            >
                                <Icon icon="fa-solid fa-plus" /> 添加
                            </button>
                        </div>
                    )}
                </div>

                {/* Items Grid */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={visibleItems.map(i => i.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 ${isManageMode ? 'min-h-[120px]' : ''}`}>
                            {visibleItems.map((item) => (
                                <SortableItem
                                    key={item.id}
                                    id={item.id}
                                    item={item}
                                    isManageMode={isManageMode}
                                    isAuthenticated={isAuthenticated}
                                    onEditClick={handleEditClick}
                                    onDeleteClick={handleDeleteClick}
                                    contrastColor={contrastColor}
                                    promoBgColor={promoBgColor}
                                    promoCardBgColor={promoCardBgColor}
                                    promoCardHoverBgColor={promoCardHoverBgColor}
                                />
                            ))}
                            {allItems.length === 0 && (
                                <div className="col-span-full text-center text-gray-300 text-xs py-4">
                                    该标签页下暂无内容
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* Expand/Collapse Button */}
                {showExpandButton && (
                    <div className="mt-3 flex justify-center border-t border-gray-50 pt-2">
                        <button
                            onClick={toggleExpand}
                            className={`text-xs flex items-center gap-1 py-1 px-4 transition-colors ${isDarkBg ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-[var(--theme-primary)]'}`}
                        >
                            {isExpanded ? (
                                <>收起 <Icon icon="fa-solid fa-angle-up" /></>
                            ) : (
                                <>显示更多 <Icon icon="fa-solid fa-angle-down" /></>
                            )}
                        </button>
                    </div>
                )}

                {/* Edit Modal */}
                <LinkEditModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveLink}
                    onMove={handleMoveLink}
                    initialItem={editingItem}
                    title={editingItem ? '编辑推荐' : '添加推荐'}
                    promoTabs={config.promo}
                    currentPromoTab={activeTabName}
                    categories={config.categories}
                    enableCrossSectionMove={true}
                    currentSection="promo"
                    onCrossSectionMove={handleCrossSectionMove}
                />

                {/* Delete Confirmation Modal */}
                <ConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={confirmDelete}
                    title="删除推荐"
                    message={`确定要删除推荐 "${itemToDelete?.title}" 吗？此操作无法撤销。`}
                />
            </div>
        </div>
    )
}

export default PromoArea;