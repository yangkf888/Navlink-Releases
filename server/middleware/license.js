
import { licenseService } from '../services/LicenseService.js';

/**
 * 授权验证中间件
 * 拦截未授权的请求
 */
export const requireLicense = (req, res, next) => {
    // 允许的白名单路径 (除了登录、静态资源等基础路径外，还需要允许 License 相关 API)
    const whitelist = [
        '/api/system/license/status',
        '/api/system/license/info',
        '/api/system/license/activate',
        '/api/system/license/recover',      // 邮箱找回激活码
        '/api/system/license/request-migrate',
        '/api/config',   // 允许加载基础配置
        '/api/login',    // 允许登录
        '/api/verify',   // 允许验证 Token
        '/api/health'    // 允许健康检查
    ];

    // 获取请求路径 (处理 Express 路由挂载导致 req.path 不包含挂载点的问题)
    // 使用 originalUrl 可以获取完整路径 (如 /api/config)
    const requestPath = req.originalUrl.split('?')[0];

    if (whitelist.includes(requestPath)) {
        return next();
    }

    if (!licenseService.isValid) {
        return res.status(402).json({
            error: 'License Required',
            message: '系统未激活，请联系管理员获取授权。',
            code: 'LICENSE_REQUIRED'
        });
    }

    next();
};
