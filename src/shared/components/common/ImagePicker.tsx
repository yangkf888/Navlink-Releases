import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import axios from 'axios';

interface ImageFile {
    filename: string;
    size: number;
    path: string;
    uploadedAt: string;
    modifiedAt: string;
}

interface ImagePickerProps {
    onSelect: (imagePath: string) => void;
    buttonText?: string;
    buttonClassName?: string;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
    onSelect,
    buttonText = '📁 从图片库选择',
    buttonClassName = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [images, setImages] = useState<ImageFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadImages();
        }
    }, [isOpen]);

    const loadImages = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/uploads', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            setImages(response.data.files || []);
        } catch (error) {
            console.error('Failed to load images:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredImages = images.filter(img =>
        img.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSelect = (imagePath: string) => {
        onSelect(imagePath);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${buttonClassName}`}
            >
                {buttonText}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">图片库</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Icon icon="mdi:close" className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Icon
                            icon="mdi:magnify"
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                        />
                        <input
                            type="text"
                            placeholder="搜索图片..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Image Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : filteredImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Icon icon="mdi:image-off" className="w-16 h-16 mb-4" />
                            <p>{searchQuery ? '未找到匹配的图片' : '暂无图片'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredImages.map((image) => (
                                <div
                                    key={image.filename}
                                    className="group relative border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white"
                                    onClick={() => handleSelect(image.path)}
                                >
                                    {/* Image */}
                                    <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={image.path}
                                            alt={image.filename}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                                            }}
                                        />
                                    </div>

                                    {/* Info Overlay */}
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                                        <Icon icon="mdi:check-circle" className="w-12 h-12 text-white mb-2" />
                                        <p className="text-white text-sm font-medium">选择此图片</p>
                                    </div>

                                    {/* Filename */}
                                    <div className="p-2 bg-white">
                                        <p className="text-xs text-gray-600 truncate" title={image.filename}>
                                            {image.filename}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {formatFileSize(image.size)}
                                        </p>
                                    </div>

                                    {/* Preview Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewImage(image.path);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                                    >
                                        <Icon icon="mdi:eye" className="w-4 h-4 text-gray-700" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <p className="text-sm text-gray-600">
                        共 {filteredImages.length} 张图片
                        {searchQuery && ` (筛选自 ${images.length} 张)`}
                    </p>
                </div>
            </div>

            {/* Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-90"
                    onClick={() => setPreviewImage(null)}
                >
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-[90%] max-h-[90%] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                        <Icon icon="mdi:close" className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
    );
};
