// 从环境变量获取配置，如果没有则使用默认值
export const JWT_SECRET = process.env.JWT_SECRET || 'navlink-default-secret-key';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';