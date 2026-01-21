
import React, { useState } from 'react';

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { useConfig } from '@/shared/context/ConfigContext';

import { Icon } from '@/shared/components/common/Icon';

import { Label, Input } from '@/shared/components/ui/AdminInput';

import { Button } from '@/shared/components/ui/AdminButton';

import { useDialogs } from '@/shared/hooks/useDialogs';

import { AlertDialog } from '@/shared/components/common/AlertDialog';

import { Accordion } from '@/shared/components/ui/Accordion';

import { removeItem } from '@/shared/utils/url';

import { LinkEditModal } from '@/apps/navlink/components/home/LinkEditModal';

import { AssetPickerModal } from '@/shared/components/common/AssetPickerModal';

import { LinkItem } from '@/shared/types';


// Promo Item Editor Component  
const PromoItemEditor: React.FC<{
    item: any;
    tabIdx: number;
    itemIdx: number;
    config: any;
    update: any;
    onDelete: () => void;
    onMove: (targetTabIdx: number) => void;
    onCrossSectionMove: (targetSection: 'category' | 'promo', targetId: string, targetSubId?: string) => void;
    currentTabName: string;
}> = ({ item, tabIdx, itemIdx, config, update, onDelete, onMove, onCrossSectionMove, currentTabName }) => {
    const [selectedSection, setSelectedSection] = useState<'category' | 'promo'>('promo');
    const [selectedPromoTab, setSelectedPromoTab] = useState(currentTabName);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [iconMode, setIconMode] = useState<'local' | 'online'>(() => {
        if (item.icon?.startsWith('/uploads/')) return 'local';
        if (item.icon?.includes('fa-') || item.icon?.includes(':')) return 'online';
        return 'online';
    });
    const [uploading, setUploading] = useState(false);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);

    const { showAlert } = useDialogs();

    const selectedCategory = config.categories?.find((c: any) => c.id === selectedCategoryId);
    const hasSubCategories = selectedCategory?.subCategories && selectedCategory.subCategories.length > 0;

    // Check if section or position changed
    const sectionChanged = selectedSection !== 'promo';
    const promoTabChanged = selectedSection === 'promo' && selectedPromoTab !== currentTabName;
    const hasMovement = sectionChanged || promoTabChanged;

    React.useEffect(() => {
        if (config.categories && config.categories.length > 0) {
            setSelectedCategoryId(config.categories[0].id);
        }
    }, [config.categories]);

    const handleMoveClick = () => {
        if (selectedSection === 'promo') {
            const targetTabIdx = config.promo.findIndex((p: any) => p.name === selectedPromoTab);
            if (targetTabIdx !== -1 && targetTabIdx !== tabIdx) {
                onMove(targetTabIdx);
            }
        } else {
            onCrossSectionMove('category', selectedCategoryId, selectedSubCategory || undefined);
        }
    };

    const updateItem = (field: string, value: any) => {
        const n = [...config.promo];
        n[tabIdx].items[itemIdx][field] = value;
        update((c: any) => ({ ...c, promo: n }));
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showAlert('文件过大', '图片大小不能超过 5MB', 'warning');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (data.url) {
                updateItem('icon', data.url);
                setIconMode('local');
            } else {
                showAlert('上传失败', data.error || '未知错误', 'error');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            showAlert('上传失败', '请重试', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDownloadIcon = async () => {
        if (!item.icon || item.icon.startsWith('/uploads/')) return;

        const isIconCode = item.icon.includes('fa-') || item.icon.includes(':');
        if (isIconCode) {
            showAlert('无需下载', '图标代码无需下载', 'info');
            return;
        }

        setUploading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/download-icon', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ iconUrl: item.icon })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '下载失败');
            }

            const data = await response.json();
            updateItem('icon', data.url);
            setIconMode('local');
            showAlert('图标已下载到服务器', '', 'success');
        } catch (err: any) {
            console.error('Download icon failed:', err);
            showAlert('下载失败', err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white p-3 rounded border border-gray-200 space-y-3">
            {/* 第一行：标题、URL、操作按钮 */}
            <div className="flex gap-3">
                <div className="flex items-center justify-center text-gray-400 cursor-grab hover:text-gray-600">
                    <Icon icon="fa-solid fa-grip-vertical" />
                </div>
                <div className="flex-1">
                    <Input
                        value={item.title}
                        onChange={e => updateItem('title', e.target.value)}
                        placeholder="标题"
                    />
                </div>
                <div className="flex-[2]">
                    <Input
                        value={item.url || ''}
                        onChange={e => updateItem('url', e.target.value)}
                        placeholder="链接"
                    />
                </div>
                {/* 删除按钮 */}
                <Button variant="ghost" onClick={onDelete}>
                    <Icon icon="fa-solid fa-trash" className="text-red-400" />
                </Button>
            </div>

            {/* 第二行：图标设置 */}
            <div className="grid grid-cols-12 gap-2 items-end pl-8">
                {/* 图标模式 */}
                <div className="col-span-2">
                    <Label className="text-xs mb-1.5">图标模式</Label>
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                checked={iconMode === 'online'}
                                onChange={() => setIconMode('online')}
                                className="mr-1.5"
                            />
                            <span className="text-xs">🌐 在线</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                checked={iconMode === 'local'}
                                onChange={() => setIconMode('local')}
                                className="mr-1.5"
                            />
                            <span className="text-xs">📦 本地</span>
                        </label>
                    </div>
                </div>

                {/* 图标输入 */}
                <div className="col-span-5">
                    <Label className="text-xs mb-1.5">
                        {iconMode === 'online' ? '图标代码' : '本地图标路径'}
                    </Label>
                    <div className="relative">
                        <Icon icon={item.icon || 'fa-solid fa-image'} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <Input
                            className="pl-8"
                            value={item.icon || ''}
                            onChange={e => updateItem('icon', e.target.value)}
                            placeholder={iconMode === 'online' ? 'fa-xxx 或 mdi:xxx' : '/uploads/icon.png'}
                        />
                    </div>
                </div>

                {/* 图标操作 */}
                <div className="col-span-3">
                    <Label className="text-xs mb-1.5">图标操作</Label>
                    <div className="flex gap-1.5">
                        {iconMode === 'local' ? (
                            <>
                                <div className="flex-1 flex gap-1">
                                    <label className="cursor-pointer flex-1 px-2 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs flex items-center justify-center gap-1 whitespace-nowrap">
                                        <Icon icon="fa-solid fa-upload" />
                                        {uploading ? '上传' : '上传'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleIconUpload}
                                            disabled={uploading}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={() => setIsAssetPickerOpen(true)}
                                        className="flex-1 px-2 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs flex items-center justify-center gap-1 whitespace-nowrap"
                                    >
                                        <Icon icon="fa-solid fa-images" />
                                        浏览
                                    </button>
                                </div>
                                {item.icon &&
                                    !item.icon.startsWith('/uploads/') &&
                                    !item.icon.startsWith('/') && // Ensure local paths starting with / don't trigger download
                                    !item.icon.includes('fa-') &&
                                    !item.icon.includes(':') && (
                                        <button
                                            onClick={handleDownloadIcon}
                                            disabled={uploading}
                                            className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50"
                                        >
                                            <Icon icon="fa-solid fa-download" />
                                            下载
                                        </button>
                                    )}
                            </>
                        ) : (
                            <div className="flex-1 text-xs text-gray-500 px-3 py-2 bg-gray-100 rounded flex items-center justify-center h-[32px]">
                                支持 URL/图标库
                            </div>
                        )}
                    </div>

                    <AssetPickerModal
                        isOpen={isAssetPickerOpen}
                        onClose={() => setIsAssetPickerOpen(false)}
                        onSelect={(url) => {
                            updateItem('icon', url);
                            setIconMode('local');
                            setIsAssetPickerOpen(false);
                        }}
                    />
                </div>

                {/* 颜色选择 */}
                <div className="col-span-2">
                    <Label className="text-xs mb-1.5">图标颜色</Label>
                    <Input
                        type="color"
                        className="w-full h-10 !p-1 cursor-pointer"
                        value={item.color || '#000000'}
                        onChange={e => updateItem('color', e.target.value)}
                    />
                </div>
            </div>

            {/* Movement Section */}
            <div className="grid grid-cols-12 gap-2 pt-2 border-t border-gray-200">
                {/* Section Selection */}
                <div className="col-span-12 mb-1">
                    <Label className="text-xs mb-1">移动到</Label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                checked={selectedSection === 'promo'}
                                onChange={() => setSelectedSection('promo')}
                                className="mr-2"
                            />
                            <span className="text-sm">🔥 热门网址</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                checked={selectedSection === 'category'}
                                onChange={() => setSelectedSection('category')}
                                className="mr-2"
                            />
                            <span className="text-sm">📚 内容分类</span>
                        </label>
                    </div>
                </div>

                {/* Target Selection */}
                {selectedSection === 'promo' ? (
                    /* Promo Tab Selection */
                    <>
                        <div className="col-span-10">
                            <Label className="text-xs mb-1">目标标签页</Label>
                            <select
                                value={selectedPromoTab}
                                onChange={e => setSelectedPromoTab(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                            >
                                {config.promo.map((tab: any, idx: number) => (
                                    <option key={tab.id} value={tab.name}>
                                        {tab.name} {idx === tabIdx ? '(当前)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2 flex items-end">
                            <button
                                onClick={handleMoveClick}
                                disabled={!hasMovement}
                                className="w-full text-sm px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                            >
                                <Icon icon="fa-solid fa-arrows-turn-right" />
                                移动
                            </button>
                        </div>
                    </>
                ) : (
                    /* Category Selection */
                    <>
                        <div className="col-span-5">
                            <Label className="text-xs mb-1">目标分类</Label>
                            <select
                                value={selectedCategoryId}
                                onChange={e => {
                                    setSelectedCategoryId(e.target.value);
                                    setSelectedSubCategory('');
                                }}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                            >
                                {config.categories.map((cat: any) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {hasSubCategories && (
                            <div className="col-span-5">
                                <Label className="text-xs mb-1">目标子分类</Label>
                                <select
                                    value={selectedSubCategory}
                                    onChange={e => setSelectedSubCategory(e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                                >
                                    <option value="">主分类</option>
                                    {selectedCategory.subCategories!.map((sub: any) => (
                                        <option key={sub.name} value={sub.name}>
                                            {sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className={`${hasSubCategories ? 'col-span-2' : 'col-span-7'} flex items-end`}>
                            <button
                                onClick={handleMoveClick}
                                disabled={!hasMovement}
                                className="w-full text-sm px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                            >
                                <Icon icon="fa-solid fa-arrows-turn-right" />
                                移动
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const PromoSettings: React.FC = () => {
    const { config, setConfig } = useConfig();
    const update = setConfig;
    const { alertDialog, showAlert, hideAlert } = useDialogs();

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, type } = result;

        if (type === 'PROMO_TAB') {
            const items = Array.from(config.promo || []);
            const [removed] = items.splice(source.index, 1);
            items.splice(destination.index, 0, removed);
            update((c: any) => ({ ...c, promo: items }));
        } else if (type === 'PROMO_ITEM') {
            const sourceTabIdx = parseInt(source.droppableId.split('-')[1]);
            const destTabIdx = parseInt(destination.droppableId.split('-')[1]);
            const items = [...(config.promo || [])];
            if (!items[sourceTabIdx] || !items[destTabIdx]) return;
            const [removed] = items[sourceTabIdx].items.splice(source.index, 1);
            items[destTabIdx].items.splice(destination.index, 0, removed);
            update((c: any) => ({ ...c, promo: items }));
        }
    };

    const handleCrossSectionMove = (
        tabIdx: number,
        itemIdx: number,
        targetSection: 'category' | 'promo',
        targetId: string,
        targetSubId?: string
    ) => {
        if (targetSection === 'category') {
            const newConfig = { ...config };
            if (!newConfig.promo) return;
            const item = newConfig.promo[tabIdx].items[itemIdx];

            // Remove from promo
            newConfig.promo[tabIdx].items.splice(itemIdx, 1);

            // Add to category
            const targetCatIndex = newConfig.categories.findIndex(c => c.id === targetId);
            if (targetCatIndex !== -1) {
                const linkItem = {
                    id: item.id,
                    title: item.title,
                    url: item.url || '',
                    description: '',
                    icon: item.icon,
                    color: item.color
                };

                if (targetSubId) {
                    const targetSubIndex = newConfig.categories[targetCatIndex].subCategories!.findIndex(
                        s => s.name === targetSubId
                    );
                    if (targetSubIndex !== -1) {
                        newConfig.categories[targetCatIndex].subCategories![targetSubIndex].items.push(linkItem);
                    }
                } else {
                    if (!newConfig.categories[targetCatIndex].items) {
                        newConfig.categories[targetCatIndex].items = [];
                    }
                    newConfig.categories[targetCatIndex].items!.push(linkItem);
                }
            }

            update(c => ({ ...c, promo: newConfig.promo, categories: newConfig.categories }));
        }
    };

    return (
        <div className="space-y-8 pb-10">
            {/* 展示标题全局配置 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                        <Label className="!mb-0 font-bold text-gray-700">热门区域展示标题配置</Label>
                    </div>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-semibold text-gray-600">展示文案</Label>
                        <Input
                            value={config.theme?.promoTitle ?? '热门网址'}
                            placeholder="热门网址"
                            onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoTitle: e.target.value } }))}
                            className="h-10 transition-shadow focus:shadow-md"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-semibold text-gray-600">展示图标 (FontAwesome/Iconify)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    value={config.theme?.promoIcon || ''}
                                    placeholder="默认：fa-solid fa-fire"
                                    onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoIcon: e.target.value } }))}
                                    className="h-10 pl-10"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Icon icon={config.theme?.promoIcon || "fa-solid fa-fire"} />
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100 shadow-inner">
                                <Icon icon={config.theme?.promoIcon || "fa-solid fa-fire"} className="text-orange-500 text-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-800">链接内容管理</h3>
                        </div>
                        <Button onClick={() => update((c: any) => ({ ...c, promo: [...(c.promo || []), { id: Date.now().toString(), name: '新标签', items: [] }] }))} className="shadow-sm">
                            <Icon icon="fa-solid fa-plus" className="mr-2" />添加标签页
                        </Button>
                    </div>
                    <Droppable droppableId="promo-tabs" type="PROMO_TAB">
                        {(provided: any) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                                {(config.promo || []).map((tab: any, tabIdx: number) => (
                                    <Draggable key={tab.id} draggableId={tab.id} index={tabIdx}>
                                        {(provided: any) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps}>
                                                <Accordion
                                                    title={
                                                        <div className="flex items-center gap-2">
                                                            <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab hover:text-gray-600 px-1" onClick={e => e.stopPropagation()}>
                                                                <Icon icon="fa-solid fa-grip-vertical" />
                                                            </div>
                                                            <span>{tab.name}</span>
                                                        </div>
                                                    }
                                                    actions={<Button variant="danger" onClick={(e) => { e.stopPropagation(); update((c: any) => ({ ...c, promo: removeItem(c.promo || [], tabIdx) })); }}><Icon icon="fa-solid fa-trash" /></Button>}
                                                >
                                                    <div className="mb-4 grid grid-cols-2 gap-4">
                                                        <div><Label>名称</Label><Input value={tab.name} onChange={e => { const n = [...(config.promo || [])]; n[tabIdx].name = e.target.value; update((c: any) => ({ ...c, promo: n })) }} /></div>
                                                        <div><Label>链接</Label><Input value={tab.url || ''} onChange={e => { const n = [...(config.promo || [])]; n[tabIdx].url = e.target.value; update((c: any) => ({ ...c, promo: n })) }} /></div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Droppable droppableId={`promo-${tabIdx}`} type="PROMO_ITEM">
                                                            {(provided: any) => (
                                                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                                                                    {tab.items.map((item: any, itemIdx: number) => (
                                                                        <Draggable key={item.id} draggableId={item.id} index={itemIdx}>
                                                                            {(provided: any) => (
                                                                                <div
                                                                                    ref={provided.innerRef}
                                                                                    {...provided.draggableProps}
                                                                                    {...provided.dragHandleProps}
                                                                                >
                                                                                    <PromoItemEditor
                                                                                        item={item}
                                                                                        tabIdx={tabIdx}
                                                                                        itemIdx={itemIdx}
                                                                                        config={config}
                                                                                        update={update}
                                                                                        onDelete={() => {
                                                                                            const n = [...(config.promo || [])];
                                                                                            n[tabIdx].items = removeItem(n[tabIdx].items, itemIdx);
                                                                                            update((c: any) => ({ ...c, promo: n }));
                                                                                        }}
                                                                                        onMove={(targetTabIdx) => {
                                                                                            const n = [...(config.promo || [])];
                                                                                            const [movedItem] = n[tabIdx].items.splice(itemIdx, 1);
                                                                                            n[targetTabIdx].items.push(movedItem);
                                                                                            update((c: any) => ({ ...c, promo: n }));
                                                                                        }}
                                                                                        onCrossSectionMove={(targetSection, targetId, targetSubId) => {
                                                                                            handleCrossSectionMove(tabIdx, itemIdx, targetSection, targetId, targetSubId);
                                                                                        }}
                                                                                        currentTabName={tab.name}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </Draggable>
                                                                    ))}
                                                                    {provided.placeholder}
                                                                </div>
                                                            )}
                                                        </Droppable>
                                                        <Button variant="secondary" className="w-full border-dashed justify-center" onClick={() => { const n = [...(config.promo || [])]; n[tabIdx].items.push({ id: Date.now().toString(), title: '新项', url: '#', color: '#f00', icon: 'fa-solid fa-star', isAd: false }); update((c: any) => ({ ...c, promo: n })) }}>
                                                            <Icon icon="fa-solid fa-plus" /> 添加内容</Button>
                                                    </div>
                                                </Accordion>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>
        </div>
    );
};

export default PromoSettings;
