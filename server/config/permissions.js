/**
 * 系统权限定义
 */

// 权限列表
export const PERMISSIONS = {
    // 用户管理
    USER_VIEW: 'user:view',           // 查看用户
    USER_CREATE: 'user:create',       // 创建用户
    USER_UPDATE: 'user:update',       // 更新用户
    USER_DELETE: 'user:delete',       // 删除用户
    
    // 插件管理
    PLUGIN_VIEW: 'plugin:view',       // 查看插件
    PLUGIN_START: 'plugin:start',     // 启动插件
    PLUGIN_STOP: 'plugin:stop',       // 停止插件
    PLUGIN_INSTALL: 'plugin:install', // 安装插件
    PLUGIN_DELETE: 'plugin:delete',   // 删除插件
    
    // 配置管理
    CONFIG_VIEW: 'config:view',       // 查看配置
    CONFIG_UPDATE: 'config:update',   // 更新配置
    
    // 导航管理
    NAV_VIEW: 'nav:view',             // 查看导航
    NAV_CREATE: 'nav:create',         // 创建导航
    NAV_UPDATE: 'nav:update',         // 更新导航
    NAV_DELETE: 'nav:delete',         // 删除导航
    
    // 系统管理
    SYSTEM_VIEW: 'system:view',       // 查看系统信息
    SYSTEM_MANAGE: 'system:manage',   // 系统管理
};

// 角色权限映射
export const ROLE_PERMISSIONS = {
    admin: [
        // 管理员拥有所有权限
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_UPDATE,
        PERMISSIONS.USER_DELETE,
        
        PERMISSIONS.PLUGIN_VIEW,
        PERMISSIONS.PLUGIN_START,
        PERMISSIONS.PLUGIN_STOP,
        PERMISSIONS.PLUGIN_INSTALL,
        PERMISSIONS.PLUGIN_DELETE,
        
        PERMISSIONS.CONFIG_VIEW,
        PERMISSIONS.CONFIG_UPDATE,
        
        PERMISSIONS.NAV_VIEW,
        PERMISSIONS.NAV_CREATE,
        PERMISSIONS.NAV_UPDATE,
        PERMISSIONS.NAV_DELETE,
        
        PERMISSIONS.SYSTEM_VIEW,
        PERMISSIONS.SYSTEM_MANAGE,
    ],
    
    user: [
        // 普通用户只有查看和基础操作权限
        PERMISSIONS.PLUGIN_VIEW,
        PERMISSIONS.CONFIG_VIEW,
        PERMISSIONS.NAV_VIEW,
        PERMISSIONS.SYSTEM_VIEW,
    ],
    
    editor: [
        // 编辑者可以查看和编辑内容,但不能管理用户和系统
        PERMISSIONS.PLUGIN_VIEW,
        
        PERMISSIONS.CONFIG_VIEW,
        PERMISSIONS.CONFIG_UPDATE,
        
        PERMISSIONS.NAV_VIEW,
        PERMISSIONS.NAV_CREATE,
        PERMISSIONS.NAV_UPDATE,
        PERMISSIONS.NAV_DELETE,
        
        PERMISSIONS.SYSTEM_VIEW,
    ],
};

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(userRole, permission) {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
}

/**
 * 检查用户是否有任一权限
 */
export function hasAnyPermission(userRole, permissions) {
    return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * 检查用户是否有所有权限
 */
export function hasAllPermissions(userRole, permissions) {
    return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * 获取角色的所有权限
 */
export function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * 获取所有可用角色
 */
export function getAllRoles() {
    return Object.keys(ROLE_PERMISSIONS);
}
