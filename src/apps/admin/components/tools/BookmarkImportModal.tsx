import React, { useState, useRef } from 'react';
import { BookmarkParser } from '@/shared/utils/BookmarkParser';
import { Category } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import { Button } from '@/shared/components/ui/AdminButton';

interface BookmarkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (categories: Category[]) => void;
}

export const BookmarkImportModal: React.FC<BookmarkImportModalProps> = ({
    isOpen,
    onClose,
    onImport,
}) => {
    const [parsing, setParsing] = useState(false);
    const [parsedData, setParsedData] = useState<Category[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoFetchIcons, setAutoFetchIcons] = useState(true);
    const [importProgress, setImportProgress] = useState<{ current: number, total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.html')) {
            setError('请上传 Chrome 导出的 HTML 书签文件');
            return;
        }

        setParsing(true);
        setError(null);

        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                const parser = new BookmarkParser();
                const data = parser.parse(text);
                setParsedData(data);
                setParsing(false);
            };
            reader.readAsText(file);
        } catch (err) {
            console.error('Parse failed:', err);
            setError('解析失败');
            setParsing(false);
        }
    };

    const handleImportClick = async () => {
        if (!parsedData) return;

        let finalData = JSON.parse(JSON.stringify(parsedData)) as Category[];

        if (autoFetchIcons) {
            const links: { catIdx: number, subIdx?: number, itemIdx: number, url: string }[] = [];

            finalData.forEach((cat, cIdx) => {
                cat.items?.forEach((item, iIdx) => links.push({ catIdx: cIdx, itemIdx: iIdx, url: item.url }));
                cat.subCategories?.forEach((sub, sIdx) => {
                    sub.items.forEach((item, iIdx) => links.push({ catIdx: cIdx, subIdx: sIdx, itemIdx: iIdx, url: item.url }));
                });
            });

            setImportProgress({ current: 0, total: links.length });

            const token = localStorage.getItem('auth_token');
            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                setImportProgress({ current: i + 1, total: links.length });
                try {
                    const res = await fetch('/api/download-icon', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ iconUrl: link.url }) // 使用网站 URL 尝试抓取
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.url) {
                            if (link.subIdx !== undefined) {
                                finalData[link.catIdx].subCategories![link.subIdx].items[link.itemIdx].icon = data.url;
                            } else {
                                finalData[link.catIdx].items![link.itemIdx].icon = data.url;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Fetch icon failed for:', link.url);
                }
            }
        }

        onImport(finalData);
        setImportProgress(null);
        onClose();
    };

    const totalLinks = parsedData?.reduce((acc, cat) => {
        let count = cat.items?.length || 0;
        if (cat.subCategories) {
            count += cat.subCategories.reduce((sAcc, sub) => sAcc + sub.items.length, 0);
        }
        return acc + count;
    }, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Icon icon="fa-brands fa-chrome" className="text-orange-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">导入 Chrome 书签</h3>
                            <p className="text-xs text-gray-500">仅支持 .html 格式的书签文件</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <Icon icon="fa-solid fa-xmark" className="text-xl" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {!parsedData ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center gap-4 hover:border-orange-400 hover:bg-orange-50/30 transition-all cursor-pointer group"
                        >
                            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon icon="fa-solid fa-cloud-arrow-up" className="text-3xl text-orange-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-gray-700">点击或将书签文件拖拽到此处</p>
                                <p className="text-sm text-gray-400 mt-1">支持从 Chrome、Edge 等浏览器导出的 .html 文件</p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".html"
                                className="hidden"
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-orange-600 leading-tight">{parsedData.length}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">识别分类</p>
                                    </div>
                                    <div className="w-px h-8 bg-orange-200"></div>
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-orange-600 leading-tight">{totalLinks}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">识别链接</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setParsedData(null)} className="text-orange-700 hover:bg-orange-100" disabled={!!importProgress}>
                                    重新上传
                                </Button>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${autoFetchIcons ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                                        <Icon icon="fa-solid fa-wand-magic-sparkles" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-700">全自动图标适配</p>
                                        <p className="text-[10px] text-gray-500">建议开启：导入后自动逐个下载网站真实的 Favicon</p>
                                    </div>
                                </div>
                                <div
                                    onClick={() => !importProgress && setAutoFetchIcons(!autoFetchIcons)}
                                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${autoFetchIcons ? 'bg-green-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoFetchIcons ? 'left-7' : 'left-1'}`} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-bold text-gray-700">解析预览</p>
                                <div className="space-y-2 border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-50">
                                    {parsedData.slice(0, 5).map((cat, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50/30 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Icon icon={cat.icon} className="text-gray-400" />
                                                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                            </div>
                                            <span className="text-xs bg-white border border-gray-100 px-2 py-0.5 rounded text-gray-400">
                                                {cat.items?.length || 0} 项 {cat.subCategories ? `+ ${cat.subCategories.length} 子类` : ''}
                                            </span>
                                        </div>
                                    ))}
                                    {parsedData.length > 5 && (
                                        <div className="p-2 text-center text-xs text-gray-400 italic">... 以及另外 {parsedData.length - 5} 个分类</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                            <Icon icon="fa-solid fa-circle-exclamation" />
                            {error}
                        </div>
                    )}

                    {parsing && (
                        <div className="mt-4 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                            <p className="text-xs text-gray-500">正在解析书签...</p>
                        </div>
                    )}
                </div>

                {/* Import Progress Footer */}
                {importProgress && (
                    <div className="px-6 py-4 bg-orange-50/50 border-t border-orange-100 animate-pulse">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-orange-700">正在抓取并同步图标信息...</span>
                            <span className="text-xs font-mono text-orange-600">{importProgress.current} / {importProgress.total}</span>
                        </div>
                        <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 transition-all duration-300 ease-out"
                                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-orange-400 mt-2 text-center italic">请勿关闭弹窗，任务完成后将自动保存</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={parsing || !!importProgress}>取消</Button>
                    <Button
                        onClick={handleImportClick}
                        disabled={!parsedData || parsing || !!importProgress}
                        className="bg-orange-500 hover:bg-orange-600 shadow-orange-100 shadow-lg"
                    >
                        {importProgress ? '正在导入...' : '开始正式导入'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
