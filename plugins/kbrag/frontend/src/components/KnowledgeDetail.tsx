/**
 * 知识详情组件
 */
import React, { useState } from 'react';
import { KnowledgeItem } from '../types';
import { apiPut, apiPost } from '../utils/api';

interface KnowledgeDetailProps {
    item: KnowledgeItem;
    onClose: () => void;
    onUpdate: () => void;
}

export const KnowledgeDetail: React.FC<KnowledgeDetailProps> = ({ item, onClose, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(item.title);
    const [content, setContent] = useState(item.content);
    const [url, setUrl] = useState(item.url || '');
    const [tags, setTags] = useState(item.tags.join(', '));
    const [note, setNote] = useState(item.note || '');
    const [saving, setSaving] = useState(false);
    const [embedding, setEmbedding] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            alert('请填写标题和内容');
            return;
        }
        setSaving(true);
        try {
            await apiPut(`items/${item.id}`, {
                title: title.trim(),
                content: content.trim(),
                url: url.trim() || null,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                note: note.trim() || null,
            });
            setEditing(false);
            onUpdate();
        } catch (error) {
            alert('保存失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleEmbed = async () => {
        setEmbedding(true);
        try {
            await apiPost(`search/embed/${item.id}`, {});
            alert('向量化成功');
            onUpdate();
        } catch (error) {
            alert('向量化失败: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setEmbedding(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 头部 */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                        {editing ? '编辑知识' : '知识详情'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!editing && (
                            <>
                                <button
                                    onClick={handleEmbed}
                                    disabled={embedding || item.embedded === 1}
                                    className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                                >
                                    {embedding ? (
                                        <><i className="fas fa-spinner fa-spin mr-1"></i>处理中</>
                                    ) : item.embedded === 1 ? (
                                        <><i className="fas fa-check mr-1"></i>已向量化</>
                                    ) : (
                                        <><i className="fas fa-bolt mr-1"></i>向量化</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setEditing(true)}
                                    className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                >
                                    <i className="fas fa-edit mr-1"></i>编辑
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* 内容 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {editing ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={10}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">来源 URL</label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">{item.title}</h3>
                                {item.url && (
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                                    >
                                        <i className="fas fa-external-link-alt mr-1"></i>
                                        {item.url}
                                    </a>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {item.tags.map((tag, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                            </div>
                            {item.note && (
                                <div className="bg-yellow-50 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <i className="fas fa-sticky-note mr-2"></i>
                                        {item.note}
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>
                                    <i className="fas fa-calendar mr-1"></i>
                                    创建于 {formatDate(item.created_at)}
                                </span>
                                <span>
                                    <i className="fas fa-clock mr-1"></i>
                                    更新于 {formatDate(item.updated_at)}
                                </span>
                                {item.embedded === 1 ? (
                                    <span className="text-green-600">
                                        <i className="fas fa-check-circle mr-1"></i>已向量化
                                    </span>
                                ) : (
                                    <span className="text-yellow-600">
                                        <i className="fas fa-clock mr-1"></i>待向量化
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 底部 */}
                {editing && (
                    <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            onClick={() => setEditing(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
