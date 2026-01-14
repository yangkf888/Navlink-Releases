import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SiteConfig, SearchEngine, LinkItem } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import { useDialogs } from '@/shared/hooks/useDialogs';
import { AlertDialog } from '@/shared/components/common/AlertDialog';
import { pinyin, match as pinyinMatch } from 'pinyin-pro';

// 历史记录配置
const HISTORY_KEY = 'navlink_search_history';
const MAX_HISTORY = 15;

// 历史记录项接口
interface HistoryItem {
    keyword: string;
    timestamp: number;
}

// Helper component to highlight matching text
const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim() || !text) return <>{text}</>;

    // 尝试拼音匹配获取高亮位置
    const matchResult = pinyinMatch(text, highlight, { continuous: true });

    if (matchResult && matchResult.length > 0) {
        // 使用拼音匹配结果高亮
        const chars = text.split('');
        return (
            <>
                {chars.map((char, i) =>
                    matchResult.includes(i)
                        ? <span key={i} className="text-[var(--theme-primary)] font-bold">{char}</span>
                        : char
                )}
            </>
        );
    }

    // 降级到普通文本匹配
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <span key={i} className="text-[var(--theme-primary)] font-bold">{part}</span>
                    : part
            )}
        </>
    );
};

const SearchHero = ({ config, isAuthenticated = false, onAIModeClick }: { config: SiteConfig, isAuthenticated?: boolean, onAIModeClick?: () => void }) => {
    const [activeEngineId, setActiveEngineId] = useState(config.searchEngines?.[0]?.id || '');
    const [keyword, setKeyword] = useState('');
    const { alertDialog, showAlert, hideAlert } = useDialogs();
    const inputRef = useRef<HTMLInputElement>(null);

    // Live Search State
    const [searchResults, setSearchResults] = useState<LinkItem[]>([]);
    const [historyResults, setHistoryResults] = useState<HistoryItem[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [hasUserInteracted, setHasUserInteracted] = useState(false); // 标记用户是否已开始输入
    const searchRef = useRef<HTMLDivElement>(null);

    const activeEngine = config.searchEngines?.find(e => e.id === activeEngineId) || config.searchEngines?.[0];

    // ========== 需求1: 自动聚焦 ==========
    useEffect(() => {
        // 延迟聚焦，确保 DOM 已渲染
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // ========== 需求2: 历史记录管理 ==========
    const getSearchHistory = (): HistoryItem[] => {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    };

    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        const history = getSearchHistory();
        // 移除重复项，添加到开头
        const filtered = history.filter(h => h.keyword.toLowerCase() !== term.toLowerCase());
        const updated: HistoryItem[] = [
            { keyword: term.trim(), timestamp: Date.now() },
            ...filtered
        ].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    };

    const removeFromHistory = (term: string) => {
        const history = getSearchHistory();
        const updated = history.filter(h => h.keyword !== term);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        // 刷新显示
        if (keyword.trim()) {
            const filtered = updated.filter(h =>
                h.keyword.toLowerCase().includes(keyword.toLowerCase()) ||
                pinyinMatch(h.keyword, keyword, { continuous: true })
            );
            setHistoryResults(filtered.slice(0, 5));
        } else {
            setHistoryResults(updated.slice(0, 5));
        }
    };

    const clearAllHistory = () => {
        localStorage.removeItem(HISTORY_KEY);
        setHistoryResults([]);
    };

    // Flatten all links from config for searching
    const getAllLinks = useMemo(() => {
        const links: LinkItem[] = [];

        // 1. Add Category Links (filter hidden categories if not authenticated)
        const visibleCategories = config.categories.filter(cat => isAuthenticated || !cat.hidden);
        visibleCategories.forEach(cat => {
            if (cat.items) links.push(...cat.items);
            if (cat.subCategories) {
                cat.subCategories.forEach(sub => links.push(...sub.items));
            }
        });

        // 2. Add Promo/Hot Links
        if (config.promo) {
            config.promo.forEach(tab => {
                if (tab.items) {
                    const promoLinks = tab.items.map(item => ({
                        id: item.id,
                        title: item.title,
                        url: item.url || '#',
                        description: `热门推荐: ${tab.name}`,
                        icon: item.icon,
                        color: item.color
                    }));
                    links.push(...promoLinks);
                }
            });
        }

        return links;
    }, [config, isAuthenticated]);

    // Handle Search Logic
    const handleSearch = (overrideKeyword?: string) => {
        const term = overrideKeyword !== undefined ? overrideKeyword : keyword;
        if (!term.trim()) return;

        // 保存到历史记录
        saveToHistory(term);

        if (activeEngine?.urlPattern) {
            window.open(activeEngine.urlPattern + encodeURIComponent(term), '_blank');
        } else {
            const match = getAllLinks.find(l => l.title.toLowerCase().includes(term.toLowerCase()));
            if (match) {
                window.open(match.url, '_blank');
            } else {
                showAlert('站内搜索', `"${term}" \n(提示：请输入更精确的关键词或点击下方自动匹配的结果)`, 'info');
            }
        }
        setShowDropdown(false);
        setKeyword('');
    };

    // ========== 需求3: 拼音匹配 + Live Search ==========
    useEffect(() => {
        const term = keyword.trim();
        const history = getSearchHistory();

        if (!term) {
            // 无输入时：只有用户主动交互后才显示历史记录
            setHistoryResults(history.slice(0, 5));
            setSearchResults([]);
            // 只有用户手动交互（点击或输入过）才显示历史，避免页面加载时就显示
            setShowDropdown(hasUserInteracted && history.length > 0);
            setSelectedIndex(-1);
            return;
        }

        const lowerTerm = term.toLowerCase();

        // 1. 匹配历史记录（支持拼音）
        const matchedHistory = history.filter(h => {
            // 原文匹配
            if (h.keyword.toLowerCase().includes(lowerTerm)) return true;
            // 拼音匹配
            const pMatch = pinyinMatch(h.keyword, term, { continuous: true });
            return pMatch && pMatch.length > 0;
        });
        setHistoryResults(matchedHistory.slice(0, 5));

        // 2. 匹配站内链接（支持拼音）
        const uniqueLinks = new Map();

        getAllLinks.forEach(item => {
            // 标题原文匹配
            const titleMatch = item.title.toLowerCase().includes(lowerTerm);
            // 描述原文匹配
            const descMatch = item.description && item.description.toLowerCase().includes(lowerTerm);
            // URL 匹配
            const urlMatch = item.url.toLowerCase().includes(lowerTerm);
            // 拼音匹配标题
            const pinyinTitleMatch = pinyinMatch(item.title, term, { continuous: true });

            if (titleMatch || descMatch || urlMatch || (pinyinTitleMatch && pinyinTitleMatch.length > 0)) {
                if (!uniqueLinks.has(item.url)) {
                    uniqueLinks.set(item.url, item);
                }
            }
        });

        const matches = Array.from(uniqueLinks.values());
        matches.sort((a, b) => a.title.localeCompare(b.title));

        setSearchResults(matches);
        setShowDropdown(matchedHistory.length > 0 || matches.length > 0);
        setSelectedIndex(-1);
    }, [keyword, config, isAuthenticated]);

    // 键盘导航
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const totalItems = historyResults.length + searchResults.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % totalItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                e.preventDefault();
                if (selectedIndex < historyResults.length) {
                    // 选中历史记录
                    const item = historyResults[selectedIndex];
                    setKeyword(item.keyword);
                    handleSearch(item.keyword);
                } else {
                    // 选中链接
                    const item = searchResults[selectedIndex - historyResults.length];
                    window.open(item.url, '_blank');
                    saveToHistory(keyword);
                    setShowDropdown(false);
                }
            } else {
                handleSearch();
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full flex flex-col items-center justify-center px-4 animate-fade-in relative z-30">
            <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
                <h1
                    className="text-4xl font-bold text-white mb-2 drop-shadow-lg text-center"
                    style={{
                        color: config.theme?.heroTitleColor,
                        fontSize: config.theme?.heroTitleSize ? `${config.theme.heroTitleSize}px` : undefined
                    }}
                >
                    {config.hero.title}
                </h1>
                <p
                    className="text-blue-200 mb-8 text-center"
                    style={{
                        color: config.theme?.heroSubtitleColor,
                        fontSize: config.theme?.heroSubtitleSize ? `${config.theme.heroSubtitleSize}px` : undefined
                    }}
                >
                    {config.hero.subtitle}
                </p>

                <div className="flex flex-wrap justify-center gap-6 mb-8 text-white/80 text-[15px] font-medium">
                    {config.searchEngines?.map(engine => (
                        <button
                            key={engine.id}
                            onClick={() => setActiveEngineId(engine.id)}
                            className={`pb-1 border-b-2 transition-all ${activeEngineId === engine.id ? 'border-[var(--theme-primary)] font-bold' : 'border-transparent hover:text-white'}`}
                            style={{
                                color: activeEngineId === engine.id
                                    ? (config.theme?.heroSearchEngineActiveColor || '#ffffff')
                                    : (config.theme?.heroSearchEngineColor || 'rgba(255,255,255,0.8)'),
                                fontSize: config.theme?.heroSearchEngineSize ? `${config.theme.heroSearchEngineSize}px` : undefined
                            }}
                        >
                            {engine.name}
                        </button>
                    ))}
                </div>

                <div ref={searchRef} className="w-full relative max-w-2xl mb-6 group">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={activeEngine?.placeholder}
                        value={keyword}
                        onChange={(e) => {
                            setHasUserInteracted(true); // 用户开始输入
                            setKeyword(e.target.value);
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            // 只有用户已经交互过（输入过内容），才在聚焦时显示历史
                            if (hasUserInteracted) {
                                const history = getSearchHistory();
                                if (keyword.trim() || history.length > 0) {
                                    setShowDropdown(true);
                                }
                            }
                        }}
                        onClick={() => {
                            // 用户主动点击搜索框，标记为已交互
                            setHasUserInteracted(true);
                            const history = getSearchHistory();
                            if (keyword.trim() || history.length > 0) {
                                setShowDropdown(true);
                            }
                        }}
                        className="w-full h-[54px] pl-6 pr-32 rounded-xl bg-white text-gray-700 outline-none shadow-2xl focus:ring-4 focus:ring-white/30 transition-all"
                    />
                    {/* 搜索按钮 */}
                    <button onClick={() => handleSearch()} className="absolute right-[60px] top-1.5 bottom-1.5 w-14 text-red-500 rounded-lg transition-all flex items-center justify-center hover:bg-gray-100">
                        <Icon icon="fa-solid fa-magnifying-glass" className="text-2xl" />
                    </button>
                    {/* AI 模式按钮 */}
                    {onAIModeClick && (
                        <button
                            onClick={onAIModeClick}
                            className="absolute right-1.5 top-1.5 bottom-1.5 w-14 bg-gray-200 text-red-500 rounded-lg transition-all flex items-center justify-center hover:border-2 hover:border-red-500 hover:bg-red-50"
                            title="AI 模式"
                        >
                            <Icon icon="fa-solid fa-robot" className="text-2xl" />
                        </button>
                    )}

                    {/* Live Search Dropdown Results */}
                    {showDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white mt-2 rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in text-left max-h-[400px] overflow-y-auto">
                            {/* 历史记录区域 */}
                            {historyResults.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                                        <span className="text-xs text-gray-500 font-medium">
                                            <Icon icon="fa-solid fa-clock-rotate-left" className="mr-1" />
                                            搜索历史
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearAllHistory(); }}
                                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            清空
                                        </button>
                                    </div>
                                    {historyResults.map((item, idx) => (
                                        <div
                                            key={`history-${item.keyword}`}
                                            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer group/item ${selectedIndex === idx ? 'bg-blue-50' : ''}`}
                                            onClick={() => {
                                                setKeyword(item.keyword);
                                                handleSearch(item.keyword);
                                            }}
                                        >
                                            <div className="w-9 h-9 flex items-center justify-center shrink-0 text-gray-400">
                                                <Icon icon="fa-solid fa-clock-rotate-left" className="text-lg" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-700 truncate">
                                                    <HighlightedText text={item.keyword} highlight={keyword} />
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFromHistory(item.keyword); }}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all p-1"
                                                title="删除此记录"
                                            >
                                                <Icon icon="fa-solid fa-times" />
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* 站内链接区域 */}
                            {searchResults.length > 0 && (
                                <>
                                    {historyResults.length > 0 && (
                                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                            <span className="text-xs text-gray-500 font-medium">
                                                <Icon icon="fa-solid fa-link" className="mr-1" />
                                                站内链接
                                            </span>
                                        </div>
                                    )}
                                    {searchResults.map((item, idx) => (
                                        <a
                                            key={item.id}
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none group/item ${selectedIndex === historyResults.length + idx ? 'bg-blue-50' : ''}`}
                                            onClick={() => {
                                                saveToHistory(keyword);
                                                setShowDropdown(false);
                                            }}
                                        >
                                            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: item.color || '#999' }}>
                                                {item.icon && (item.icon.includes('fa-') || item.icon.includes(':')) ? <Icon icon={item.icon} className="text-2xl" /> : <Icon icon="fa-solid fa-link" className="text-2xl" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-gray-800 truncate group-hover/item:text-[var(--theme-primary)] transition-colors">
                                                    <HighlightedText text={item.title} highlight={keyword} />
                                                </div>
                                                <div className="text-xs text-gray-400 truncate">
                                                    <HighlightedText text={item.description} highlight={keyword} />
                                                </div>
                                            </div>
                                            <Icon icon="fa-solid fa-arrow-up-right-from-square" className="text-gray-300 text-xs opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </>
                            )}

                            {/* 无结果提示 */}
                            {historyResults.length === 0 && searchResults.length === 0 && keyword.trim() && (
                                <div className="px-4 py-6 text-center text-gray-400">
                                    <Icon icon="fa-solid fa-search" className="text-2xl mb-2" />
                                    <p className="text-sm">未找到匹配结果</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-4 text-sm text-white/70">
                    {config.hero.hotSearchLinks?.map((link, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                if (link.url && link.url !== '#') {
                                    window.open(link.url, '_blank');
                                } else {
                                    setKeyword(link.title);
                                }
                            }}
                            className="hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm hover:bg-white/20 cursor-pointer"
                            style={{
                                color: config.theme?.heroHotSearchColor,
                                fontSize: config.theme?.heroHotSearchSize ? `${config.theme.heroHotSearchSize}px` : undefined
                            }}
                        >
                            {link.title}
                        </button>
                    ))}
                </div>
            </div>

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

export default SearchHero;