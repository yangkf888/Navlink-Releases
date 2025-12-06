import { useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';

/**
 * 会话管理Hook
 * 功能:
 * 1. 检测用户活动
 * 2. 会话超时自动退出
 * 3. Token刷新提醒
 */

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟无操作自动退出
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000; // 超时前5分钟提醒

export function useSessionManager() {
    const { isAuthenticated, logout } = useConfig();

    useEffect(() => {
        if (!isAuthenticated) return;

        let lastActivityTime = Date.now();
        let warningShown = false;
        let checkIntervalId: NodeJS.Timeout;

        // 更新最后活动时间
        const updateActivity = () => {
            lastActivityTime = Date.now();
            warningShown = false;
        };

        // 检查会话超时
        const checkTimeout = () => {
            const now = Date.now();
            const inactiveTime = now - lastActivityTime;

            // 显示警告
            if (inactiveTime >= SESSION_TIMEOUT - WARNING_BEFORE_TIMEOUT && !warningShown) {
                warningShown = true;
                const remainingMinutes = Math.ceil((SESSION_TIMEOUT - inactiveTime) / 60000);
                console.warn(`[Session] 会话将在 ${remainingMinutes} 分钟后过期`);

                // 可以在这里添加UI提醒
                if (window.confirm(`您已经${Math.floor(inactiveTime / 60000)}分钟没有操作了。\n会话将在${remainingMinutes}分钟后过期，是否继续?\n\n点击"确定"继续工作，点击"取消"退出登录。`)) {
                    updateActivity();
                } else {
                    logout();
                }
            }

            // 超时自动退出
            if (inactiveTime >= SESSION_TIMEOUT) {
                console.log('[Session] Session timeout, logging out...');
                alert('会话已过期，请重新登录。');
                logout();
            }
        };

        // 监听用户活动
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, updateActivity);
        });

        // 每分钟检查一次
        checkIntervalId = setInterval(checkTimeout, 60 * 1000);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
            clearInterval(checkIntervalId);
        };
    }, [isAuthenticated, logout]);
}

/**
 * Token刷新Hook (可选)
 * 用于在token即将过期前自动刷新
 */
export function useTokenRefresh() {
    const { isAuthenticated } = useConfig();

    useEffect(() => {
        if (!isAuthenticated) return;

        // 每20分钟验证一次token
        const intervalId = setInterval(async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            try {
                const response = await fetch('/api/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    console.warn('[Token] Token验证失败，需要重新登录');
                    localStorage.removeItem('auth_token');
                    window.location.reload();
                }
            } catch (error) {
                console.error('[Token] Token验证出错:', error);
            }
        }, 20 * 60 * 1000); // 20分钟

        return () => clearInterval(intervalId);
    }, [isAuthenticated]);
}
