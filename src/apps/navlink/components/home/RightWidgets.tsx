import React, { useState } from 'react';
import useSWR from 'swr';
import { SiteConfig, LinkItem } from '@/shared/types';
import { Icon } from '@/shared/components/common/Icon';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import { getContrastColor } from '@/shared/utils/color';

// SWR fetcher function
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('API request failed');
    return res.json();
});

const RightWidgetsContent = ({ config }: { config: SiteConfig }) => {
    const { profile, hotTopics, githubTrending } = config.rightSidebar;

    // Fallbacks
    const currentHotTopics = hotTopics || [];
    const [activeHotTab, setActiveHotTab] = useState(0);

    // Github Trending State
    const ghConfig = githubTrending || {
        title: 'Github 榜单',
        apiUrl: 'https://api.github.com/search/repositories',
        webUrl: 'https://github.com/trending'
    };
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    // Use SWR for Hot Topics - 5 minute cache
    const currentTopic = currentHotTopics[activeHotTab];
    const { data: hotResponse, error: hotError } = useSWR(
        currentTopic?.apiUrl || null,
        fetcher,
        {
            refreshInterval: 300000, // 5 minutes
            revalidateOnFocus: false,
            dedupingInterval: 60000, // Dedupe requests within 1 minute
        }
    );

    const hotLoading = !hotResponse && !hotError && !!currentTopic?.apiUrl;
    const hotList = hotResponse?.data || hotResponse?.result || hotResponse?.items || [];
    const limit = currentTopic?.limit || 5;
    const hotData = Array.isArray(hotList) ? hotList.slice(0, limit) : [];

    // Use SWR for GitHub Trending - 5 minute cache
    const getGithubUrl = () => {
        const date = new Date();
        let days = 1;
        if (timeRange === 'weekly') days = 7;
        if (timeRange === 'monthly') days = 30;

        date.setDate(date.getDate() - days);
        const dateStr = date.toISOString().split('T')[0];
        return `${ghConfig.apiUrl}?q=created:>${dateStr}&sort=stars&order=desc&per_page=5`;
    };

    const { data: githubData, error: ghError } = useSWR(
        getGithubUrl(),
        fetcher,
        {
            refreshInterval: 300000, // 5 minutes
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    const ghLoading = !githubData && !ghError;
    const repos = githubData?.items || [];

    const formatStars = (count: number) => {
        if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
        return count;
    };

    const getTrendingUrl = () => {
        const map = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };
        return `${ghConfig.webUrl}?since=${map[timeRange]}`;
    };

    // -------------------------------------------------------------------------
    // Profile Card Style Detection
    // -------------------------------------------------------------------------
    const profileBg = config.rightSidebar.profileCardBgColor;
    const profileContrastColor = getContrastColor(profileBg || '#a18cd1');
    const isProfileDarkBg = profileContrastColor === '#ffffff';

    return (
        <div className="space-y-6">
            {/* Profile Card */}
            <div
                className={`rounded-xl p-6 relative overflow-hidden group shadow-lg ${!profileBg ? 'bg-gradient-to-br from-[#a18cd1] to-[#fbc2eb]' : ''}`}
                style={profileBg ? { backgroundColor: profileBg } : {}}
            >
                <div className={`absolute inset-0 ${isProfileDarkBg ? 'bg-black/10' : 'bg-white/10'}`}></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-full p-1 mb-3 backdrop-blur-sm ${isProfileDarkBg ? 'bg-white/30' : 'bg-black/10'}`}>
                        {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover shadow-inner" />
                        ) : (
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-inner">
                                <span className="text-[#a18cd1] text-2xl font-black" style={{ color: profileBg || '#a18cd1' }}>
                                    {profile.logoText}
                                </span>
                            </div>
                        )}
                    </div>
                    <h3
                        className="font-bold text-xl drop-shadow-md"
                        style={{ color: profileContrastColor }}
                    >
                        {profile.title}
                    </h3>
                    <p
                        className="text-xs mt-1 mb-5 font-medium opacity-90"
                        style={{ color: profileContrastColor }}
                    >
                        {profile.description}
                    </p>
                    <div className="flex space-x-5 text-xl" style={{ color: profileContrastColor }}>
                        {Array.isArray(profile?.socials) && profile.socials.map((s, i) => (
                            <a key={i} href={s.url} className="hover:scale-110 transition-transform cursor-pointer opacity-80 hover:opacity-100">
                                <Icon icon={s.icon} />
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hot Topics Widget */}
            <div
                className="rounded-xl p-5 shadow-sm border animate-fade-in transition-all duration-500"
                style={{
                    backgroundColor: config.theme?.sidebarHotBgColor || '#ffffff',
                    borderColor: config.theme?.sidebarHotBgColor || '#ffffff'
                }}
            >
                {(() => {
                    const bgColor = config.theme?.sidebarHotBgColor || '#ffffff';
                    const contrastColor = getContrastColor(bgColor);
                    const isDarkBg = contrastColor === '#ffffff';

                    return (
                        <>
                            <div className={`flex items-center gap-2 mb-4 border-b pb-2 justify-between ${isDarkBg ? 'border-white/10' : 'border-gray-50'}`}>
                                {Array.isArray(currentHotTopics) && currentHotTopics.map((topic, idx) => (
                                    <button
                                        key={topic.id}
                                        onClick={() => setActiveHotTab(idx)}
                                        className={`
                                            text-xs px-2 py-1 rounded-md transition-all font-medium
                                            ${activeHotTab === idx
                                                ? 'bg-[var(--theme-primary)]'
                                                : isDarkBg ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                                        `}
                                        style={{
                                            color: activeHotTab === idx
                                                ? getContrastColor(config.theme?.primaryColor || '#f1404b')
                                                : undefined
                                        }}
                                    >
                                        {topic.name}
                                    </button>
                                ))}
                            </div>

                            <div className="min-h-[180px]">
                                {hotLoading ? (
                                    <div className={`flex justify-center items-center h-40 flex-col gap-2 ${isDarkBg ? 'text-white/30' : 'text-gray-300'}`}>
                                        <Icon icon="fa-solid fa-circle-notch" className="text-xl animate-spin" />
                                        <span className="text-xs">加载中...</span>
                                    </div>
                                ) : hotError ? (
                                    <div className="flex justify-center items-center h-40 flex-col gap-1">
                                        <Icon icon="fa-solid fa-triangle-exclamation" className="text-lg text-yellow-400" />
                                        <span className={`text-xs ${isDarkBg ? 'text-white/60' : 'text-gray-400'}`}>获取数据失败</span>
                                        <span className={`text-[10px] ${isDarkBg ? 'text-white/30' : 'opacity-60 text-gray-400'}`}>请检查网络或API配置</span>
                                    </div>
                                ) : (
                                    <ul className="space-y-3">
                                        {hotData.length > 0 ? hotData.map((item, index) => (
                                            <a key={index} href={item.url || item.link || item.mobileUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 group cursor-pointer">
                                                <span className={`
                                                    text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[18px] text-center flex-shrink-0
                                                    ${index === 0 ? 'bg-[#ff4d4f] text-white' :
                                                        index === 1 ? 'bg-[#ff7a45] text-white' :
                                                            index === 2 ? 'bg-[#ffa940] text-white' : isDarkBg ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}
                                                `}>{index + 1}</span>
                                                <span
                                                    className="text-xs font-medium group-hover:text-[var(--theme-primary)] transition-colors truncate"
                                                    style={{ color: isDarkBg ? 'rgba(255,255,255,0.85)' : '#374151' }}
                                                >
                                                    {item.title || item.name}
                                                </span>
                                                {item.hot && <span className={`ml-auto text-[10px] scale-90 ${isDarkBg ? 'text-white/30' : 'text-gray-400'}`}>{item.hot}</span>}
                                            </a>
                                        )) : (
                                            <div className={`text-center text-xs py-10 ${isDarkBg ? 'text-white/30' : 'text-gray-400'}`}>
                                                暂无数据或接口不可用
                                            </div>
                                        )}
                                    </ul>
                                )}
                            </div>

                            {currentHotTopics[activeHotTab] && (
                                <a
                                    href={currentHotTopics[activeHotTab].webUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`block text-center text-xs mt-4 pt-3 border-t hover:text-[var(--theme-primary)] transition-colors ${isDarkBg ? 'text-white/40 border-white/10' : 'text-gray-400 border-gray-50'}`}
                                >
                                    查看更多 <Icon icon="fa-solid fa-angle-right" className="ml-1" />
                                </a>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Github Trending */}
            <div
                className="rounded-xl p-5 shadow-sm border animate-fade-in transition-all duration-500"
                style={{
                    backgroundColor: config.theme?.sidebarHotBgColor || '#ffffff',
                    borderColor: config.theme?.sidebarHotBgColor || '#ffffff'
                }}
            >
                {(() => {
                    const bgColor = config.theme?.sidebarHotBgColor || '#ffffff';
                    const contrastColor = getContrastColor(bgColor);
                    const isDarkBg = contrastColor === '#ffffff';

                    return (
                        <>
                            <div className={`flex items-center justify-between mb-4 border-b pb-3 ${isDarkBg ? 'border-white/10' : 'border-gray-50'}`}>
                                <div className="flex items-center gap-2">
                                    <Icon icon="fa-brands fa-github" className={`text-lg ${isDarkBg ? 'text-white' : 'text-black'}`} />
                                    <span className={`font-bold text-sm ${isDarkBg ? 'text-white/90' : 'text-gray-700'}`}>{ghConfig.title}</span>
                                </div>
                                <div className={`flex rounded-lg p-0.5 ${isDarkBg ? 'bg-white/10' : 'bg-gray-100'}`}>
                                    {[
                                        { id: 'daily', label: '日' },
                                        { id: 'weekly', label: '周' },
                                        { id: 'monthly', label: '月' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTimeRange(t.id as any)}
                                            className={`
                                                text-xs px-2 py-0.5 rounded-md transition-all
                                                ${timeRange === t.id
                                                    ? (isDarkBg ? 'bg-white/20 text-white shadow-sm font-bold' : 'bg-white text-[var(--theme-primary)] shadow-sm font-bold')
                                                    : (isDarkBg ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600')}
                                            `}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="min-h-[200px]">
                                {ghLoading ? (
                                    <div className={`flex justify-center items-center h-48 flex-col gap-2 ${isDarkBg ? 'text-white/30' : 'text-gray-300'}`}>
                                        <Icon icon="fa-solid fa-circle-notch" className="text-xl animate-spin" />
                                        <span className="text-xs">加载中...</span>
                                    </div>
                                ) : ghError ? (
                                    <div className="flex justify-center items-center h-48 flex-col gap-1">
                                        <Icon icon="fa-solid fa-triangle-exclamation" className="text-lg text-yellow-400" />
                                        <span className={`text-xs ${isDarkBg ? 'text-white/60' : 'text-gray-400'}`}>请求受限或失败</span>
                                        <span className={`text-[10px] ${isDarkBg ? 'text-white/30' : 'opacity-60 text-gray-400'}`}>API Rate Limited</span>
                                    </div>
                                ) : (
                                    <ul className="space-y-3">
                                        {repos.length > 0 ? repos.map((repo: any, index: number) => (
                                            <a key={repo.id} href={repo.html_url} target="_blank" rel="noreferrer" className="flex items-start justify-between group cursor-pointer">
                                                <div className="flex items-start gap-2.5 overflow-hidden">
                                                    <span className={`
                                                        text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[18px] text-center mt-0.5 flex-shrink-0
                                                        ${index === 0 ? 'bg-[#ff4d4f] text-white' :
                                                            index === 1 ? 'bg-[#ff7a45] text-white' :
                                                                index === 2 ? 'bg-[#ffa940] text-white' : isDarkBg ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}
                                                    `}>{index + 1}</span>
                                                    <div className="flex flex-col overflow-hidden min-w-0">
                                                        <span
                                                            className="text-xs font-medium group-hover:text-[var(--theme-primary)] transition-colors truncate"
                                                            title={repo.full_name}
                                                            style={{ color: isDarkBg ? 'rgba(255,255,255,0.85)' : '#374151' }}
                                                        >
                                                            {repo.name}
                                                        </span>
                                                        <span className={`text-[10px] truncate ${isDarkBg ? 'text-white/40' : 'text-gray-400'}`} title={repo.description}>{repo.description || '暂无描述'}</span>
                                                    </div>
                                                </div>
                                                <div className={`flex items-center gap-1 text-[10px] mt-0.5 flex-shrink-0 ${isDarkBg ? 'text-white/40' : 'text-gray-400'}`}>
                                                    <Icon icon="fa-solid fa-star" className="text-[10px] text-orange-400" />
                                                    <span>{formatStars(repo.stargazers_count)}</span>
                                                </div>
                                            </a>
                                        )) : (
                                            <div className={`text-center text-xs py-10 ${isDarkBg ? 'text-white/30' : 'text-gray-400'}`}>暂无数据</div>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <a
                                href={getTrendingUrl()}
                                target="_blank"
                                rel="noreferrer"
                                className={`block text-center text-xs mt-4 pt-3 border-t hover:text-[var(--theme-primary)] transition-colors ${isDarkBg ? 'text-white/40 border-white/10' : 'text-gray-400 border-gray-50'}`}
                            >
                                显示更多 <Icon icon="fa-solid fa-angle-right" className="ml-1" />
                            </a>
                        </>
                    );
                })()}
            </div>
        </div>
    )
}

// Wrap with ErrorBoundary
const RightWidgets = ({ config }: { config: SiteConfig }) => {
    return (
        <ErrorBoundary name="RightWidgets">
            <RightWidgetsContent config={config} />
        </ErrorBoundary>
    );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(RightWidgets, (prevProps, nextProps) => {
    // Only re-render if rightSidebar config actually changed
    return prevProps.config.rightSidebar === nextProps.config.rightSidebar;
});