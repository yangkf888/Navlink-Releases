import { useState, useEffect, useRef } from 'react';
import { Icon } from './common/Icon';
import { ConfirmModal } from './common/ConfirmModal';

interface FileManagerProps {
    ws: WebSocket | null;
    isConnected: boolean;
}

interface FileItem {
    name: string;
    size: number;
    mode: string;
    modTime: string;
    isDir: boolean;
}

export default function FileManager({ ws, isConnected }: FileManagerProps) {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editor State
    const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [saving, setSaving] = useState(false);

    // Upload State
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Modals
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: FileItem | null }>({ isOpen: false, item: null });
    const [renameModal, setRenameModal] = useState<{ isOpen: boolean; item: FileItem | null; newName: string }>({ isOpen: false, item: null, newName: '' });
    const [newFolderModal, setNewFolderModal] = useState<{ isOpen: boolean; folderName: string }>({ isOpen: false, folderName: '' });
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    // const fileInputRef = useRef<HTMLInputElement>(null); // Unused for now

    // WebSocket Message Handling
    useEffect(() => {
        if (!ws) return;

        const handleMessage = (event: MessageEvent) => {
            console.log('[FileManager] Received message:', event.data);
            try {
                const msg = JSON.parse(event.data);
                console.log('[FileManager] Parsed message type:', msg.type);

                if (msg.type === 'sftp:list:response') {
                    if (msg.error) {
                        console.error('[FileManager] List error:', msg.error);
                        setError(msg.error);
                    } else {
                        console.log('[FileManager] List success, items:', msg.data?.length);
                        const sorted = (msg.data as FileItem[]).sort((a, b) => {
                            if (a.isDir && !b.isDir) return -1;
                            if (!a.isDir && b.isDir) return 1;
                            return a.name.localeCompare(b.name);
                        });
                        setFiles(sorted);
                    }
                    setLoading(false);
                } else if (msg.type === 'sftp:read:response') {
                    if (msg.error) {
                        setError(msg.error);
                    } else {
                        setEditingFile({ path: msg.path, content: msg.data });
                        setEditorContent(msg.data);
                    }
                    setLoading(false);
                } else if (msg.type === 'sftp:download:response') {
                    if (msg.error) {
                        setError(msg.error);
                    } else {
                        // Create blob and download
                        const blob = new Blob([Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))]);
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = msg.filename || 'download';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }
                    setLoading(false);
                } else if (msg.type === 'sftp:write:response' || msg.type === 'sftp:delete:response' || msg.type === 'sftp:rename:response' || msg.type === 'sftp:mkdir:response') {
                    if (msg.error) {
                        setError(msg.error);
                    } else {
                        refresh();
                        if (msg.type === 'sftp:write:response') {
                            setSaving(false);
                            setEditingFile(null);
                        }
                        if (msg.type === 'sftp:mkdir:response') {
                            setNewFolderModal({ isOpen: false, folderName: '' });
                        }
                    }
                    setLoading(false);
                } else if (msg.type === 'sftp:upload:chunk:ack' || msg.type === 'sftp:upload:finish:ack') {
                    // Handle upload acknowledgments in uploadFileChunked
                } else if (msg.type === 'sftp:upload:error') {
                    setError(msg.error || 'Upload failed');
                    setLoading(false);
                    setUploadProgress(null);
                }

            } catch (e) {
                console.warn('[FileManager] Failed to parse message:', event.data);
            }
        };

        ws.addEventListener('message', handleMessage);
        return () => ws.removeEventListener('message', handleMessage);
    }, [ws]);

    // Initial Load
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (isConnected) {
            if (isFirstLoad.current) {
                // Delay initial load to ensure backend SFTP is fully ready
                const timer = setTimeout(() => {
                    refresh();
                    isFirstLoad.current = false;
                }, 1000);
                return () => clearTimeout(timer);
            } else {
                refresh();
            }
        }
    }, [isConnected, currentPath]);

    // Auto-retry logic
    useEffect(() => {
        let retryTimer: NodeJS.Timeout;
        if (loading && isConnected) {
            retryTimer = setTimeout(() => {
                console.log('[FileManager] Loading timeout, retrying refresh...');
                refresh();
            }, 2000); // Retry after 2 seconds if still loading
        }
        return () => clearTimeout(retryTimer);
    }, [loading, isConnected]);

    const refresh = () => {
        if (!ws || !isConnected) {
            console.warn('[FileManager] Refresh skipped: ws or isConnected missing', { ws: !!ws, isConnected });
            return;
        }
        setLoading(true);
        setError(null);
        console.log('[FileManager] Sending sftp:list request for path:', currentPath);
        ws.send(JSON.stringify({ type: 'sftp:list', payload: { path: currentPath } }));
    };

    const handleUp = () => {
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = '/' + parts.join('/');
        setCurrentPath(newPath || '/');
    };

    const handleItemClick = (item: FileItem) => {
        if (item.isDir) {
            const newPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
            setCurrentPath(newPath);
        } else {
            // Open file
            if (!ws) return;
            setLoading(true);
            const filePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
            setEditingFile({ path: filePath, content: '' }); // Set path immediately
            ws.send(JSON.stringify({ type: 'sftp:read', payload: { path: filePath } }));
        }
    };

    const handleSaveFile = () => {
        if (!ws || !editingFile) return;
        setSaving(true);
        ws.send(JSON.stringify({ type: 'sftp:write', payload: { path: editingFile.path, content: editorContent } }));
    };

    const handleDelete = (item: FileItem) => {
        setDeleteModal({ isOpen: true, item });
    };

    const handleDeleteConfirm = () => {
        if (!ws || !deleteModal.item) return;
        const filePath = currentPath === '/' ? `/${deleteModal.item.name}` : `${currentPath}/${deleteModal.item.name}`;
        setLoading(true);
        ws.send(JSON.stringify({ type: 'sftp:delete', payload: { path: filePath } }));
        setDeleteModal({ isOpen: false, item: null });
    };

    const handleRename = (item: FileItem) => {
        setRenameModal({ isOpen: true, item, newName: item.name });
    };

    const handleRenameSubmit = () => {
        if (!ws || !renameModal.item) return;
        const oldPath = currentPath === '/' ? `/${renameModal.item.name}` : `${currentPath}/${renameModal.item.name}`;
        const newPath = currentPath === '/' ? `/${renameModal.newName}` : `${currentPath}/${renameModal.newName}`;

        setLoading(true);
        ws.send(JSON.stringify({ type: 'sftp:rename', payload: { oldPath, newPath } }));
        setRenameModal({ ...renameModal, isOpen: false });
    };

    const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // File Download
    const handleDownload = (item: FileItem) => {
        if (!ws || !isConnected) return;
        const filePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        setLoading(true);
        ws.send(JSON.stringify({ type: 'sftp:download', payload: { path: filePath } }));
    };

    // Create New Folder
    const handleNewFolder = () => {
        setNewFolderModal({ isOpen: true, folderName: '' });
    };

    const handleNewFolderSubmit = () => {
        if (!ws || !newFolderModal.folderName) return;
        const folderPath = currentPath === '/' ? `/${newFolderModal.folderName}` : `${currentPath}/${newFolderModal.folderName}`;
        setLoading(true);
        ws.send(JSON.stringify({ type: 'sftp:mkdir', payload: { path: folderPath } }));
    };

    // File Upload
    const uploadFileChunked = async (file: File, path: string) => {
        if (!ws || !isConnected) return;

        setLoading(true);
        setUploadProgress(0);

        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        try {
            // Upload Chunks
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                const buffer = await chunk.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

                ws.send(JSON.stringify({
                    type: 'sftp:upload:chunk',
                    payload: { path, content: base64, position: start, isLast: i === totalChunks - 1 }
                }));

                // Update progress
                setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));

                // Small delay to avoid overwhelming the connection
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Wait a bit for final processing
            setTimeout(() => {
                setLoading(false);
                setUploadProgress(null);
                refresh();
            }, 500);

        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.message || 'Upload failed');
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ws) return;

        const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
        uploadFileChunked(file, filePath);

        // Reset input
        e.target.value = '';
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Toolbar */}
            <div className="p-2 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
                <button onClick={handleUp} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" disabled={currentPath === '/'}>
                    <Icon icon="fa-solid fa-arrow-up" />
                </button>
                <div className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-mono text-gray-700 truncate">
                    {currentPath}
                </div>
                <button onClick={refresh} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Refresh">
                    <Icon icon="fa-solid fa-sync" className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Upload File" disabled={!isConnected}>
                    <Icon icon="fa-solid fa-upload" />
                </button>
                <button onClick={handleNewFolder} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="New Folder" disabled={!isConnected}>
                    <Icon icon="fa-solid fa-folder-plus" />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Upload Progress */}
            {uploadProgress !== null && (
                <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-700">Uploading... {uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm border-b border-red-100 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><Icon icon="fa-solid fa-times" /></button>
                </div>
            )}

            {/* File List */}
            <div className="flex-1 overflow-y-auto relative">
                {loading && !files.length && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                        <Icon icon="fa-solid fa-spinner" className="animate-spin text-2xl text-blue-600" />
                    </div>
                )}

                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2 w-24 hidden md:table-cell">Size</th>
                            <th className="px-4 py-2 w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.length === 0 && !loading && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                                    No files found
                                </td>
                            </tr>
                        )}
                        {files.map(item => (
                            <tr
                                key={item.name}
                                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer group"
                                onClick={() => handleItemClick(item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                            >
                                <td className="px-4 py-2 flex items-center gap-2">
                                    <Icon
                                        icon={item.isDir ? "fa-solid fa-folder" : "fa-solid fa-file"}
                                        className={item.isDir ? "text-yellow-500" : "text-gray-400"}
                                    />
                                    <span className="text-gray-700 font-medium truncate max-w-[150px] md:max-w-none">{item.name}</span>
                                </td>
                                <td className="px-4 py-2 text-gray-500 font-mono text-xs hidden md:table-cell">
                                    {item.size > 0 ? (item.size / 1024).toFixed(1) + ' KB' : '-'}
                                </td>
                                <td className="px-4 py-2 text-right flex justify-end gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRename(item); }}
                                        className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Rename"
                                    >
                                        <Icon icon="fa-solid fa-pen" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete"
                                    >
                                        <Icon icon="fa-solid fa-trash" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Editor Modal */}
            {editingFile && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-20">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
                        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-gray-800 truncate">{editingFile.path}</h3>
                            <button onClick={() => setEditingFile(null)} className="text-gray-400 hover:text-gray-600">
                                <Icon icon="fa-solid fa-times" />
                            </button>
                        </div>
                        <div className="flex-1 p-0 relative">
                            <textarea
                                value={editorContent}
                                onChange={e => setEditorContent(e.target.value)}
                                className="w-full h-full p-4 font-mono text-sm outline-none resize-none bg-gray-50"
                                spellCheck={false}
                            />
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => setEditingFile(null)}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFile}
                                disabled={saving}
                                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {saving && <Icon icon="fa-solid fa-spinner" className="animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameModal.isOpen && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-30" onClick={() => setRenameModal({ ...renameModal, isOpen: false })}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Rename {renameModal.item?.name}</h3>
                        <input
                            type="text"
                            value={renameModal.newName}
                            onChange={e => setRenameModal({ ...renameModal, newName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setRenameModal({ ...renameModal, isOpen: false })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleRenameSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {newFolderModal.isOpen && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-30" onClick={() => setNewFolderModal({ isOpen: false, folderName: '' })}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">New Folder</h3>
                        <input
                            type="text"
                            value={newFolderModal.folderName}
                            onChange={e => setNewFolderModal({ ...newFolderModal, folderName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                            placeholder="Folder name"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleNewFolderSubmit()}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setNewFolderModal({ isOpen: false, folderName: '' })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleNewFolderSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white shadow-xl rounded-lg border border-gray-200 py-1 z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => { handleItemClick(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2">
                        <Icon icon={contextMenu.item.isDir ? "fa-solid fa-folder-open" : "fa-solid fa-file-pen"} className="w-4" />
                        {contextMenu.item.isDir ? 'Open' : 'Edit'}
                    </button>
                    {!contextMenu.item.isDir && (
                        <button onClick={() => { handleDownload(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2">
                            <Icon icon="fa-solid fa-download" className="w-4" />
                            Download
                        </button>
                    )}
                    <button onClick={() => { handleRename(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2">
                        <Icon icon="fa-solid fa-i-cursor" className="w-4" />
                        Rename
                    </button>
                    <div className="h-px bg-gray-200 my-1"></div>
                    <button onClick={() => { handleDelete(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2">
                        <Icon icon="fa-solid fa-trash" className="w-4" />
                        Delete
                    </button>
                </div>
            )}

            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, item: null })}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message={`Are you sure you want to delete ${deleteModal.item?.name}? This action cannot be undone.`}
            />
        </div>
    );
}
