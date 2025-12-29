# NavManage 项目说明文档

NavManage 是 NavLink 生态系统的核心服务，负责授权管理、激活验证以及插件分发。

## 1. 项目简介

**主要功能：**
- **授权中心 (Auth Server)**: 管理用户激活码，验证客户端的激活请求，绑定机器指纹。
- **插件市场 (Plugin Registry)**: 提供插件元数据 API (`registry.json`) 和插件文件下载服务。
- **后台管理**: 提供 Web 界面供管理员生成激活码、管理用户和上传插件。

**技术栈：**
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: SQLite (`sql.js` / `better-sqlite3` compatible wrapper)
- **Auth**: JWT (JSON Web Token) for Admin, Custom Auth Token for Clients

## 2. 目录结构

```
navmanage/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # 管理员认证
│   │   ├── activation.js    # 激活码与用户管理
│   │   ├── plugins.js       # 插件 CRUD 与下载
│   │   └── registry.js      # 插件注册表 API
│   ├── services/
│   │   └── Database.js      # 数据库初始化与操作封装
│   ├── uploads/             # 插件文件存储目录
│   └── server.js            # 入口文件
├── frontend/                # 管理后台前端 (React/Vue)
└── data/                    # SQLite 数据库文件存储 (navmanage.db)
```

## 3. 数据库设计 (Schema)

所有数据存储在 `data/navmanage.db` SQLite 数据库中。

### 核心表
| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `admin_users` | 管理员账户 | `username`, `password` (Plaintext/Hash) |
| `users` | 注册用户 | `email`, `max_activations`, `used_activations` |
| `activation_codes` | 激活码 | `code`, `user_id`, `remaining_installs`, `status` |
| `active_licenses` | 已激活实例 | `fingerprint`, `auth_token`, `activation_code_id` |
| `plugins` | 插件信息 | `id`, `name`, `version`, `download_count` |
| `plugin_versions` | 插件版本 | `plugin_id`, `version`, `file_path`, `changelog` |

## 4. API 接口文档

### A. 公开接口 (Public APIs)
供 NavLink 客户端调用，无需管理员权限。

#### 1. 系统激活
- **URL**: `/api/activation/activate`
- **Method**: `POST`
- **Body**: `{ code, email, fingerprint, fingerprintDetails }`
- **Response**: `{ success: true, authToken: "..." }`
- **说明**: 验证激活码，绑定指纹，返回长期有效的 Auth Token。

#### 2. 申请迁移
- **URL**: `/api/activation/request-new-code`
- **Method**: `POST`
- **Body**: `{ authToken, email }`
- **说明**: 撤销当前设备授权，生成并返回一个新的单次使用激活码。

#### 3. 插件注册表
- **URL**: `/api/registry.json`
- **Method**: `GET`
- **Response**: 返回插件列表 JSON (包含下载链接)。
- **说明**: NavLink 插件市场通过此接口获取可用插件列表。

#### 4. 插件下载
- **URL**: `/api/plugins/:id/download/:version`
- **Method**: `GET`
- **说明**: 下载指定版本的插件 ZIP 包。

---

### B. 管理接口 (Admin APIs)
供 NavManage 前端后台调用，需 Header `Authorization: Bearer <token>`。

#### 1. 认证
- `POST /api/auth/login`: 管理员登录。
- `PUT /api/auth/profile`: 修改管理员密码。

#### 2. 用户与激活码管理
- `GET /api/activation/users`: 获取所有用户列表。
- `POST /api/activation/users`: 创建新用户（自动生成激活码）。
- `POST /api/activation/codes/batch`: 批量生成未绑定激活码。
- `GET /api/activation/licenses`: 查看所有已激活的设备记录。
- `POST /api/activation/licenses/:id/revoke`: 强制撤销某个设备的授权。

#### 3. 插件管理
- `POST /api/plugins`: 创建新插件元数据。
- `POST /api/plugins/:id/upload`: 上传插件新版本文件。
- `PUT /api/plugins/:id`: 更新插件详情。
- `DELETE /api/plugins/:id`: 删除插件及其所有版本。

## 5. 扩展开发指南

### 添加新功能
1. **定义路由**: 在 `backend/routes/` 下新建路由文件 (e.g., `statistics.js`)。
2. **注册路由**: 在 `backend/server.js` 中引入并挂载: `app.use('/api/stats', statsRoutes)`.
3. **数据库变更**: 如果需要新表，在 `backend/services/Database.js` 的 `initDatabase` 函数中添加 `CREATE TABLE` 语句。

### 环境变量
- `PORT`: 服务端口 (默认 3010)。
- `JWT_SECRET`: 管理员 Token 签名密钥。
- `BASE_URL`: (可选) 用于生成插件下载链接的基础 URL。如果不设置，自动使用请求 Host。
