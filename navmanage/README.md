# NavManage - NavLink 管理系统

NavManage 是 NavLink 的在线管理系统，用于集中管理授权和插件。

## 功能

- 🔑 **License 管理** - 在线生成、验证、撤销注册码
- 📦 **插件管理** - 上传、版本控制、下载统计
- 📋 **Registry 自动生成** - 为 NavLink 提供插件仓库

## 快速开始

### 使用 Docker Compose (推荐)

```bash
# 进入目录
cd navmanage

# 创建环境变量文件
cat > .env << EOF
JWT_SECRET=your-secure-jwt-secret
ADMIN_PASSWORD=your-admin-password
LICENSE_PRIVATE_KEY=your-ecdsa-private-key
BASE_URL=https://your-domain.com
EOF

# 启动服务
docker-compose up -d
```

### 开发模式

```bash
# 后端
cd backend
npm install
npm run dev

# 前端 (另一个终端)
cd frontend
npm install
npm run dev
```

## 配置 NavLink

在 NavLink 中设置环境变量以使用此服务：

```bash
# 插件仓库地址
PLUGIN_REGISTRY_URL=https://your-navmanage-domain.com/api/registry.json
```

## 环境变量

| 变量 | 说明 | 默认值 |
|-----|------|--------|
| PORT | 服务端口 | 3010 |
| JWT_SECRET | JWT 密钥 | 随机生成 |
| ADMIN_PASSWORD | 管理员密码 | admin123 |
| LICENSE_PRIVATE_KEY | ECDSA 私钥 | 内置测试密钥 |
| BASE_URL | 服务公网地址 | http://localhost:3010 |

## 目录结构

```
navmanage/
├── frontend/          # React 前端
├── backend/           # Express 后端
│   ├── routes/        # API 路由
│   ├── services/      # 业务服务
│   ├── data/          # SQLite 数据库
│   └── uploads/       # 插件文件存储
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 端口

- **3010** - NavManage 服务 (生产)
- **5174** - 前端开发服务器
