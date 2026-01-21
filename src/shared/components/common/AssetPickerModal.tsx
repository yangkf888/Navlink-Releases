import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from '../ui/AdminButton';
import { Input } from '../ui/AdminInput';

interface AssetFile {
    filename: string;
    path: string;
    size: number;
    uploadedAt: string;
}

interface AssetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [files, setFiles] = useState<AssetFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadFiles();
        }
    }, [isOpen]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/uploads', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
            }
        } catch (error) {
            console.error('Failed to load assets:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredFiles = files.filter(f =>
        f.filename.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Icon icon="fa-solid fa-images" className="text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-800">浏览本地资源</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <Icon icon="fa-solid fa-xmark" className="text-gray-400" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="relative">
                        <Icon icon="fa-solid fa-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="搜索资源文件名..."
                            className="pl-10 h-10 w-full"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                            <Icon icon="fa-solid fa-spinner fa-spin" className="text-4xl text-blue-500 mb-4" />
                            <p className="text-gray-500">正在获取资源列表...</p>
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <Icon icon="fa-solid fa-folder-open" className="text-6xl text-gray-200 mb-4" />
                            <p className="text-gray-500">{searchTerm ? '未找到相关资源' : '暂无已上传资源'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredFiles.map(file => (
                                <div
                                    key={file.filename}
                                    onClick={() => onSelect(file.path)}
                                    className="group relative bg-white rounded-lg border border-gray-200 p-2 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all active:scale-95 overflow-hidden"
                                >
                                    <div className="aspect-square bg-gray-50 rounded-md flex items-center justify-center mb-2 overflow-hidden">
                                        <img
                                            src={file.path}
                                            alt={file.filename}
                                            className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-300"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjRjNGNEY2Ii8+PHBhdGggZD0iTTI2IDE0SDE0YTIgMiAwIDAgMCAyIDJ2OGEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJ2LThhMiAyIDAgMCAwLTItMlpNMTQgMTZoMTJ2OGwtNC00bC00IDRMLTE0IDI0di04WiIgZmlsbD0iI0QxRDVREIi8+PC9zdmc+'; // Fallback icon
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-600 truncate text-center font-medium group-hover:text-blue-600" title={file.filename}>
                                        {file.filename}
                                    </p>
                                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <p className="text-xs text-gray-400">
                        共 {filteredFiles.length} 个资源
                    </p>
                    <Button variant="secondary" onClick={onClose} className="px-6">关闭</Button>
                </div>
            </div>
        </div>
    );
};
