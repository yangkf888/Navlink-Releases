import { useState, useEffect } from 'react'
import { Plus, Upload, Trash2, X, Download, Settings } from 'lucide-react'

interface Plugin {
    id: string
    name: string
    description: string
    author: string
    category: string
    icon: string
    latest_version: string
    total_downloads: number
}

export default function Plugins() {
    const [plugins, setPlugins] = useState<Plugin[]>([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)
    const [form, setForm] = useState({ id: '', name: '', description: '', author: '', category: 'Utility', icon: '📦' })
    const [uploadForm, setUploadForm] = useState({ version: '', changelog: '', file: null as File | null })
    const [configForm, setConfigForm] = useState({ registryDomain: '' })
    const [loading, setLoading] = useState(false)

    const token = localStorage.getItem('navmanage_token')

    useEffect(() => {
        fetchPlugins()
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/config', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) {
                setConfigForm({ registryDomain: data.registryDomain || '' })
            }
        } catch (error) {
            console.error('Failed to fetch config:', error)
        }
    }

    const saveConfig = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(configForm)
            })
            if (res.ok) {
                alert('配置已保存')
                fetchConfig()
                setShowConfigModal(false)
            } else {
                const data = await res.json()
                alert(data.error || '保存失败')
            }
        } catch (error) {
            console.error('Failed to save config:', error)
        }
        setLoading(false)
    }

    const fetchPlugins = async () => {
        try {
            const res = await fetch('/api/plugins')
            const data = await res.json()
            if (Array.isArray(data)) setPlugins(data)
        } catch (error) {
            console.error('Failed to fetch plugins:', error)
        }
    }

    const createPlugin = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/plugins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            })
            if (res.ok) {
                setShowCreateModal(false)
                setForm({ id: '', name: '', description: '', author: '', category: 'Utility', icon: '📦' })
                fetchPlugins()
            } else {
                const data = await res.json()
                alert(data.error || '创建失败')
            }
        } catch (error) {
            console.error('Failed to create plugin:', error)
        }
        setLoading(false)
    }

    const uploadVersion = async () => {
        if (!selectedPlugin || !uploadForm.file || !uploadForm.version) return

        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('file', uploadForm.file)
            formData.append('version', uploadForm.version)
            formData.append('changelog', uploadForm.changelog)

            const res = await fetch(`/api/plugins/${selectedPlugin}/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })

            if (res.ok) {
                setShowUploadModal(false)
                setUploadForm({ version: '', changelog: '', file: null })
                setSelectedPlugin(null)
                fetchPlugins()
                alert('版本上传成功')
            } else {
                const data = await res.json()
                alert(data.error || '上传失败')
            }
        } catch (error) {
            console.error('Failed to upload:', error)
        }
        setLoading(false)
    }

    const deletePlugin = async (id: string) => {
        if (!confirm('确定要删除此插件及其所有版本吗？此操作不可恢复！')) return
        try {
            await fetch(`/api/plugins/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchPlugins()
        } catch (error) {
            console.error('Failed to delete:', error)
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">插件管理</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <Settings size={20} />
                        Registry 配置
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        添加插件
                    </button>
                </div>
            </div>

            {/* 插件列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plugins.map(plugin => (
                    <div key={plugin.id} className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{plugin.icon}</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                                    <p className="text-sm text-gray-500">{plugin.id}</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                v{plugin.latest_version || '-'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{plugin.description || '暂无描述'}</p>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Download size={14} />
                                {plugin.total_downloads || 0} 次下载
                            </span>
                            <span>{plugin.category}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                            <button
                                onClick={() => { setSelectedPlugin(plugin.id); setShowUploadModal(true); }}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                            >
                                <Upload size={16} />
                                上传版本
                            </button>
                            <button
                                onClick={() => deletePlugin(plugin.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {plugins.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        暂无插件，点击右上角添加
                    </div>
                )}
            </div>

            {/* Config Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Settings size={20} className="text-gray-500" />
                                Registry 配置
                            </h3>
                            <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">服务域名 (Domain)</label>
                                <input
                                    value={configForm.registryDomain}
                                    onChange={e => setConfigForm({ ...configForm, registryDomain: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    placeholder={window.location.origin}
                                    onBlur={() => {
                                        let val = configForm.registryDomain.trim();
                                        if (val && !/^https?:\/\//i.test(val)) {
                                            val = 'http://' + val;
                                        }
                                        if (val.endsWith('/')) {
                                            val = val.slice(0, -1);
                                        }
                                        setConfigForm({ ...configForm, registryDomain: val });
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    设置 NavLink 访问的域名，例如: <code className="bg-gray-100 px-1 rounded">https://navmanage.yourdomain.com</code>
                                </p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                                <p className="text-sm text-gray-600 mb-2">生成的 Registry URL:</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-white rounded border border-gray-200 text-sm text-gray-800 font-mono break-all">
                                        {(configForm.registryDomain || window.location.origin).replace(/\/$/, '') + '/api/registry.json'}
                                    </code>
                                    <button
                                        onClick={() => {
                                            const domain = (configForm.registryDomain || window.location.origin).replace(/\/$/, '');
                                            navigator.clipboard.writeText(domain + '/api/registry.json');
                                            alert('已复制');
                                        }}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="复制链接"
                                    >
                                        <Download size={18} className="rotate-[-90deg]" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowConfigModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={saveConfig}
                                    disabled={loading}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {loading ? '保存中...' : '保存配置'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 创建插件弹窗 */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">添加新插件</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">插件 ID *</label>
                                    <input
                                        value={form.id}
                                        onChange={e => setForm({ ...form, id: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="如: docker"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">图标</label>
                                    <input
                                        value={form.icon}
                                        onChange={e => setForm({ ...form, icon: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="📦"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">插件名称 *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Docker 管理"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                    placeholder="插件功能描述"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                                    <input
                                        value={form.author}
                                        onChange={e => setForm({ ...form, author: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="NavLink Team"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm({ ...form, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Utility">工具</option>
                                        <option value="System">系统</option>
                                        <option value="Productivity">效率</option>
                                        <option value="AI">AI</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={createPlugin}
                                disabled={loading || !form.id || !form.name}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '创建中...' : '创建插件'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 上传版本弹窗 */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">上传新版本 - {selectedPlugin}</h3>
                            <button onClick={() => { setShowUploadModal(false); setSelectedPlugin(null); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">版本号 *</label>
                                <input
                                    value={uploadForm.version}
                                    onChange={e => setUploadForm({ ...uploadForm, version: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="2.0.0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">更新日志</label>
                                <textarea
                                    value={uploadForm.changelog}
                                    onChange={e => setUploadForm({ ...uploadForm, changelog: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="这个版本更新了什么..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">插件包 (.zip) *</label>
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => { setShowUploadModal(false); setSelectedPlugin(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                取消
                            </button>
                            <button
                                onClick={uploadVersion}
                                disabled={loading || !uploadForm.version || !uploadForm.file}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '上传中...' : '上传版本'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
