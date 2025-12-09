import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';

/**
 * Rate Limiting Middleware
 * 防止暴力破解和DDoS攻击
 */
export const createRateLimiter = (options = {}) => {
    const {
        windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分钟
        max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 限制100个请求
        message = 'Too many requests from this IP, please try again later.',
        ...otherOptions
    } = options;

    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        ...otherOptions
    });
};

/**
 * 登录专用的严格限流
 * 开发环境: 1分钟内最多20次 (方便测试)
 * 生产环境: 应改为 15分钟内最多5次
 */
export const loginRateLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1分钟 (开发环境)
    max: 20, // 最多20次尝试 (开发环境)
    message: 'Too many login attempts, please try again after 1 minute.',
    skipSuccessfulRequests: true // 成功的请求不计入限制
});

/**
 * API通用限流
 */
export const apiRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many API requests, please slow down.'
});

/**
 * Helmet Security Headers
 * 设置各种HTTP安全头
 */
export const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite需要unsafe-eval
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "ws:",
                "wss:",
                // Iconify 图标库 API
                "https://api.iconify.design",
                "https://api.unisvg.com",
                "https://api.simplesvg.com",
                // 允许其他外部 API（如热搜等）
                "https:"
            ],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"], // 允许同源iframe (插件在主应用iframe中加载)
            // 允许来自任何localhost端口的iframe嵌套
            frameAncestors: ["'self'", "http://127.0.0.1:*", "http://localhost:*"],
            // 🔑 禁用upgrade-insecure-requests以支持HTTP访问
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false, // 允许跨域资源
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 禁用X-Frame-Options，因为主应用(5173)和Gateway(3001)端口不同，不是同源
    // 使用CSP的frame-ancestors来控制
    frameguard: false,
    // 🔑 禁用HSTS以支持HTTP访问（局域网）
    // 如果使用HTTPS反向代理，应在nginx/traefik层添加HSTS header
    hsts: false,
});

/**
 * HPP (HTTP Parameter Pollution) Protection
 * 防止HTTP参数污染攻击
 */
export const hppProtection = hpp();

/**
 * 输入验证和清理
 */
export const validateInput = (req, res, next) => {
    // 检查常见的XSS攻击模式
    const checkXSS = (value) => {
        if (typeof value === 'string') {
            const xssPattern = /<script|javascript:|onerror=|onclick=/gi;
            return xssPattern.test(value);
        }
        return false;
    };

    const checkObject = (obj) => {
        for (const key in obj) {
            if (checkXSS(key) || checkXSS(obj[key])) {
                return true;
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkObject(obj[key])) {
                    return true;
                }
            }
        }
        return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
        return res.status(400).json({ error: 'Invalid input detected' });
    }

    next();
};

/**
 * 文件上传验证
 */
export const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
        if (!req.file && !req.files) {
            return next();
        }

        const files = req.files || [req.file];

        for (const file of files) {
            // 检查文件大小
            if (file.size > maxSize) {
                return res.status(400).json({
                    error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
                });
            }

            // 检查文件类型
            if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
                });
            }

            // 检查文件名中的危险字符
            const dangerousPattern = /[<>:"|?*\x00-\x1f]/g;
            if (dangerousPattern.test(file.originalname)) {
                return res.status(400).json({
                    error: 'Invalid characters in filename'
                });
            }
        }

        next();
    };
};

/**
 * IP白名单中间件(用于敏感操作)
 */
export const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            return next();
        }

        const clientIP = req.ip || req.connection.remoteAddress;

        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                error: 'Access denied from this IP address'
            });
        }

        next();
    };
};

/**
 * 请求日志中间件(用于安全审计)
 */
export const securityLogger = (logger) => {
    return (req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;

            // 记录所有认证相关的请求
            if (req.path.includes('/login') || req.path.includes('/auth')) {
                logger.info('Auth request', {
                    method: req.method,
                    path: req.path,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    statusCode: res.statusCode,
                    duration,
                    username: req.body?.username
                });
            }

            // 记录失败的请求
            if (res.statusCode >= 400) {
                logger.warn('Failed request', {
                    method: req.method,
                    path: req.path,
                    ip: req.ip,
                    statusCode: res.statusCode,
                    duration
                });
            }
        });

        next();
    };
};

/**
 * 密码强度验证
 */
export const validatePasswordStrength = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * 请求体大小限制
 */
export const bodyLimit = (limit = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.get('content-length');
        const maxSize = parseSize(limit);

        if (contentLength && parseInt(contentLength) > maxSize) {
            return res.status(413).json({
                error: `Request body too large. Maximum size is ${limit}`
            });
        }

        next();
    };
};

function parseSize(size) {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);

    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return value * (units[unit] || 1);
}

export default {
    createRateLimiter,
    loginRateLimiter,
    apiRateLimiter,
    helmetConfig,
    hppProtection,
    validateInput,
    validateFileUpload,
    ipWhitelist,
    securityLogger,
    validatePasswordStrength,
    bodyLimit
};
