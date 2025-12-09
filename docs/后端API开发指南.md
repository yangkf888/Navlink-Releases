# NavLink 后端API开发指南

> 版本：1.0.0  
> 更新时间：2025-12-06

## 目录

- [1. 概述](#1-概述)
- [2. 架构设计](#2-架构设计)
- [3. 核心模块](#3-核心模块)
- [4. API路由](#4-api路由)
- [5. 数据库设计](#5-数据库设计)
- [6. 认证与安全](#6-认证与安全)
- [7. 插件系统](#7-插件系统)
- [8. 最佳实践](#8-最佳实践)

---

## 1. 概述

NavLink 后端基于 **Node.js + Express.js** 构建，提供 RESTful API 服务。

**核心功能**：

- 📄 配置管理 API
- 🔐 认证与授权
- 🔌 插件生命周期管理
- 📊 数据持久化（SQLite）
- 🔒 安全防护（Helmet, HPP, Rate Limiting）
- 📝 日志记录
- 💾 缓存服务

---

## 2. 架构设计

### 2.1 技术栈

- **运行时**：Node.js (ES Modules)
- **框架**：Express.js
- **数据库**：SQLite (better-sqlite3)
- **认证**：JWT (jsonwebtoken)
- **安全**：Helmet, hpp, express-rate-limit
- **日志**：Winston
- **代理**：http-proxy-middleware

### 2.2 目录结构

```
server/
├── config/
│   ├── env.js              # 环境配置
│   ├── permissions.js      # 权限定义
│   └── swagger.js          # Swagger API文档配置
├── core/
│   ├── PluginManager.js    # 插件管理器
│   ├── PluginRouter.js     # 插件路由
│   ├── ProcessManager.js   # 进程管理
│   └── ServiceRegistry.js  # 服务注册
├── database/
│   ├── migrations/         # 数据库迁移文件 (.sql)
│   ├── initAuthDB.js       # 数据库初始化
│   └── migrationRunner.js  # 迁移执行器
├── middleware/
│   ├── auth.js             # 认证中间件
│   ├── cache.js            # 缓存中间件
│   ├── security.js         # 安全中间件
│   └── tenantIsolation.js  # 租户隔离
├── routes/
│   ├── navlink.js          # 主站API路由
│   └── upload.js           # 文件上传路由
├── services/
│   ├── AuthService.js      # 认证服务
│   ├── CacheService.js     # 缓存服务
│   ├── PluginMarketService.js # 插件市场
│   └── TenantService.js    # 租户服务
└── utils/
    └── logger.js           # 日志工具

server.js                   # 主入口文件
```

### 2.3 启动流程

```
1. 加载环境配置 (config/env.js)
2. 初始化数据库 (initAuthDB)
3. 启动插件管理器 (PluginManager)
4. 注册中间件 (Security, Auth, CORS, etc.)
5. 注册API路由
6. 启动HTTP服务器
```

---

## 3. 核心模块

### 3.1 PluginManager (插件管理器)

负责插件的发现、加载、启动、停止和卸载。

**核心方法**：

```javascript
// server/core/PluginManager.js
class PluginManager {
  constructor(pluginsDir, app, globalContext) {
    this.pluginsDir = pluginsDir;
    this.app = app;
    this.globalContext = globalContext;
    this.plugins = new Map();
  }

  // 扫描插件目录
  async discoverPlugins() {
    const files = await fs.readdir(this.pluginsDir);
    for (const file of files) {
      const manifestPath = path.join(this.pluginsDir, file, 'manifest.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        this.plugins.set(manifest.id, {
          manifest,
          status: 'discovered',
          router: null
        });
      }
    }
  }

  // 启动插件
  async startPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error('Plugin not found');

    const pluginModule = await import(path.join(this.pluginsDir, pluginId, plugin.manifest.entry));
    const router = await pluginModule.default.init(this.globalContext);

    this.app.use(`/api/plugins/${pluginId}`, router);
    plugin.router = router;
    plugin.status = 'running';
  }

  // 停止插件
  async stopPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (plugin && plugin.router) {
      // 移除路由
      plugin.router = null;
      plugin.status = 'stopped';
    }
  }

  // 获取插件列表
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  // 获取活跃插件
  getActivePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    return plugin?.status === 'running' ? plugin : null;
  }
}
```

**使用示例**：

```javascript
const pluginManager = new PluginManager(pluginsDir, app, pluginContext);

// 发现并启动所有插件
await pluginManager.discoverPlugins();
for (const [id, plugin] of pluginManager.plugins) {
  await pluginManager.startPlugin(id);
}
```

### 3.2 AuthService (认证服务)

基于 JWT 的认证服务。

**核心方法**：

```javascript
// server/services/AuthService.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AuthService {
  constructor() {
    this.secretKey = process.env.JWT_SECRET || 'your-secret-key';
  }

  // 登录
  async login(username, password) {
    const user = await this.getUserByUsername(username);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      this.secretKey,
      { expiresIn: '7d' }
    );

    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  // 验证Token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // 创建用户
  async createUser(username, password, role = 'user') {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await this.insertUser(username, passwordHash, role);
    return { id: userId, username, role };
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    const user = await this.getUserById(userId);
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid old password');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.updateUserPassword(userId, newHash);
  }
}
```

### 3.3 CacheService (缓存服务)

基于内存的简单缓存服务。

```javascript
// server/services/CacheService.js
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  // 设置缓存
  set(key, value, ttl = 60000) {
    this.cache.set(key, value);
    
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key));
    }

    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.ttls.delete(key);
    }, ttl);

    this.ttls.set(key, timeout);
  }

  // 获取缓存
  get(key) {
    return this.cache.get(key);
  }

  // 删除缓存
  delete(key) {
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key));
      this.ttls.delete(key);
    }
    this.cache.delete(key);
  }

  // 清空缓存
  clear() {
    for (const timeout of this.ttls.values()) {
      clearTimeout(timeout);
    }
    this.cache.clear();
    this.ttls.clear();
  }
}

export default new CacheService();
```

---

## 4. API路由

### 4.1 配置管理API

```javascript
// server/routes/navlink.js
import express from 'express';
import { readConfig, writeConfig } from '../utils/config.js';

const router = express.Router();

// 获取配置
router.get('/api/config', async (req, res) => {
  try {
    const config = await readConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新配置
router.put('/api/config', async (req, res) => {
  try {
    await writeConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取统计信息
router.get('/api/stats', async (req, res) => {
  try {
    const config = await readConfig();
    const stats = {
      totalLinks: countLinks(config),
      totalCategories: config.categories.length,
      totalPlugins: pluginManager.plugins.size,
      activePlugins: Array.from(pluginManager.plugins.values())
        .filter(p => p.status === 'running').length
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 4.2 插件管理API

```javascript
// server.js
app.get('/api/plugins', authenticateToken, async (req, res) => {
  const plugins = pluginManager.getAllPlugins();
  res.json(plugins);
});

app.post('/api/plugins/:pluginId/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pluginManager.startPlugin(req.params.pluginId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins/:pluginId/stop', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pluginManager.stopPlugin(req.params.pluginId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/plugins/:pluginId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pluginManager.uninstallPlugin(req.params.pluginId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.3 认证API

```javascript
// server.js
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // JWT无状态，客户端删除token即可
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await authService.getUserById(req.user.userId);
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user.userId, oldPassword, newPassword);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/user/permissions', authenticateToken, (req, res) => {
    // 获取当前用户角色的所有权限
    const permissions = getRolePermissions(req.user.role);
    res.json({
        role: req.user.role,
        permissions
    });
});

### 4.4 API 文档 (Swagger/OpenAPI)
 
 项目集成了 Swagger UI 自动生成交互式 API 文档。
 
 - **文档地址**: `http://localhost:3000/api-docs` (开发环境)
 - **配置文件**: `server/config/swagger.js`
 
 **编写规范**:
 使用 JSDoc `/** @swagger ... */` 注释在路由处理函数上方定义文档。
 
 ```javascript
 /**
  * @swagger
  * /api/config:
  *   get:
  *     summary: 获取站点配置
  *     tags: [Config]
  *     responses:
  *       200:
  *         description: 成功返回配置对象
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  */
 app.get('/api/config', ...);
 ```
 
 ---
 
 ## 5. 数据库设计

### 5.1 SQLite Schema

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 租户表
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 配置表
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 日志表
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 数据库操作

```javascript
import Database from 'better-sqlite3';

const db = new Database('./data/navlink.db');

// 查询
function getUser(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

// 插入
function createUser(username, passwordHash, role) {
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  );
  const result = stmt.run(username, passwordHash, role);
  return result.lastInsertRowid;
}

// 更新
function updateUser(id, data) {
  const stmt = db.prepare(
    'UPDATE users SET username = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  );
  stmt.run(data.username, data.role, id);
}

// 删除
function deleteUser(id) {
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  stmt.run(id);
}

// 事务
function transferUser(fromId, toId, amount) {
  const transfer = db.transaction(() => {
    deductBalance(fromId, amount);
    addBalance(toId, amount);
  });
  
  transfer();
}

---
 
 ### 5.3 数据库迁移 (Migrations)
 
 项目引入了基于 SQL 文件的轻量级迁移系统。
 
 **目录位置**: `server/database/migrations/`
 
 **常用命令**:
 - **创建迁移**: `npm run migrate:make <name>`
   - 示例: `npm run migrate:make add_user_email`
   - 生成文件: `server/database/migrations/YYYYMMDDHHmmss_add_user_email.sql`
 - **运行迁移**: `npm run migrate:latest`
   - 服务器启动时也会自动运行未执行的迁移。
 
 **迁移文件示例**:
 ```sql
 -- Migration: add_user_email
 -- Created: 2025-12-09T12:00:00.000Z
 
 ALTER TABLE users ADD COLUMN email TEXT;
 ```
 
 ---
 
 ## 6. 认证与安全

### 6.1 认证中间件

```javascript
// server/middleware/auth.js
import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Token无效，但不阻止请求
    }
  }
  
  next();
}
```

### 6.2 安全中间件

```javascript
// server/middleware/security.js
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

// Helmet配置
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
});

// HTTP参数污染防护
export const hppProtection = hpp();

// 登录限流
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: 'Too many login attempts, please try again later'
});

// API限流
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100, // 最多100次请求
  message: 'Too many requests'
});
```

---

## 7. 插件系统

### 7.1 插件接口规范

插件必须导出一个包含 `init` 方法的对象：

```javascript
// plugins/your-plugin/backend-nodejs/server.js
export default {
  init: async (context) => {
    const router = express.Router();

    // 使用context中的服务
    const { logger, authService, db } = context;

    // 定义路由
    router.get('/api/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    router.get('/api/data', async (req, res) => {
      const data = await getDataFromDB();
      res.json(data);
    });

    logger.info('Plugin initialized');
    return router;
  }
};
```

### 7.2 插件路由注册

```javascript
// server/core/PluginRouter.js
export function createPluginRouter(pluginId, pluginModule, context) {
  const router = pluginModule.init(context);
  
  // 插件路由会被挂载到 /api/plugins/:pluginId
  // 例如: /api/plugins/docker/api/containers
  
  return router;
}
```

---

## 8. 最佳实践

### 8.1 错误处理

```javascript
// 统一错误处理中间件
app.use((err, req, res, next) => {
  logger.error('Server Error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 在路由中使用try-catch
router.get('/api/data', async (req, res, next) => {
  try {
    const data = await getData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
```

### 8.2 日志记录

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 使用
logger.info('Server started on port 3001');
logger.error('Database connection failed', { error: err.message });
```

### 8.3 环境配置

```javascript
// server/config/env.js
import dotenv from 'dotenv';

dotenv.config();

export default {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  dbPath: process.env.DB_PATH || './data/navlink.db',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
```

---

## 总结

本指南涵盖了后端开发的核心内容：

✅ 架构设计和核心模块  
✅ API路由和数据库设计  
✅ 认证与安全  
✅ 插件系统实现  
✅ 最佳实践

继续学习：
- [共享模块开发指南](./共享模块开发指南.md)
- [主站前端开发指南](./主站前端开发指南.md)
- [管理后台开发指南](./管理后台开发指南.md)

---

祝开发愉快！🚀
