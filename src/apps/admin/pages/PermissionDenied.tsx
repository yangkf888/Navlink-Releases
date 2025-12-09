import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PermissionDenied() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[600px] flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center p-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 rounded-full mb-6">
                    <Shield className="text-red-600" size={48} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                    权限不足
                </h1>
                <p className="text-gray-600 mb-8 max-w-md">
                    您没有访问此页面的权限。<br />
                    如需访问，请联系管理员申请相应权限。
                </p>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <ArrowLeft size={20} />
                    返回仪表盘
                </button>
            </div>
        </div>
    );
}
