import React, { useState, useEffect } from 'react';
import { LinkItem, Category } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import { Label, Input, TextArea } from '@/shared/components/ui/AdminInput';
import { Button } from '@/shared/components/ui/AdminButton';
import { useDialogs } from '@/shared/hooks/useDialogs';
import { AlertDialog } from '@/shared/components/common/AlertDialog';

interface LinkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: LinkItem) => void;
    onMove?: (item: LinkItem, targetCategoryId: string, targetSubCategoryName?: string) => void;
    initialItem?: LinkItem;
    title?: string;
    categories?: Category[];
    currentCategoryId?: string;
    currentSubCategoryName?: string;
    // Promo mode props
    promoTabs?: { name: string; id: string }[];
    currentPromoTab?: string;
    // Cross-section move support
    onCrossSectionMove?: (item: LinkItem, targetSection: 'category' | 'promo', targetId: string, targetSubId?: string) => void;
    enableCrossSectionMove?: boolean;
    currentSection?: 'category' | 'promo';
}

export const LinkEditModal: React.FC<LinkEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onMove,
    initialItem,
    title,
    categories,
    currentCategoryId,
    currentSubCategoryName,
    promoTabs,
    currentPromoTab,
    onCrossSectionMove,
    enableCrossSectionMove = false,
    currentSection
}) => {
    const [formData, setFormData] = useState<LinkItem>({
        id: '',
        title: '',
        url: '',
        description: '',
        icon: '',
        color: ''
    });

    const [selectedCategoryId, setSelectedCategoryId] = useState(currentCategoryId || '');
    const [selectedSubCategory, setSelectedSubCategory] = useState(currentSubCategoryName || '');
    const [selectedPromoTab, setSelectedPromoTab] = useState(currentPromoTab || '');
    const [selectedSection, setSelectedSection] = useState<'category' | 'promo'>(currentSection || 'category');
    const [iconMode, setIconMode] = useState<'local' | 'online'>('online');
    const [uploading, setUploading] = useState(false);
    const { alertDialog, showAlert, hideAlert } = useDialogs();

    // Determine if we're in promo mode
    const isPromoMode = !!promoTabs;

    const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
    const hasSubCategories = selectedCategory?.subCategories && selectedCategory.subCategories.length > 0;

    // Check if section or position changed
    const sectionChanged = enableCrossSectionMove && selectedSection !== currentSection;
    const positionChanged = isPromoMode
        ? selectedPromoTab !== currentPromoTab
        : (selectedCategoryId !== currentCategoryId || selectedSubCategory !== (currentSubCategoryName || ''));

    const hasMovement = enableCrossSectionMove ? (sectionChanged || positionChanged) : positionChanged;

    useEffect(() => {
        if (isOpen) {
            if (initialItem) {
                setFormData({ ...initialItem });
                // 自动检测图标模式
                if (initialItem.icon?.startsWith('/uploads/')) {
                    setIconMode('local');
                } else {
                    setIconMode('online');
                }
            } else {
                setFormData({
                    id: Date.now().toString(),
                    title: '',
                    url: '',
                    description: '',
                    icon: '',
                    color: ''
                });
                setIconMode('online');
            }
            setSelectedCategoryId(currentCategoryId || (categories?.[0]?.id || ''));
            setSelectedSubCategory(currentSubCategoryName || '');
            setSelectedPromoTab(currentPromoTab || (promoTabs?.[0]?.name || ''));
            setSelectedSection(currentSection || 'category');
        }
    }, [isOpen, initialItem, currentCategoryId, currentSubCategoryName, currentPromoTab, currentSection, categories, promoTabs]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Handle cross-section move
        if (enableCrossSectionMove && onCrossSectionMove && (sectionChanged || positionChanged)) {
            if (selectedSection === 'promo') {
                onCrossSectionMove(formData, 'promo', selectedPromoTab);
            } else {
                onCrossSectionMove(formData, 'category', selectedCategoryId, selectedSubCategory || undefined);
            }
        }
        // Handle same-section move
        else if (onMove && positionChanged) {
            if (isPromoMode) {
                // Promo mode: move to different tab
                onMove(formData, selectedPromoTab);
            } else if (categories) {
                // Category mode: move to different category/subcategory
                onMove(formData, selectedCategoryId, selectedSubCategory || undefined);
            }
        }
        // Handle save without move
        else {
            onSave(formData);
        }
        onClose();
    };

    // 处理图标文件上传
    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showAlert('文件过大', '图片大小不能超过 5MB', 'warning');
            return;
        }

        setUploading(true);
        const formDataObj = new FormData();
        formDataObj.append('image', file);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataObj
            });
            const data = await response.json();
            if (data.url) {
                setFormData({ ...formData, icon: data.url });
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

    // 下载远程图标到服务器
    const handleDownloadIcon = async () => {
        if (!formData.icon || formData.icon.startsWith('/uploads/')) return;

        // 判断是否为图标代码
        const isIconCode = formData.icon.includes('fa-') || formData.icon.includes(':');
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
                body: JSON.stringify({ iconUrl: formData.icon })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '下载失败');
            }

            const data = await response.json();
            setFormData({ ...formData, icon: data.url });
            setIconMode('local');
            showAlert('下载成功', '图标已下载到服务器', 'success');
        } catch (err: any) {
            console.error('Download icon failed:', err);
            showAlert('下载失败', (err as Error).message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">{title || (initialItem ? '编辑链接' : '添加链接')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <Icon icon="fa-solid fa-times" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <Label>标题 <span className="text-red-500">*</span></Label>
                        <Input
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="例如: Google"
                            required
                        />
                    </div>

                    <div>
                        <Label>链接地址 <span className="text-red-500">*</span></Label>
                        <Input
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
                            required
                        />
                    </div>

                    <div>
                        <Label>描述</Label>
                        <TextArea
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="简短的描述..."
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>图标模式</Label>
                        <div className="flex gap-4 mb-2">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    checked={iconMode === 'online'}
                                    onChange={() => setIconMode('online')}
                                    className="mr-2"
                                />
                                <span className="text-sm">🌐 在线图标</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    checked={iconMode === 'local'}
                                    onChange={() => setIconMode('local')}
                                    className="mr-2"
                                />
                                <span className="text-sm">📦 本地图标</span>
                            </label>
                        </div>

                        {iconMode === 'online' ? (
                            <div className="relative">
                                <div className="absolute left-3 top-2.5 w-5 h-5 flex items-center justify-center text-gray-400">
                                    {formData.icon ? (
                                        formData.icon.includes('fa-') || formData.icon.includes(':') ?
                                            <Icon icon={formData.icon} /> :
                                            <img src={formData.icon} alt="" className="w-full h-full object-contain" />
                                    ) : <Icon icon="fa-solid fa-link" />}
                                </div>
                                <Input
                                    className="pl-10"
                                    value={formData.icon || ''}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="fa-brands fa-google 或 mdi:google 或 URL"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative">
                                    <div className="absolute left-3 top-2.5 w-5 h-5 flex items-center justify-center text-gray-400">
                                        {formData.icon && formData.icon.startsWith('/uploads/') ? (
                                            <img src={formData.icon} alt="" className="w-full h-full object-contain" />
                                        ) : <Icon icon="fa-solid fa-image" />}
                                    </div>
                                    <Input
                                        className="pl-10"
                                        value={formData.icon || ''}
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                        placeholder="/uploads/icon.png"
                                        readOnly
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <label className="cursor-pointer flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-2">
                                        <Icon icon="fa-solid fa-upload" />
                                        {uploading ? '上传中...' : '上传图片'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleIconUpload}
                                            disabled={uploading}
                                            className="hidden"
                                        />
                                    </label>
                                    {formData.icon && !formData.icon.startsWith('/uploads/') && !formData.icon.includes('fa-') && !formData.icon.includes(':') && (
                                        <button
                                            type="button"
                                            onClick={handleDownloadIcon}
                                            disabled={uploading}
                                            className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Icon icon="fa-solid fa-download" />
                                            下载图标
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>图标颜色</Label>
                        <Input
                            type="color"
                            className="w-full h-[38px] !p-1 cursor-pointer"
                            value={formData.color || '#000000'}
                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                            title={formData.color || '#000000'}
                        />
                    </div>

                    {/* Category/PromoTab Movement Section */}
                    {((categories && categories.length > 0) || (promoTabs && promoTabs.length > 0)) && (onMove || onCrossSectionMove) && (
                        <div className="pt-4 border-t border-gray-200 space-y-3">
                            {/* Section Selection (if cross-section move enabled) */}
                            {enableCrossSectionMove && categories && promoTabs && (
                                <div>
                                    <Label>移动到</Label>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={selectedSection === 'category'}
                                                onChange={() => setSelectedSection('category')}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">📚 内容分类</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={selectedSection === 'promo'}
                                                onChange={() => setSelectedSection('promo')}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">🔥 热门网址</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Target Selection */}
                            {(enableCrossSectionMove ? selectedSection === 'promo' : isPromoMode) ? (
                                /* Promo Tab Selection */
                                <div>
                                    <Label>目标标签页</Label>
                                    <select
                                        value={selectedPromoTab}
                                        onChange={e => setSelectedPromoTab(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                                    >
                                        {promoTabs!.map(tab => (
                                            <option key={tab.id} value={tab.name}>
                                                {tab.name} {tab.name === currentPromoTab && currentSection === 'promo' ? '(当前)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                /* Category & Subcategory Selection */
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>目标分类</Label>
                                        <select
                                            value={selectedCategoryId}
                                            onChange={e => {
                                                setSelectedCategoryId(e.target.value);
                                                setSelectedSubCategory('');
                                            }}
                                            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                                        >
                                            {categories!.map(cat => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name} {cat.id === currentCategoryId && currentSection === 'category' && !currentSubCategoryName ? '(当前)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {hasSubCategories && (
                                        <div>
                                            <Label>目标子分类</Label>
                                            <select
                                                value={selectedSubCategory}
                                                onChange={e => setSelectedSubCategory(e.target.value)}
                                                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                                            >
                                                <option value="">主分类</option>
                                                {selectedCategory.subCategories!.map(sub => (
                                                    <option key={sub.name} value={sub.name}>
                                                        {sub.name} {selectedCategoryId === currentCategoryId && currentSection === 'category' && sub.name === currentSubCategoryName ? '(当前)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                            {hasMovement && (
                                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                                    <Icon icon="fa-solid fa-info-circle" />
                                    {sectionChanged ? '链接将移动到不同板块' : '链接将移动到新位置'}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
                        <Button type="submit">{hasMovement ? '保存并移动' : '保存'}</Button>
                    </div>
                </form>

                {alertDialog && (
                    <AlertDialog
                        isOpen={alertDialog.isOpen}
                        title={alertDialog.title}
                        message={alertDialog.message}
                        variant={alertDialog.variant}
                        onClose={hideAlert}
                    />
                )}
            </div>
        </div>
    );
};
