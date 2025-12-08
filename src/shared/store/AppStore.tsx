import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Play, Settings, Download, Search, CheckCircle } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { Button } from '../../components/ui/Button';

interface Plugin {
    id: string;
    name: string;
    description: string;
    version: string;
    status: string;
    icon?: string;
    author?: string;
    category?: string;
    installed?: boolean;
    updateAvailable?: boolean;
}

interface AppStoreProps {
    isEmbedded?: boolean;
}

export default function AppStore({ isEmbedded = false }: AppStoreProps) {
    const { isAuthenticated } = useConfig();
    const [activeTab, setActiveTab] = useState<'library' | 'store'>('store');

    // Data States
    const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
    const [marketPlugins, setMarketPlugins] = useState<Plugin[]>([]);

    // Loading States
    const [loadingLibrary, setLoadingLibrary] = useState(true);
    const [loadingStore, setLoadingStore] = useState(true);
    const [installingId, setInstallingId] = useState<string | null>(null);

    // Fetch Installed Plugins
    const fetchLibrary = () => {
        setLoadingLibrary(true);
        fetch('/api/plugins', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setInstalledPlugins(data);
                } else {
                    setInstalledPlugins([]);
                    console.error('Library data is not an array:', data);
                }
                setLoadingLibrary(false);
            })
            .catch(err => {
                console.error('Failed to fetch library', err);
                setLoadingLibrary(false);
                setInstalledPlugins([]);
            });
    };

    // Fetch Market Plugins
    const fetchStore = () => {
        setLoadingStore(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.warn('No auth token found, cannot fetch store');
            setLoadingStore(false);
            return;
        }

        fetch('/api/market/plugins', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => {
                if (res.status === 401) throw new Error('Unauthorized');
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setMarketPlugins(data);
                } else {
                    console.error('Market data is not an array:', data);
                    setMarketPlugins([]);
                }
                setLoadingStore(false);
            })
            .catch(err => {
                console.error('Failed to fetch store', err);
                setLoadingStore(false);
                setMarketPlugins([]);
            });
    };

    useEffect(() => {
        if (activeTab === 'library') {
            fetchLibrary();
        } else {
            fetchStore();
        }
    }, [activeTab]);

    const handleOpenPlugin = (pluginId: string) => {
        // Fix: Use correct URL structure based on newer conventions if needed, 
        // currently sticking to /apps/:id based on previous file analysis
        window.location.href = `/apps/${pluginId}`;
    };

    const handleInstall = async (pluginId: string) => {
        if (!isAuthenticated) {
            alert('Please login to install plugins');
            return;
        }

        setInstallingId(pluginId);
        try {
            const res = await fetch('/api/market/install', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ pluginId })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Install failed');
            }

            // Refresh store to show updated status
            fetchStore();
            alert(`Plugin ${pluginId} installed successfully!`);
        } catch (error: any) {
            alert(`Installation failed: ${error.message}`);
        } finally {
            setInstallingId(null);
        }
    };

    return (
        <div className={`bg-gray-50 text-gray-800 font-sans ${isEmbedded ? '' : 'min-h-screen'}`}>
            {/* Header - Only show if NOT embedded */}
            {!isEmbedded && (
                <header className="bg-white shadow-sm sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ArrowLeft size={20} className="text-gray-600" />
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Package className="text-blue-600" />
                                App Store
                            </h1>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('store')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'store'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Marketplace
                            </button>
                            <button
                                onClick={() => setActiveTab('library')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'library'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Library
                            </button>
                        </div>

                        <div className="text-sm text-gray-500">
                            NavLink v2.0
                        </div>
                    </div>
                </header>
            )}

            {/* Embedded Header / Tabs Control */}
            {isEmbedded && (
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Plugin Market</h1>
                        <p className="text-sm text-gray-500">Manage and install plugins for your system</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setActiveTab('store')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'store'
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            Marketplace
                        </button>
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'library'
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            Library
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={`${isEmbedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>

                {/* Store View */}
                {activeTab === 'store' && (
                    <section>
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Discover Plugins</h2>
                                <p className="text-gray-500 mt-1">Explore and install new capabilities for your system</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search plugins..."
                                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
                                />
                            </div>
                        </div>

                        {loadingStore ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {marketPlugins.map(plugin => (
                                    <div key={plugin.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
                                                {plugin.icon || plugin.name.charAt(0)}
                                            </div>
                                            {plugin.installed ? (
                                                <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                                                    <CheckCircle size={12} />
                                                    Installed
                                                </span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-600 px-2.5 py-1 text-xs font-medium rounded-full">
                                                    v{plugin.version}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mb-1">{plugin.name}</h3>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{plugin.category || 'Tool'}</span>
                                            <span className="text-xs text-gray-400">by {plugin.author || 'Unknown'}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-6 flex-1 line-clamp-3">{plugin.description}</p>

                                        <div className="mt-auto">
                                            {plugin.installed ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handleOpenPlugin(plugin.id)}
                                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        <Play size={16} /> Open
                                                    </button>
                                                    <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                                                        <Settings size={16} /> Config
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button
                                                    onClick={() => handleInstall(plugin.id)}
                                                    isLoading={installingId === plugin.id}
                                                    disabled={installingId !== null}
                                                    variant="primary"
                                                    className="w-full justify-center"
                                                >
                                                    <Download size={16} className="mr-2" />
                                                    Install Plugin
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Library View */}
                {activeTab === 'library' && (
                    <section>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Download size={18} />
                            Installed ApplicationsLibrary
                        </h2>

                        {loadingLibrary ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {installedPlugins.length > 0 ? installedPlugins.map(plugin => (
                                    <div key={plugin.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xl">
                                                {plugin.name.charAt(0)}
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${plugin.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {plugin.status}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mb-1">{plugin.name}</h3>
                                        <p className="text-sm text-gray-500 mb-6 line-clamp-2">{plugin.description}</p>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleOpenPlugin(plugin.id)}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Play size={16} />
                                                Open
                                            </button>
                                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                                <Settings size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                        <Package className="mx-auto text-gray-300 mb-3" size={48} />
                                        <h3 className="text-gray-500 font-medium">No plugins installed</h3>
                                        <button
                                            onClick={() => setActiveTab('store')}
                                            className="mt-4 text-blue-600 hover:underline font-medium"
                                        >
                                            Go to Marketplace
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
