import { Video } from '../types';

interface VideoCardProps {
    video: Video;
    onClick: () => void;
    showSource?: boolean;
    sourceName?: string;  // 新增：外部传入的源名称
}

export function VideoCard({ video, onClick, showSource = false, sourceName }: VideoCardProps) {
    // 优先使用外部传入的 sourceName，其次使用 video.source_name
    const displaySourceName = sourceName || video.source_name;

    return (
        <div
            onClick={onClick}
            className="video-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
        >
            {/* 封面 */}
            <div className="relative">
                <img
                    src={video.vod_pic}
                    alt={video.vod_name}
                    className="video-cover w-full"
                    loading="lazy"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"%3E%3Crect fill="%23374151" width="100" height="150"/%3E%3Ctext x="50" y="75" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="12"%3E暂无图片%3C/text%3E%3C/svg%3E';
                    }}
                />

                {/* 悬停遮罩 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                              transition-opacity flex items-center justify-center">
                    <i className="fas fa-play-circle text-4xl text-white"></i>
                </div>

                {/* 更新状态 */}
                {video.vod_remarks && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-red-500 
                                   text-xs text-white rounded">
                        {video.vod_remarks}
                    </span>
                )}

                {/* 评分 */}
                {video.vod_score && parseFloat(video.vod_score) > 0 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 
                                   text-xs text-yellow-400 rounded flex items-center gap-1">
                        <i className="fas fa-star"></i>
                        {video.vod_score}
                    </span>
                )}

                {/* 视频源标签 */}
                {showSource && displaySourceName && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/80 
                                   text-xs text-white rounded">
                        {displaySourceName}
                    </span>
                )}
            </div>

            {/* 信息 */}
            <div className="p-3">
                <h3 className="text-white text-sm font-medium line-clamp-1" title={video.vod_name}>
                    {video.vod_name}
                </h3>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-xs">
                        {video.vod_year || video.type_name}
                    </span>
                    {video.vod_area && (
                        <span className="text-gray-500 text-xs">
                            {video.vod_area}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
