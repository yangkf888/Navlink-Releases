import React from 'react';
import { useConfig } from '@/shared/context/ConfigContext';
import { Icon } from '@/shared/components/common/Icon';
import { Label, Input, TextArea } from '@/shared/components/ui/AdminInput';
import { Button, ToggleButton, ButtonGroup } from '@/shared/components/ui/AdminButton';
import { useDialogs } from '@/shared/hooks/useDialogs';
import { AlertDialog } from '@/shared/components/common/AlertDialog';
import { ImagePicker } from '@/shared/components/common/ImagePicker';

// Helper component for subsection cards
const SettingsGroup: React.FC<{
    title: string;
    icon: string;
    iconColor?: string;
    children: React.ReactNode;
    description?: string;
}> = ({ title, icon, iconColor = 'text-gray-400', children, description }) => (
    <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 hover:border-gray-200 transition-colors">
        <div className="flex items-center gap-2 mb-1">
            <Icon icon={icon} className={`text-sm ${iconColor}`} />
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
        {description && <p className="text-xs text-gray-400 mb-4">{description}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-3">
            {children}
        </div>
    </div>
);

export const BasicSettings: React.FC = () => {
    const { config, setConfig } = useConfig();
    const update = setConfig;
    const { alertDialog, showAlert, hideAlert } = useDialogs();
    const isImageMode = typeof config.backgroundImage === 'string' && config.backgroundImage.length > 0;

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showAlert('文件太大', '图片大小不能超过 5MB', 'warning');
                return;
            }
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
                    update(c => ({ ...c, backgroundImage: data.url }));
                } else {
                    showAlert('上传失败', data.error || '未知错误', 'error');
                }
            } catch (err) {
                console.error('Upload failed:', err);
                showAlert('上传失败', '请重试', 'error');
            }
            e.target.value = '';
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showAlert('文件太大', '图片大小不能超过 5MB', 'warning');
                return;
            }
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
                    update(c => ({ ...c, logoUrl: data.url }));
                } else {
                    showAlert('上传失败', data.error || '未知错误', 'error');
                }
            } catch (err) {
                console.error('Upload failed:', err);
                showAlert('上传失败', '请重试', 'error');
            }
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* 1. Basic Info Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                    <Icon icon="fa-solid fa-circle-info" className="text-blue-500" /> 站点基本信息
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Label>品牌标识 (Logo)</Label>
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {config.logoUrl ? (
                                    <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <Icon icon="fa-solid fa-image" className="text-gray-300 text-xl" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Input value={config.logoUrl} onChange={e => update(c => ({ ...c, logoUrl: e.target.value }))} placeholder="Logo 图片 URL" />
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer bg-white border border-gray-300 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] text-gray-600 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-sm flex items-center gap-1">
                                        <Icon icon="fa-solid fa-cloud-arrow-up" /> 上传本地
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                    </label>
                                    <ImagePicker onSelect={(path) => update(c => ({ ...c, logoUrl: path }))} buttonText="图片库" buttonClassName="text-xs px-3 py-1.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <Label>站点名称 (显示在导航栏)</Label>
                            <Input value={config.siteName || 'Navlink'} onChange={e => update(c => ({ ...c, siteName: e.target.value }))} placeholder="网站标题" />
                        </div>
                        <div>
                            <Label>站点格言 (Header Quote)</Label>
                            <Input value={config.headerQuote} onChange={e => update(c => ({ ...c, headerQuote: e.target.value }))} placeholder="一句话简介" />
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <Label>页脚版权信息</Label>
                        <Input value={config.footer.copyright} onChange={e => update(c => ({ ...c, footer: { ...c.footer, copyright: e.target.value } }))} placeholder="© 2024 Navlink" />
                    </div>
                </div>
            </div>

            {/* 2. Style & Appearance Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                    <Icon icon="fa-solid fa-wand-magic-sparkles" className="text-purple-500" /> 主题风格与配色
                </h3>

                <div className="space-y-6">
                    {/* 1. 全局基调 */}
                    <SettingsGroup title="全局基调" icon="fa-solid fa-palette" iconColor="text-pink-500" description="影响整个站点的视觉风格">
                        <div>
                            <Label>品牌主色</Label>
                            <p className="text-xs text-gray-400 mb-1">按钮、选中态、强调元素</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.primaryColor || '#f1404b'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, primaryColor: e.target.value } }))} /><Input value={config.theme?.primaryColor || '#f1404b'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, primaryColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>页面底色</Label>
                            <p className="text-xs text-gray-400 mb-1">网页主背景色</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.backgroundColor || '#f1f2f3'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, backgroundColor: e.target.value } }))} /><Input value={config.theme?.backgroundColor || '#f1f2f3'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, backgroundColor: e.target.value } }))} /></div>
                        </div>
                    </SettingsGroup>

                    {/* 2. 顶部导航 */}
                    <SettingsGroup title="顶部导航" icon="fa-solid fa-window-maximize" iconColor="text-blue-400" description="导航栏文字颜色设置">
                        <div>
                            <Label>菜单文字</Label>
                            <p className="text-xs text-gray-400 mb-1">导航链接颜色，留空自动适配</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.navMenuColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, navMenuColor: e.target.value } }))} /><Input value={config.theme?.navMenuColor || ''} placeholder="自动" className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, navMenuColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>格言文字</Label>
                            <p className="text-xs text-gray-400 mb-1">首屏格言颜色，留空自动适配</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.quoteColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, quoteColor: e.target.value } }))} /><Input value={config.theme?.quoteColor || ''} placeholder="自动" className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, quoteColor: e.target.value } }))} /></div>
                        </div>
                    </SettingsGroup>

                    {/* 3. 热门/推广 */}
                    <SettingsGroup title="热门/推广" icon="fa-solid fa-fire" iconColor="text-orange-500" description="热门网址区域的样式设置">
                        <div>
                            <Label>区块背景</Label>
                            <p className="text-xs text-gray-400 mb-1">热门导航整体背景</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.promoBgColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoBgColor: e.target.value } }))} /><Input value={config.theme?.promoBgColor || '#ffffff'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>卡片背景</Label>
                            <p className="text-xs text-gray-400 mb-1">单个热门卡片底色</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.promoCardBgColor || '#f3f4f6'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoCardBgColor: e.target.value } }))} /><Input value={config.theme?.promoCardBgColor || '#f3f4f6'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoCardBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>卡片悬停</Label>
                            <p className="text-xs text-gray-400 mb-1">鼠标移入时高亮色</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.promoCardHoverBgColor || '#e5e7eb'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoCardHoverBgColor: e.target.value } }))} /><Input value={config.theme?.promoCardHoverBgColor || '#e5e7eb'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoCardHoverBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>标题字号 (px)</Label>
                            <p className="text-xs text-gray-400 mb-1">"热门网址"标题大小</p>
                            <Input type="number" min="10" max="40" value={config.theme?.promoCategoryTitleSize || 16} onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoCategoryTitleSize: parseInt(e.target.value) || 16 } }))} />
                        </div>
                        <div>
                            <Label>标签字号 (px)</Label>
                            <p className="text-xs text-gray-400 mb-1">Tab切换按钮字号</p>
                            <Input type="number" min="10" max="40" value={config.theme?.promoSubCategoryTitleSize || 12} onChange={e => update(c => ({ ...c, theme: { ...c.theme, promoSubCategoryTitleSize: parseInt(e.target.value) || 12 } }))} />
                        </div>
                    </SettingsGroup>

                    {/* 4. 内容分类 */}
                    <SettingsGroup title="内容分类" icon="fa-solid fa-grip" iconColor="text-indigo-500" description="分类板块区域的样式设置">
                        <div>
                            <Label>区块背景</Label>
                            <p className="text-xs text-gray-400 mb-1">分类板块整体背景</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.categoryBgColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryBgColor: e.target.value } }))} /><Input value={config.theme?.categoryBgColor || '#ffffff'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>卡片背景</Label>
                            <p className="text-xs text-gray-400 mb-1">链接卡片底色</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.categoryCardBgColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryCardBgColor: e.target.value } }))} /><Input value={config.theme?.categoryCardBgColor || '#ffffff'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryCardBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>卡片悬停</Label>
                            <p className="text-xs text-gray-400 mb-1">鼠标移入时高亮色，留空为透明主色</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.categoryCardHoverBgColor || ''} onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryCardHoverBgColor: e.target.value } }))} /><Input value={config.theme?.categoryCardHoverBgColor || ''} placeholder="透明主色" className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryCardHoverBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>标题字号 (px)</Label>
                            <p className="text-xs text-gray-400 mb-1">分类标题大小</p>
                            <Input type="number" min="10" max="40" value={config.theme?.categoryTitleSize || 20} onChange={e => update(c => ({ ...c, theme: { ...c.theme, categoryTitleSize: parseInt(e.target.value) || 20 } }))} />
                        </div>
                        <div>
                            <Label>标签字号 (px)</Label>
                            <p className="text-xs text-gray-400 mb-1">子分类按钮字号</p>
                            <Input type="number" min="10" max="40" value={config.theme?.subCategoryTitleSize || 12} onChange={e => update(c => ({ ...c, theme: { ...c.theme, subCategoryTitleSize: parseInt(e.target.value) || 12 } }))} />
                        </div>
                    </SettingsGroup>

                    {/* 5. 侧边栏 */}
                    <SettingsGroup title="侧边栏" icon="fa-solid fa-columns" iconColor="text-green-500" description="右侧模块区域的样式设置">
                        <div>
                            <Label>模块背景</Label>
                            <p className="text-xs text-gray-400 mb-1">热门网站/GitHub趋势等模块背景</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.theme?.sidebarHotBgColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, sidebarHotBgColor: e.target.value } }))} /><Input value={config.theme?.sidebarHotBgColor || '#ffffff'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, theme: { ...c.theme, sidebarHotBgColor: e.target.value } }))} /></div>
                        </div>
                        <div>
                            <Label>名片背景</Label>
                            <p className="text-xs text-gray-400 mb-1">个人介绍卡片背景</p>
                            <div className="flex gap-2"><Input type="color" className="w-10 h-10 p-1 rounded-lg" value={config.rightSidebar.profileCardBgColor || '#a18cd1'} onChange={e => update(c => ({ ...c, rightSidebar: { ...c.rightSidebar, profileCardBgColor: e.target.value } }))} /><Input value={config.rightSidebar.profileCardBgColor || '#a18cd1'} className="font-mono text-xs" onChange={e => update(c => ({ ...c, rightSidebar: { ...c.rightSidebar, profileCardBgColor: e.target.value } }))} /></div>
                        </div>
                    </SettingsGroup>
                </div>
            </div>

            {/* 3. Advanced Hero Settings */}
            <div className="bg-blue-50/70 p-6 rounded-2xl border border-blue-100 shadow-sm">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2 border-b border-blue-200 pb-3">
                    <Icon icon="fa-solid fa-window-restore" /> 首屏环境与沉浸式背景
                </h3>

                <div className="space-y-8">
                    {/* Layout Mode Selection */}
                    <div className="bg-white/80 p-4 rounded-xl border border-blue-100/50">
                        <Label className="mb-2">首页布局模式</Label>
                        <p className="text-xs text-gray-400 mb-3">控制首屏 Hero 区域的高度和显示方式</p>
                        <ButtonGroup>
                            <ToggleButton
                                active={(config.hero?.layoutMode || 'search') === 'search'}
                                onClick={() => update(c => ({ ...c, hero: { ...c.hero, layoutMode: 'search' } }))}
                            >
                                <Icon icon="fa-solid fa-search" className="mr-2" /> 搜索优先
                            </ToggleButton>
                            <ToggleButton
                                active={config.hero?.layoutMode === 'content'}
                                onClick={() => update(c => ({ ...c, hero: { ...c.hero, layoutMode: 'content' } }))}
                            >
                                <Icon icon="fa-solid fa-th-large" className="mr-2" /> 内容优先
                            </ToggleButton>
                            <ToggleButton
                                active={config.hero?.layoutMode === 'minimal'}
                                onClick={() => update(c => ({ ...c, hero: { ...c.hero, layoutMode: 'minimal' } }))}
                            >
                                <Icon icon="fa-solid fa-eye-slash" className="mr-2" /> 隐藏 Hero
                            </ToggleButton>
                        </ButtonGroup>
                        <p className="text-[10px] text-blue-400 mt-2 leading-relaxed">
                            搜索优先 = 首屏仅显示搜索框 | 内容优先 = 首屏直接显示导航链接 | 隐藏 Hero = 完全不显示 Hero 区域
                        </p>
                    </div>

                    {/* Background Selection - Only show when not minimal mode */}
                    {config.hero?.layoutMode !== 'minimal' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label>首屏展示模式</Label>
                                <ButtonGroup>
                                    <ToggleButton active={!isImageMode} onClick={() => update(c => ({ ...c, backgroundImage: '' }))}>
                                        <Icon icon="fa-solid fa-fill-drip" className="mr-2" /> 纯色背景
                                    </ToggleButton>
                                    <ToggleButton active={isImageMode} onClick={() => { if (!config.backgroundImage) update(c => ({ ...c, backgroundImage: ' ' })); }}>
                                        <Icon icon="fa-solid fa-image" className="mr-2" /> 氛围图片
                                    </ToggleButton>
                                </ButtonGroup>

                                {!isImageMode ? (
                                    <div className="animate-fade-in bg-white p-4 rounded-xl border border-blue-200/50">
                                        <Label>首屏主基调</Label>
                                        <div className="flex gap-4 items-center">
                                            <Input type="color" className="flex-1 h-10 p-1 cursor-pointer" value={config.hero.backgroundColor || config.theme?.navbarBgColor} onChange={e => update(c => ({ ...c, hero: { ...c.hero, backgroundColor: e.target.value } }))} />
                                            <span className="text-sm font-mono text-blue-600 flex-shrink-0">{config.hero.backgroundColor || config.theme?.navbarBgColor}</span>
                                        </div>
                                        <p className="text-[10px] text-blue-400 mt-2 leading-relaxed">提示：此颜色作为首屏顶部色，会自动向页面底色进行线性过渡渐变。</p>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in bg-white p-4 rounded-xl border border-blue-200/50 space-y-4">
                                        <div>
                                            <Label>背景图片 URL</Label>
                                            <Input value={config.backgroundImage?.trim() || ''} onChange={e => update(c => ({ ...c, backgroundImage: e.target.value }))} placeholder="https://..." />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="cursor-pointer bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                                                <Icon icon="fa-solid fa-upload" /> 上传本地
                                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                            </label>
                                            <ImagePicker onSelect={(path) => update(c => ({ ...c, backgroundImage: path }))} buttonText="从图片库选择" buttonClassName="text-xs px-4 py-2" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Image Preview */}
                            {isImageMode && config.backgroundImage && config.backgroundImage.length > 5 && (
                                <div className="relative group rounded-xl overflow-hidden border border-blue-200 shadow-inner min-h-[160px]">
                                    <img src={config.backgroundImage} alt="Hero Preview" className="w-full h-full object-cover absolute inset-0" />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 backdrop-blur rounded text-[10px] text-blue-800 font-bold border border-blue-100 shadow-lg flex items-center gap-1">
                                        预览效果 <Icon icon="fa-solid fa-eye" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navbar Interaction Panels */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-blue-200/50">
                        <div className="bg-white/50 p-4 rounded-xl border border-blue-100/50">
                            <Label className="mb-2">滚动前状态 (顶部锚点)</Label>
                            <ButtonGroup>
                                <ToggleButton active={config.hero.overlayNavbar !== false} onClick={() => update(c => ({ ...c, hero: { ...c.hero, overlayNavbar: true } }))} size="sm">
                                    沉浸悬浮 (透明)
                                </ToggleButton>
                                <ToggleButton active={config.hero.overlayNavbar === false} onClick={() => update(c => ({ ...c, hero: { ...c.hero, overlayNavbar: false } }))} size="sm">
                                    固定区域
                                </ToggleButton>
                            </ButtonGroup>
                        </div>
                        <div className="bg-white/50 p-4 rounded-xl border border-blue-100/50">
                            <Label className="mb-2">滚动后状态 (跟随模式)</Label>
                            <div className="flex items-center gap-3">
                                <ButtonGroup>
                                    <ToggleButton active={config.theme?.navbarBgColor === 'transparent'} onClick={() => update(c => ({ ...c, theme: { ...c.theme, navbarBgColor: 'transparent' } }))} size="sm">
                                        常驻透明
                                    </ToggleButton>
                                    <ToggleButton active={config.theme?.navbarBgColor === 'hero'} onClick={() => update(c => ({ ...c, theme: { ...c.theme, navbarBgColor: 'hero' } }))} size="sm">
                                        智能磨砂
                                    </ToggleButton>
                                </ButtonGroup>
                                <div className="flex items-center gap-2 border-l border-gray-200 pl-3 flex-1">
                                    <Input type="color" className="flex-1 h-8 p-1 rounded-md" value={(config.theme?.navbarBgColor !== 'hero' && config.theme?.navbarBgColor !== 'transparent') ? config.theme?.navbarBgColor : '#5d33f0'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, navbarBgColor: e.target.value } }))} />
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">固<br />定<br />色</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Alert System */}
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
    );
};

export default BasicSettings;
