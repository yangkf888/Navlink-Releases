/**
 * 首页 - 优化版
 * 包含：搜索框、Banner 轮播、正在热映、分类板块（带二级分类 tabs）
 */

import { useState, useEffect } from 'react';
import { Video, VideoSource, Category } from '../types';
import { apiGet } from '../utils/api';
import { VideoCard } from '../components/VideoCard';

interface HomeProps {
    sources: VideoSource[];
    categoriesMap: Record<number, Category[]>;
    onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

// 分类板块数据
interface CategorySection {
    id: string;
    name: string;
    icon: string;
    color: string;
    typeId: string;
    subCategories: Category[];
    videos: Video[];
    selectedSubCategory: string | null; // null 表示全部
}

export function Home({ sources, categoriesMap, onNavigate }: HomeProps) {
    const [hotVideos, setHotVideos] = useState<Video[]>([]);
    const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (sources.length > 0) {
            loadHomeData();
        }
    }, [sources, categoriesMap]);

    const loadHomeData = async () => {
        setLoading(true);
        try {
            const defaultSource = sources[0];
            if (!defaultSource) return;

            // 正在热映（最新视频）
            const hotRes = await apiGet<Video[]>('/videos', {
                source_id: defaultSource.id,
                page: 1,
                limit: 12
            });
            if (hotRes.success && hotRes.data) {
                setHotVideos(hotRes.data.map(v => ({ ...v, source_id: defaultSource.id })));
            }

            // 构建分类板块
            const cats = categoriesMap[defaultSource.id] || [];
            const topLevelCats = cats.filter(c => !c.parent_id || c.parent_id === 0);

            // 定义分类配置
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

            const sections: CategorySection[] = [];

            for (const topCat of topLevelCats) {
                // 找到配置
                const config = categoryConfigs.find(c => topCat.name.includes(c.name));
                if (!config) continue; // 只显示有配置的分类

                // 获取二级分类
                const subCats = cats.filter(c => c.parent_id === parseInt(topCat.type_id) ||
                    (c.parent_id && String(c.parent_id) === topCat.type_id));

                // 加载该分类的视频
                const videoRes = await apiGet<Video[]>('/videos', {
                    source_id: defaultSource.id,
                    category_id: topCat.type_id,
                    page: 1,
                    limit: 12
                });

                sections.push({
                    id: topCat.type_id,
                    name: topCat.name,
                    icon: config.icon,
                    color: config.color,
                    typeId: topCat.type_id,
                    subCategories: subCats,
                    videos: (videoRes.success && videoRes.data)
                        ? videoRes.data.map(v => ({ ...v, source_id: defaultSource.id }))
                        : [],
                    selectedSubCategory: null
                });
            }

            setCategorySections(sections);

        } catch (error) {
            console.error('[Home] Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    // 切换二级分类
    const handleSubCategoryChange = async (sectionId: string, subCatId: string | null) => {
        const defaultSource = sources[0];
        if (!defaultSource) return;

        // 更新选中状态
        setCategorySections(prev => prev.map(section => {
            if (section.id === sectionId) {
                return { ...section, selectedSubCategory: subCatId };
            }
            return section;
        }));

        // 加载对应分类的视频
        const section = categorySections.find(s => s.id === sectionId);
        if (!section) return;

        const categoryId = subCatId || section.typeId;
        const videoRes = await apiGet<Video[]>('/videos', {
            source_id: defaultSource.id,
            category_id: categoryId,
            page: 1,
            limit: 12
        });

        if (videoRes.success && videoRes.data) {
            setCategorySections(prev => prev.map(s => {
                if (s.id === sectionId) {
                    return {
                        ...s,
                        videos: videoRes.data!.map(v => ({ ...v, source_id: defaultSource.id }))
                    };
                }
                return s;
            }));
        }
    };

    const handleVideoClick = (video: Video) => {
        onNavigate('play', {
            sourceId: video.source_id,
            vodId: video.vod_id
        });
    };

    const handleViewMore = (categoryId: string, categoryName: string) => {
        const defaultSource = sources[0];
        if (!defaultSource) return;

        onNavigate('category', {
            sourceId: defaultSource.id,
            categoryId,
            categoryName
        });
    };

    // 获取颜色类
    const getColorClasses = (color: string) => {
        const colors: Record<string, { icon: string; tab: string; activeTab: string }> = {
            blue: { icon: 'text-blue-400', tab: 'hover:text-blue-400', activeTab: 'bg-blue-500' },
            green: { icon: 'text-green-400', tab: 'hover:text-green-400', activeTab: 'bg-green-500' },
            pink: { icon: 'text-pink-400', tab: 'hover:text-pink-400', activeTab: 'bg-pink-500' },
            purple: { icon: 'text-purple-400', tab: 'hover:text-purple-400', activeTab: 'bg-purple-500' },
            yellow: { icon: 'text-yellow-400', tab: 'hover:text-yellow-400', activeTab: 'bg-yellow-500' },
            orange: { icon: 'text-orange-400', tab: 'hover:text-orange-400', activeTab: 'bg-orange-500' },
        };
        return colors[color] || colors.blue;
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse space-y-8">
                {/* 内容骨架 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[...Array(18)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-8">

            {/* 正在热映 */}
            {hotVideos.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-fire text-orange-400"></i>
                            正在热映
                        </h2>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {hotVideos.slice(0, 12).map(video => (
                            <VideoCard
                                key={`hot-${video.source_id}-${video.vod_id}`}
                                video={video}
                                onClick={() => handleVideoClick(video)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* 分类板块（一级分类 + 二级分类 tabs） */}
            {categorySections.map(section => {
                const colorClasses = getColorClasses(section.color);

                return (
                    <section key={section.id}>
                        <div className="flex items-center justify-between mb-4">
                            {/* 左侧：标题 + 二级分类 tabs */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <i className={`${section.icon} ${colorClasses.icon}`}></i>
                                    {section.name}
                                </h2>

                                {/* 二级分类 tabs */}
                                {section.subCategories.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <button
                                            onClick={() => handleSubCategoryChange(section.id, null)}
                                            className={`px-3 py-1 text-sm rounded-full transition-colors
                                                ${section.selectedSubCategory === null
                                                    ? `${colorClasses.activeTab} text-white`
                                                    : `text-gray-400 ${colorClasses.tab}`
                                                }`}
                                        >
                                            全部
                                        </button>
                                        {section.subCategories.map(subCat => (
                                            <button
                                                key={subCat.type_id}
                                                onClick={() => handleSubCategoryChange(section.id, subCat.type_id)}
                                                className={`px-3 py-1 text-sm rounded-full transition-colors
                                                    ${section.selectedSubCategory === subCat.type_id
                                                        ? `${colorClasses.activeTab} text-white`
                                                        : `text-gray-400 ${colorClasses.tab}`
                                                    }`}
                                            >
                                                {subCat.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 右侧：更多按钮 */}
                            <button
                                onClick={() => handleViewMore(section.typeId, section.name)}
                                className="text-gray-400 text-sm hover:text-white flex items-center gap-1"
                            >
                                更多 <i className="fas fa-chevron-right text-xs"></i>
                            </button>
                        </div>

                        {/* 视频网格 */}
                        {section.videos.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                {section.videos.slice(0, 12).map(video => (
                                    <VideoCard
                                        key={`${section.id}-${video.source_id}-${video.vod_id}`}
                                        video={video}
                                        onClick={() => handleVideoClick(video)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>暂无视频</p>
                            </div>
                        )}
                    </section>
                );
            })}

            {/* 无数据提示 */}
            {sources.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-database text-4xl mb-4 opacity-50"></i>
                    <p>暂无视频数据</p>
                    <p className="text-sm mt-2">请先在管理页面添加视频源并同步分类</p>
                    <button
                        onClick={() => onNavigate('admin')}
                        className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                        前往管理
                    </button>
                </div>
            )}
        </div>
    );
}
