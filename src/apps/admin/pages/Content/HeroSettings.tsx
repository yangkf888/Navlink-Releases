import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useConfig } from '@/shared/context/ConfigContext';
import { Icon } from '@/shared/components/common/Icon';
import { Label, Input } from '@/shared/components/ui/AdminInput';
import { Button } from '@/shared/components/ui/AdminButton';
import { removeItem } from '@/shared/utils/url';

export const HeroSettings: React.FC = () => {
    const { config, setConfig } = useConfig();
    const update = setConfig;

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, type } = result;

        if (type === 'HERO_HOT_SEARCH_ITEM') {
            const items = Array.from(config.hero.hotSearchLinks || []);
            const [removed] = items.splice(source.index, 1);
            items.splice(destination.index, 0, removed);
            update(c => ({ ...c, hero: { ...c.hero, hotSearchLinks: items } }));
        } else if (type === 'SEARCH_ENGINE_ITEM') {
            const items = Array.from(config.searchEngines);
            const [removed] = items.splice(source.index, 1);
            items.splice(destination.index, 0, removed);
            update(c => ({ ...c, searchEngines: items }));
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">首屏文案</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><Label>主标题</Label><Input value={config.hero.title} onChange={e => update(c => ({ ...c, hero: { ...c.hero, title: e.target.value } }))} /></div>
                        <div><Label>副标题</Label><Input value={config.hero.subtitle} onChange={e => update(c => ({ ...c, hero: { ...c.hero, subtitle: e.target.value } }))} /></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 主标题 */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                            <Label className="!mb-0 font-bold text-gray-700">主标题样式</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input type="color" className="!w-16 !h-10 p-0.5 cursor-pointer rounded-lg border-gray-200 shrink-0 shadow-sm" value={config.theme?.heroTitleColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroTitleColor: e.target.value } }))} />
                            <Input className="flex-1 font-mono text-xs uppercase px-2 bg-gray-50/30 border-gray-100" value={config.theme?.heroTitleColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroTitleColor: e.target.value } }))} placeholder="#HEX" />
                            <div className="relative !w-28 shrink-0">
                                <Input type="number" className="w-full pr-8 px-2" placeholder="36" value={config.theme?.heroTitleSize} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroTitleSize: parseInt(e.target.value) } }))} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase pointer-events-none">px</span>
                            </div>
                        </div>
                    </div>

                    {/* 副标题 */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-blue-400 rounded-full"></div>
                            <Label className="!mb-0 font-bold text-gray-700">副标题样式</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input type="color" className="!w-16 !h-10 p-0.5 cursor-pointer rounded-lg border-gray-200 shrink-0 shadow-sm" value={config.theme?.heroSubtitleColor || '#bfdbfe'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSubtitleColor: e.target.value } }))} />
                            <Input className="flex-1 font-mono text-xs uppercase px-2 bg-gray-50/30 border-gray-100" value={config.theme?.heroSubtitleColor || '#bfdbfe'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSubtitleColor: e.target.value } }))} placeholder="#HEX" />
                            <div className="relative !w-28 shrink-0">
                                <Input type="number" className="w-full pr-8 px-2" placeholder="16" value={config.theme?.heroSubtitleSize} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSubtitleSize: parseInt(e.target.value) } }))} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase pointer-events-none">px</span>
                            </div>
                        </div>
                    </div>

                    {/* 热词按钮 */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                            <Label className="!mb-0 font-bold text-gray-700">热词按钮样式</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input type="color" className="!w-16 !h-10 p-0.5 cursor-pointer rounded-lg border-gray-200 shrink-0 shadow-sm" value={config.theme?.heroHotSearchColor || 'rgba(255,255,255,0.7)'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroHotSearchColor: e.target.value } }))} />
                            <Input className="flex-1 font-mono text-xs px-2 bg-gray-50/30 border-gray-100" value={config.theme?.heroHotSearchColor || 'rgba(255,255,255,0.7)'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroHotSearchColor: e.target.value } }))} placeholder="Color" />
                            <div className="relative !w-28 shrink-0">
                                <Input type="number" className="w-full pr-8 px-2" placeholder="14" value={config.theme?.heroHotSearchSize} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroHotSearchSize: parseInt(e.target.value) } }))} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase pointer-events-none">px</span>
                            </div>
                        </div>
                    </div>

                    {/* 搜索引擎 */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4 md:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
                            <div className="w-1.5 h-4 bg-green-600 rounded-full"></div>
                            <Label className="!mb-0 font-bold text-gray-700">搜索引擎样式个性化定制</Label>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-gray-400 font-medium ml-1 text-[11px]">常规状态色彩</span>
                                <div className="flex items-center gap-2">
                                    <Input type="color" className="!w-16 !h-10 p-0.5 cursor-pointer rounded-lg border-gray-200 shrink-0 shadow-sm" value={config.theme?.heroSearchEngineColor || 'rgba(255,255,255,0.8)'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSearchEngineColor: e.target.value } }))} />
                                    <Input className="flex-1 font-mono text-xs px-2 bg-gray-50/30 border-gray-100" value={config.theme?.heroSearchEngineColor || 'rgba(255,255,255,0.8)'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSearchEngineColor: e.target.value } }))} placeholder="Color" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-gray-400 font-medium ml-1 text-[11px]">选中状态色彩</span>
                                <div className="flex items-center gap-2">
                                    <Input type="color" className="!w-16 !h-10 p-0.5 cursor-pointer rounded-lg border-gray-200 shrink-0 shadow-sm" value={config.theme?.heroSearchEngineActiveColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSearchEngineActiveColor: e.target.value } }))} />
                                    <Input className="flex-1 font-mono text-xs uppercase px-2 bg-gray-50/30 border-gray-100" value={config.theme?.heroSearchEngineActiveColor || '#ffffff'} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSearchEngineActiveColor: e.target.value } }))} placeholder="#HEX" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-gray-400 font-medium ml-1 text-[11px]">字体显示字号</span>
                                <div className="relative w-full">
                                    <Input type="number" className="w-full pr-12 h-10 px-3" placeholder="15" value={config.theme?.heroSearchEngineSize} onChange={e => update(c => ({ ...c, theme: { ...c.theme, heroSearchEngineSize: parseInt(e.target.value) } }))} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-black uppercase pointer-events-none">px</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-6">
                    <div className="flex justify-between mb-4"><h3 className="text-lg font-bold">热词配置</h3><Button size="sm" onClick={() => update(c => ({ ...c, hero: { ...c.hero, hotSearchLinks: [...(c.hero.hotSearchLinks || []), { title: '新热词', url: '#' }] } }))}>添加</Button></div>
                    <Droppable droppableId="hero-hot-search" type="HERO_HOT_SEARCH_ITEM">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                                {config.hero.hotSearchLinks?.map((link, idx) => (
                                    <Draggable key={link.url + idx} draggableId={link.url + idx} index={idx}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} className="flex gap-3 items-center bg-gray-50 p-3 rounded border border-gray-200">
                                                <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab hover:text-gray-600 px-1">
                                                    <Icon icon="fa-solid fa-grip-vertical" />
                                                </div>
                                                <Input className="!w-32" value={link.title} onChange={e => { const n = [...(config.hero.hotSearchLinks || [])]; n[idx].title = e.target.value; update(c => ({ ...c, hero: { ...c.hero, hotSearchLinks: n } })) }} placeholder="热词" />
                                                <Input className="flex-1 min-w-0" value={link.url} onChange={e => { const n = [...(config.hero.hotSearchLinks || [])]; n[idx].url = e.target.value; update(c => ({ ...c, hero: { ...c.hero, hotSearchLinks: n } })) }} placeholder="跳转链接" />
                                                <button onClick={() => { const n = [...(config.hero.hotSearchLinks || [])]; n.splice(idx, 1); update(c => ({ ...c, hero: { ...c.hero, hotSearchLinks: n } })) }} className="text-gray-400 hover:text-red-500 px-2"><Icon icon="fa-solid fa-trash" /></button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
                <div>
                    <div className="flex justify-between mt-6 mb-4 border-b pb-2"><h3 className="text-lg font-bold">搜索引擎</h3><Button size="sm" onClick={() => update(c => ({ ...c, searchEngines: [...c.searchEngines, { id: Date.now().toString(), name: '新引擎', urlPattern: '', placeholder: '' }] }))}>添加</Button></div>
                    <Droppable droppableId="search-engines" type="SEARCH_ENGINE_ITEM">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                                {config.searchEngines.map((se, idx) => (
                                    <Draggable key={se.id} draggableId={se.id} index={idx}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} className="flex gap-3 items-center bg-gray-50 p-3 rounded border border-gray-200">
                                                <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab hover:text-gray-600 px-1">
                                                    <Icon icon="fa-solid fa-grip-vertical" />
                                                </div>
                                                <Input className="!w-32" value={se.name} onChange={e => { const n = [...config.searchEngines]; n[idx].name = e.target.value; update(c => ({ ...c, searchEngines: n })) }} placeholder="名称" />
                                                <Input className="flex-1 min-w-0" value={se.urlPattern} onChange={e => { const n = [...config.searchEngines]; n[idx].urlPattern = e.target.value; update(c => ({ ...c, searchEngines: n })) }} placeholder="搜索URL模板" />
                                                <button onClick={() => update(c => ({ ...c, searchEngines: removeItem(c.searchEngines, idx) }))} className="text-gray-400 hover:text-red-500 px-2"><Icon icon="fa-solid fa-trash" /></button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>

                {/* Search Keyboard Shortcut */}
                <div className="mt-6 border-t border-gray-100 pt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="text-lg font-bold text-blue-800 mb-3">搜索快捷键</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>快捷键组合</Label>
                            <Input
                                value={config.searchShortcut || 'Cmd+K'}
                                onChange={e => update(c => ({ ...c, searchShortcut: e.target.value }))}
                                placeholder="例如: Cmd+K 或 Ctrl+Shift+F"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                点击导航栏搜索图标或按快捷键即可打开全局搜索
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded border border-gray-200">
                            <Label className="!mb-2">常用组合键</Label>
                            <div className="space-y-1 text-xs text-gray-600">
                                <p>• <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Cmd+K</kbd> 默认(Mac自动转Ctrl)</p>
                                <p>• <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+K</kbd> Windows通用</p>
                                <p>• <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+Shift+F</kbd> 多键组合</p>
                                <p className="text-gray-400 italic mt-2">支持: Cmd, Ctrl, Shift, Alt + 任意字母/数字</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
};

export default HeroSettings;
