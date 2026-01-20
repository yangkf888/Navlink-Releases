import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量 (Root directory)
const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');

if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✅ Environment variables loaded from .env file');
} else if (process.env.NODE_ENV || process.env.PORT) {
    // Docker or other environments where variables are injected directly
    console.log('✅ Using injected environment variables (Docker/System)');
} else {
    console.warn('⚠️  .env file not found and no environment variables detected');
    console.warn(`   Please copy ${envExamplePath} to ${envPath} and configure it`);
}

/**
 * 环境变量配置
 */
export const config = {
    // Server
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'navlink-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || './logs'
    },

    // Database
    database: {
        path: process.env.DB_PATH || './data'
    },

    // Security
    security: {
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        sessionSecret: process.env.SESSION_SECRET || 'navlink-session-secret-change-in-production',
        encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars'
    },

    // CORS
    cors: {
        origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3001,http://127.0.0.1:5173,http://127.0.0.1:3002').split(','),
        credentials: process.env.CORS_CREDENTIALS === 'true'
    },

    // Plugins
    plugins: {
        dir: process.env.PLUGINS_DIR || './plugins',
        portStart: parseInt(process.env.PLUGIN_PORT_START || '8000', 10),
        portEnd: parseInt(process.env.PLUGIN_PORT_END || '9000', 10)
    },

    // Admin
    admin: {
        defaultUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        defaultPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'
    },

    // Redis (Optional)
    redis: {
        enabled: process.env.REDIS_ENABLED === 'true',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0', 10)
    },

    // Email (Optional)
    email: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.SMTP_FROM || ''
    },

    // Backup
    backup: {
        enabled: process.env.BACKUP_ENABLED !== 'false',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
        path: process.env.BACKUP_PATH || './backups'
    },

    // Feature Flags
    features: {
        registration: process.env.ENABLE_REGISTRATION === 'true',
        multiTenant: process.env.ENABLE_MULTI_TENANT !== 'false',
        metrics: process.env.ENABLE_METRICS !== 'false',
        swaggerDocs: process.env.ENABLE_SWAGGER_DOCS === 'true'
    }
};

/**
 * 验证必需的环境变量
 */
export function validateConfig() {
    const warnings = [];
    const errors = [];

    // 生产环境必须配置的项
    if (config.isProduction) {
        if (config.jwt.secret === 'navlink-secret-key-change-in-production') {
            errors.push('JWT_SECRET must be set in production environment');
        }

        if (config.security.sessionSecret === 'navlink-session-secret-change-in-production') {
            errors.push('SESSION_SECRET must be set in production environment');
        }

        if (config.security.encryptionKey === 'default-encryption-key-32-chars') {
            errors.push('ENCRYPTION_KEY must be set in production environment');
        }

        if (config.admin.defaultPassword === 'admin123') {
            warnings.push('⚠️  Default admin password should be changed in production');
        }
    }

    // 开发环境警告
    if (config.isDevelopment) {
        if (config.jwt.secret === 'navlink-secret-key-change-in-production') {
            warnings.push('⚠️  Using default JWT_SECRET in development mode');
        }
    }

    // 输出警告和错误
    if (warnings.length > 0) {
        console.warn('\n⚠️  Configuration Warnings:');
        warnings.forEach(w => console.warn(`   ${w}`));
    }

    if (errors.length > 0) {
        console.error('\n❌ Configuration Errors:');
        errors.forEach(e => console.error(`   ${e}`));
        throw new Error('Configuration validation failed. Please check the errors above.');
    }

    if (warnings.length === 0 && errors.length === 0) {
        console.log('✅ Configuration validated successfully');
    }
}

/**
 * 显示当前配置(隐藏敏感信息)
 */
export function displayConfig() {
    const maskSecret = (secret) => {
        if (!secret || secret.length < 8) return '***';
        return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
    };

    console.log('\n📋 Current Configuration:');
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   JWT Secret: ${maskSecret(config.jwt.secret)}`);
    console.log(`   JWT Expires In: ${config.jwt.expiresIn}`);
    console.log(`   Log Level: ${config.logging.level}`);
    console.log(`   Multi-Tenant: ${config.features.multiTenant ? 'Enabled' : 'Disabled'}`);
    console.log(`   Metrics: ${config.features.metrics ? 'Enabled' : 'Disabled'}`);
    console.log(`   Backup: ${config.backup.enabled ? 'Enabled' : 'Disabled'}\n`);
}

export default config;
