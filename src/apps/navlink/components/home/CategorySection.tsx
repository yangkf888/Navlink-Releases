import React, { useState, useEffect } from 'react';
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
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category, LinkItem } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import LinkCard from './LinkCard';
import { useConfig } from '@/shared/context/ConfigContext';
import { LinkEditModal } from './LinkEditModal';
import { ConfirmModal } from '@/shared/components/common/ConfirmModal';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import { getContrastColor } from '@/shared/utils/color';

// --- Sortable Item Component ---
interface SortableItemProps {
    id: string;
    item: LinkItem;
    isAuthenticated: boolean;
    isManageMode: boolean;
    onEdit: (item: LinkItem) => void;
    onDelete: (item: LinkItem) => void;
    containerBgColor?: string;
    hoverBgColor?: string;
}

const SortableItem = ({ id, item, isAuthenticated, isManageMode, onEdit, onDelete, containerBgColor, hoverBgColor }: SortableItemProps) => {
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

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div className={`transition-all duration-200 h-full ${isDragging ? 'shadow-2xl ring-2 ring-[var(--theme-primary)] rounded-xl' : ''
                }`}>
                <div className={`${isDragging ? 'ring-2 ring-[var(--theme-primary)] rounded-xl overflow-hidden' : ''}`}>
                    <LinkCard
                        item={item}
                        isAuthenticated={isAuthenticated}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        containerBgColor={containerBgColor}
                        hoverBgColor={hoverBgColor}
                    />
                </div>
            </div>
        </div>
    );
};

const CategorySectionContent: React.FC<{ cat: Category }> = ({ cat }) => {
    const { config, setConfig, isAuthenticated } = useConfig();
    const [activeSubCat, setActiveSubCat] = useState(
        (cat.subCategories && cat.subCategories.length > 0) ? cat.subCategories[0].name : ''
    );

    // State for expanding/collapsing functionality
    const [isExpanded, setIsExpanded] = useState(false);
    const [limit, setLimit] = useState(12); // Default initialization

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<LinkItem | undefined>(undefined);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<LinkItem | undefined>(undefined);

    // Manage Mode State
    const [isManageMode, setIsManageMode] = useState(false);

    // Reset active tab if categories change
    useEffect(() => {
        if (cat.subCategories && cat.subCategories.length > 0 && !cat.subCategories.find(s => s.name === activeSubCat)) {
            setActiveSubCat(cat.subCategories[0].name);
        }
    }, [cat.subCategories]);

    // Reset expansion when switching tabs
    useEffect(() => {
        setIsExpanded(false);
    }, [activeSubCat, cat.id]);

    // Force expand when in manage mode
    useEffect(() => {
        if (isManageMode) {
            setIsExpanded(true);
        }
    }, [isManageMode]);

    // Calculate the limit based on screen width (3 rows)
    useEffect(() => {
        const calculateLimit = () => {
            const width = window.innerWidth;
            let cols = 1; // Default grid-cols-1

            // Match the grid classes: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5
            if (width >= 1536) { // 2xl
                cols = 5;
            } else if (width >= 1280) { // xl
                cols = 4;
            } else if (width >= 1024) { // lg
                cols = 3;
            } else if (width >= 640) { // sm
                cols = 2;
            }

            setLimit(cols * 3); // 3 Rows
        };

        calculateLimit();
        window.addEventListener('resize', calculateLimit);
        return () => window.removeEventListener('resize', calculateLimit);
    }, []);

    // Determine items to display
    let allItems: LinkItem[] = [];
    let currentSubIndex = -1;

    if (cat.subCategories && cat.subCategories.length > 0) {
        currentSubIndex = cat.subCategories.findIndex((sub: any) => sub.name === activeSubCat);
        allItems = currentSubIndex !== -1 ? cat.subCategories[currentSubIndex].items : [];
    } else {
        allItems = cat.items || [];
    }

    const visibleItems = (isExpanded || isManageMode) ? allItems : allItems.slice(0, limit);
    const showExpandButton = allItems.length > limit && !isManageMode;

    // Handlers
    const handleAddClick = () => {
        setEditingItem(undefined);
        setShowModal(true);
    };

    const handleEditClick = (item: LinkItem) => {
        setEditingItem(item);
        setShowModal(true);
    };

    const handleSaveLink = (newItem: LinkItem) => {
        const newConfig = { ...config };
        const catIndex = newConfig.categories.findIndex(c => c.id === cat.id);
        if (catIndex === -1) return;

        if (currentSubIndex !== -1) {
            // Subcategory mode
            const subCats = [...newConfig.categories[catIndex].subCategories!];
            const items = [...subCats[currentSubIndex].items];

            if (editingItem) {
                // Edit
                const itemIndex = items.findIndex(i => i.id === editingItem.id);
                if (itemIndex !== -1) items[itemIndex] = newItem;
            } else {
                // Add
                items.push(newItem);
            }
            subCats[currentSubIndex].items = items;
            newConfig.categories[catIndex].subCategories = subCats;
        } else {
            // Normal mode
            const items = [...(newConfig.categories[catIndex].items || [])];
            if (editingItem) {
                // Edit
                const itemIndex = items.findIndex(i => i.id === editingItem.id);
                if (itemIndex !== -1) items[itemIndex] = newItem;
            } else {
                // Add
                items.push(newItem);
            }
            newConfig.categories[catIndex].items = items;
        }

        setConfig(newConfig);
    };

    const handleMoveLink = (item: LinkItem, targetCategoryId: string, targetSubCategoryName?: string) => {
        const newConfig = { ...config };
        const sourceCatIndex = newConfig.categories.findIndex(c => c.id === cat.id);
        const targetCatIndex = newConfig.categories.findIndex(c => c.id === targetCategoryId);

        if (sourceCatIndex === -1 || targetCatIndex === -1) return;

        // Remove from source
        if (currentSubIndex !== -1) {
            const subCats = [...newConfig.categories[sourceCatIndex].subCategories!];
            subCats[currentSubIndex].items = subCats[currentSubIndex].items.filter(i => i.id !== item.id);
            newConfig.categories[sourceCatIndex].subCategories = subCats;
        } else {
            newConfig.categories[sourceCatIndex].items =
                (newConfig.categories[sourceCatIndex].items || []).filter(i => i.id !== item.id);
        }

        // Add to target
        if (targetSubCategoryName) {
            const targetSubIndex = newConfig.categories[targetCatIndex].subCategories!.findIndex(
                s => s.name === targetSubCategoryName
            );
            if (targetSubIndex !== -1) {
                newConfig.categories[targetCatIndex].subCategories![targetSubIndex].items.push(item);
            }
        } else {
            if (!newConfig.categories[targetCatIndex].items) {
                newConfig.categories[targetCatIndex].items = [];
            }
            newConfig.categories[targetCatIndex].items!.push(item);
        }

        setConfig(newConfig);
    };

    const handleCrossSectionMove = (item: LinkItem, targetSection: 'category' | 'promo', targetId: string, targetSubId?: string) => {
        const newConfig = { ...config };

        if (targetSection === 'promo') {
            // Move from category to promo
            const sourceCatIndex = newConfig.categories.findIndex(c => c.id === cat.id);
            if (sourceCatIndex === -1) return;

            // Remove from source category
            if (currentSubIndex !== -1) {
                const subCats = [...newConfig.categories[sourceCatIndex].subCategories!];
                subCats[currentSubIndex].items = subCats[currentSubIndex].items.filter(i => i.id !== item.id);
                newConfig.categories[sourceCatIndex].subCategories = subCats;
            } else {
                newConfig.categories[sourceCatIndex].items =
                    (newConfig.categories[sourceCatIndex].items || []).filter(i => i.id !== item.id);
            }

            // Add to target promo tab
            const targetPromoIndex = newConfig.promo?.findIndex(p => p.name === targetId) ?? -1;
            if (targetPromoIndex !== -1 && newConfig.promo) {
                newConfig.promo[targetPromoIndex].items.push({
                    id: item.id,
                    title: item.title,
                    url: item.url,
                    icon: item.icon || 'fa-solid fa-link',
                    color: item.color || '#000000',
                    isAd: false
                });
            }
        } else {
            // Move within categories (same as handleMoveLink)
            handleMoveLink(item, targetId, targetSubId);
            return; // Don't call setConfig again
        }

        setConfig(newConfig);
    };

    const handleDeleteLink = (item: LinkItem) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;

        const newConfig = { ...config };
        const catIndex = newConfig.categories.findIndex(c => c.id === cat.id);
        if (catIndex === -1) return;

        if (currentSubIndex !== -1) {
            // Subcategory mode
            const subCats = [...newConfig.categories[catIndex].subCategories!];
            subCats[currentSubIndex].items = subCats[currentSubIndex].items.filter(i => i.id !== itemToDelete.id);
            newConfig.categories[catIndex].subCategories = subCats;
        } else {
            // Normal mode
            newConfig.categories[catIndex].items = (newConfig.categories[catIndex].items || []).filter(i => i.id !== itemToDelete.id);
        }

        setConfig(newConfig);
        setItemToDelete(undefined);
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
        const catIndex = newConfig.categories.findIndex(c => c.id === cat.id);
        if (catIndex === -1) return;

        let items = [];
        if (currentSubIndex !== -1) {
            // Subcategory mode
            const subCats = [...newConfig.categories[catIndex].subCategories!];
            items = [...subCats[currentSubIndex].items];
            const oldIndex = items.findIndex(i => i.id === active.id);
            const newIndex = items.findIndex(i => i.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                subCats[currentSubIndex].items = arrayMove(items, oldIndex, newIndex);
                newConfig.categories[catIndex].subCategories = subCats;
                setConfig(newConfig);
            }
        } else {
            // Normal mode
            items = [...(newConfig.categories[catIndex].items || [])];
            const oldIndex = items.findIndex(i => i.id === active.id);
            const newIndex = items.findIndex(i => i.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                newConfig.categories[catIndex].items = arrayMove(items, oldIndex, newIndex);
                setConfig(newConfig);
            }
        }
    };

    const catBgColor = config.theme?.categoryBgColor || '#ffffff';
    const cardBgColor = config.theme?.categoryCardBgColor || '#ffffff';
    const cardHoverBgColor = config.theme?.categoryCardHoverBgColor || '';
    const contrastColor = getContrastColor(catBgColor);
    const isDarkBg = contrastColor === '#ffffff';

    return (
        <div
            id={cat.id}
            className="scroll-mt-24 mb-6 rounded-xl p-5 shadow-sm border animate-fade-in transition-all duration-500"
            style={{
                backgroundColor: catBgColor,
                borderColor: catBgColor
            }}
        >
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4 mb-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                    {cat.icon && <Icon icon={cat.icon} className="text-xl text-[var(--theme-primary)]" />}
                    <h2
                        className="font-bold transition-colors duration-500"
                        style={{
                            fontSize: `${config.theme?.categoryTitleSize || 20}px`,
                            color: contrastColor
                        }}
                    >
                        {cat.name}
                    </h2>
                </div>

                {cat.subCategories && cat.subCategories.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto sm:flex-1 pb-2 sm:pb-0" style={{ scrollbarWidth: 'thin' }}>
                        {cat.subCategories.map((sub: any, subIndex: number) => {
                            const isActive = activeSubCat === sub.name;
                            return (
                                <button
                                    key={`${cat.id}-${sub.name}-${subIndex}`}
                                    onClick={() => setActiveSubCat(sub.name)}
                                    className={`
                                        px-4 py-1.5 rounded-lg font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
                                        ${isActive
                                            ? 'bg-[var(--theme-primary)]'
                                            : isDarkBg ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}
                                    `}
                                    style={{
                                        fontSize: `${config.theme?.subCategoryTitleSize || 12}px`,
                                        color: isActive
                                            ? getContrastColor(config.theme?.primaryColor || '#f1404b')
                                            : undefined
                                    }}
                                >
                                    {sub.name}
                                </button>
                            );
                        })}
                    </div>
                )}

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
                            <Icon icon="fa-solid fa-plus" /> 添加链接
                        </button>
                    </div>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={visibleItems.map(i => i.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 ${isManageMode ? 'min-h-[100px]' : ''}`}>
                        {visibleItems.map((item) => (
                            <SortableItem
                                key={item.id}
                                id={item.id}
                                item={item}
                                isAuthenticated={isAuthenticated && isManageMode}
                                isManageMode={isManageMode}
                                onEdit={handleEditClick}
                                onDelete={handleDeleteLink}
                                containerBgColor={cardBgColor}
                                hoverBgColor={cardHoverBgColor}
                            />
                        ))}
                        {allItems.length === 0 && (
                            <div className="col-span-full text-center py-4 text-gray-300 text-sm">暂无内容</div>
                        )}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Expand/Collapse Button */}
            {showExpandButton && (
                <div className={`mt-4 flex justify-center border-t pt-2 ${isDarkBg ? 'border-white/10' : 'border-gray-50'}`}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
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
                categories={config.categories}
                currentCategoryId={cat.id}
                currentSubCategoryName={currentSubIndex !== -1 ? activeSubCat : undefined}
                promoTabs={config.promo}
                enableCrossSectionMove={true}
                currentSection="category"
                onCrossSectionMove={handleCrossSectionMove}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                title="删除链接"
                message={`确定要删除链接 "${itemToDelete?.title}" 吗？此操作无法撤销。`}
            />
        </div>
    );
};

// Wrap with ErrorBoundary
const CategorySection: React.FC<{ cat: Category }> = (props) => {
    return (
        <ErrorBoundary name={`Category-${props.cat.name}`}>
            <CategorySectionContent {...props} />
        </ErrorBoundary>
    );
};

// Optimize with React.memo
export default React.memo(CategorySection, (prevProps, nextProps) => {
    // We need to re-render if config changes (for isAuthenticated or content updates)
    // Since we use useConfig hook inside, the component will re-render when context changes anyway.
    // However, React.memo might block context updates if props didn't change? 
    // Actually, useContext triggers re-render regardless of React.memo.
    // But we should be careful. Let's just compare the 'cat' prop for now, 
    // but since 'cat' comes from 'config' which is a new object on update, this works.
    return prevProps.cat === nextProps.cat;
});