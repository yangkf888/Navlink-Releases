
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/shared/services/api';

export const LicenseGuard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // 简单的防止重复检查标志
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const checkLicense = async () => {
            // 如果已经在激活页，不检查
            if (location.pathname === '/activate') {
                return;
            }

            try {
                // 动态检查
                const status = await api.getLicenseStatus();
                if (!status.valid) {
                    console.log('[LicenseGuard] License invalid, redirecting to /activate');
                    // 使用 replace 防止用户后退回来
                    navigate('/activate', { replace: true });
                }
            } catch (error) {
                console.error('[LicenseGuard] Check failed:', error);
                // 如果检查失败（如网络错误），可能也需要拦截，或者让后续 API 拦截
                // 这里选择保守策略，只有明确无效时才拦截，或者 API 返回 402 时拦截
            } finally {
                setChecked(true);
            }
        };

        // 避免太频繁检查，但在路由变化时最好检查一下（或者只在首次加载检查）
        // 这里选择首次加载 + 路由变化时检查（如果是 SPA，耗销不大，每次 API 调用很快）
        // 但为了性能，可以只在 App 挂载时检查一次，后续由 API 402 拦截器接管。
        // 不过为了"打开首页显示注册页"，必须在挂载时检查。
        if (!checked) {
            checkLicense();
        }
    }, [location.pathname, navigate, checked]);

    return null; // 无 UI
};
