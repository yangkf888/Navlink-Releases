/**
 * 视频源概览页面
 * 当点击侧边栏某个视频源时，显示该源的多个分类及各分类的视频
 */

import { useState, useEffect } from 'react';
import { Video, Category } from '../types';
import { apiGet } from '../utils/api';
import { VideoCard } from '../components/VideoCard';
import { CategoryNav } from '../components/CategoryNav';


interface SourceOverviewProps {
    sourceId: number;
    sourceName?: string;
    categories: Category[];
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

// 分类板块数据
interface CategorySection {
    id: string;
    name: string;
    icon: string;
    color: string;
    videos: Video[];
}

export function SourceOverview({ sourceId, sourceName, categories, onNavigate }: SourceOverviewProps) {
    const [sections, setSections] = useState<CategorySection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (sourceId && categories.length > 0) {
            loadCategoryVideos();
        } else {
            setLoading(false);
        }
    }, [sourceId, categories]);

    const loadCategoryVideos = async () => {
        setLoading(true);

        try {
            // 1. 筛选一级分类 (与 Sidebar.tsx 第74行逻辑一致)
            const topLevelCats = categories.filter(c => !c.parent_id || c.parent_id === 0);

            // 2. 定义分类图标和颜色配置
            const categoryConfigs: { name: string; icon: string; color: string }[] = [
                { name: '电影', icon: 'fas fa-film', color: 'blue' },
                { name: '连续剧', icon: 'fas fa-tv', color: 'green' },
                { name: '电视剧', icon: 'fas fa-tv', color: 'green' },
                { name: '剧集', icon: 'fas fa-tv', color: 'green' },
                { name: '综艺', icon: 'fas fa-masks-theater', color: 'pink' },
                { name: '动漫', icon: 'fas fa-dragon', color: 'purple' },
                { name: '动画', icon: 'fas fa-dragon', color: 'purple' },
                { name: '纪录片', icon: 'fas fa-video', color: 'yellow' },
            ];

            // 3. 按优先级排序一级分类
            const priorityKeywords = ['电影', '连续剧', '电视剧', '剧集', '综艺', '动漫', '动画', '纪录片'];
            topLevelCats.sort((a, b) => {
                const indexA = priorityKeywords.findIndex(k => a.name.includes(k));
                const indexB = priorityKeywords.findIndex(k => b.name.includes(k));
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });

            // 4. 并发加载所有一级分类的视频
            const catsToLoad = topLevelCats.slice(0, 10);
            const promises = catsToLoad.map(async (cat) => {
                const config = categoryConfigs.find(c => cat.name.includes(c.name)) ||
                    { icon: 'fas fa-folder', color: 'gray' };

                // 与 Sidebar.tsx 第201-204行完全相同的子分类查找逻辑
                const subCats = categories.filter(c =>
                    c.parent_id === parseInt(cat.type_id) ||
                    (c.parent_id && String(c.parent_id) === cat.type_id)
                );

                let resultData: Video[] = [];

                // 如果有子分类，从子分类获取视频（与 Category.tsx loadSubCategoryVideos 逻辑一致）
                if (subCats.length > 0) {
                    // 尝试前3个子分类，直到找到有内容的
                    for (const subCat of subCats.slice(0, 3)) {
                        const subVideoRes = await apiGet<Video[]>('/videos', {
                            source_id: sourceId,
                            category_id: subCat.type_id,
                            page: 1,
                            limit: 12
                        });

                        if (subVideoRes.success && subVideoRes.data && subVideoRes.data.length > 0) {
                            resultData = subVideoRes.data;
                            break;
                        }
                    }
                }

                // 如果子分类没有数据，或没有子分类，尝试一级分类本身
                if (resultData.length === 0) {
                    const videoRes = await apiGet<Video[]>('/videos', {
                        source_id: sourceId,
                        category_id: cat.type_id,
                        page: 1,
                        limit: 12
                    });

                    if (videoRes.success && videoRes.data && videoRes.data.length > 0) {
                        resultData = videoRes.data;
                    }
                }

                if (resultData.length > 0) {
                    return {
                        id: cat.type_id,
                        name: cat.name,
                        icon: config.icon,
                        color: config.color,
                        videos: resultData.map(v => ({ ...v, source_id: sourceId } as Video))
                    } as CategorySection;
                }

                console.log(`[SourceOverview] "${cat.name}" -> NO DATA`);
                return null;
            });

            const results = await Promise.all(promises);
            // 过滤掉空结果，并限制显示数量
            const validSections = results.filter((s): s is CategorySection => s !== null).slice(0, 8);

            setSections(validSections);
        } catch (error) {
            console.error('[SourceOverview] Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVideoClick = (video: Video) => {
        onNavigate('play', {
            sourceId: video.source_id,
            vodId: video.vod_id
        });
    };

    const handleViewMore = (categoryId: string, categoryName: string) => {
        // 与 Sidebar.tsx 逻辑一致：计算该分类的子分类并传递
        const subCategories = categories.filter(c =>
            c.parent_id === parseInt(categoryId) ||
            (c.parent_id && String(c.parent_id) === categoryId)
        );

        onNavigate('category', {
            sourceId,
            categoryId,
            categoryName,
            subCategories
        });
    };

    const getColorClasses = (color: string) => {
        const colors: Record<string, { icon: string }> = {
            blue: { icon: 'text-blue-400' },
            green: { icon: 'text-green-400' },
            pink: { icon: 'text-pink-400' },
            purple: { icon: 'text-purple-400' },
            yellow: { icon: 'text-yellow-400' },
            orange: { icon: 'text-orange-400' },
            gray: { icon: 'text-gray-400' },
        };
        return colors[color] || colors.gray;
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse space-y-8">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-6 bg-gray-800 rounded w-32"></div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {[...Array(6)].map((_, j) => (
                                <div key={j} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (sections.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 w-full min-w-0">
                    <div className="p-4 lg:p-6 space-y-8 text-center py-12 text-gray-500">
                        <i className="fas fa-film text-4xl mb-4 opacity-50"></i>
                        <p>该视频源暂无内容</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* 顶部导航 */}
            {sourceId && categories.length > 0 && (
                <CategoryNav
                    categories={categories}
                    sourceId={sourceId}
                    onNavigate={onNavigate}
                />
            )}

            <div className="flex-1 p-4 lg:p-6 space-y-8">
                {/* 视频源标题 */}
                {sourceName && (
                    <div className="flex items-center gap-2">
                        <i className="fas fa-database text-blue-400"></i>
                        <h1 className="text-xl font-bold text-white">{sourceName}</h1>
                    </div>
                )}

                {/* 分类板块 */}
                {sections.map(section => {
                    const colorClasses = getColorClasses(section.color);

                    return (
                        <section key={section.id}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <i className={`${section.icon} ${colorClasses.icon}`}></i>
                                    {section.name}
                                </h2>
                                <button
                                    onClick={() => handleViewMore(section.id, section.name)}
                                    className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    更多
                                    <i className="fas fa-chevron-right text-xs"></i>
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {section.videos.slice(0, 6).map(video => (
                                    <VideoCard
                                        key={`${video.source_id}-${video.vod_id}`}
                                        video={video}
                                        onClick={() => handleVideoClick(video)}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
