CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    permissions TEXT NOT NULL, -- JSON array of permission strings
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles if not exists
INSERT OR IGNORE INTO role_permissions (role, permissions, updated_at) VALUES 
('admin', '["user:view","user:create","user:update","user:delete","plugin:view","plugin:start","plugin:stop","plugin:install","plugin:delete","config:view","config:update","nav:view","nav:create","nav:update","nav:delete","system:view","system:manage"]', CURRENT_TIMESTAMP),
('user', '["plugin:view","config:view","nav:view","system:view"]', CURRENT_TIMESTAMP),
('editor', '["plugin:view","config:view","config:update","nav:view","nav:create","nav:update","nav:delete","system:view"]', CURRENT_TIMESTAMP);
