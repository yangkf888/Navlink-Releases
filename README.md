# Navlink - 聚合导航与插件化管理系统

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/deployment-docker-blue.svg)](docker-compose.yml)

Navlink 是一款高效、美观且功能强大的聚合导航系统。它采用前后端分离架构，支持高度自定义的主题配置、插件化功能扩展以及一体化的系统检查与升级机制。

---

## 📁 文件夹结构说明

| 文件夹 | 职责说明 |
| :--- | :--- |
| **`server/`** | **核心后端服务**。基于 Node.js/Express，包含路由、业务逻辑、数据库管理及配置。 |
| **`server/config/env.js`** | **配置管理器**。负责加载 `.env` 变量、定义默认值并结构化配置对象，是系统唯一的配置入口。 |
| **`src/`** | **前端源代码**。包含前台导航站 (`navlink`) 和后管理台 (`admin`) 两个子应用。 |
| **`plugins/`** | **本地插件目录**。存放已安装或正在开发的插件包。 |
| **`data/`** | **持久化数据库**。SQLite 数据库文件 (`navlink.db`) 及插件注册表备份。 |
| **`scripts/`** | **自动化脚本**。包含镜像构建、版本发布、环境初始化及混淆加密工具。 |
| **`docs/`** | **技术文档**。包含项目结构说明、插件开发指南、混淆方案等深入技术细节。 |
| **`shared/`** | **前后端共享资源** (在 `src/` 下)。包含通用的 UI 组件、Hooks、API 定义和类型声明。 |
| **`public/`** | **静态资源**。存放图标、图片等无需打包编译的静态文件。 |
| **`chrome-extension/`** | **浏览器扩展**。与 Navlink 配套使用的快速收藏与搜索插件。 |
| **`dist/`** | **构建产物**。前端生产环境打包后生成的文件。 |

---

## 🛠️ 后端服务结构 (`server/`)

后端逻辑高度模块化，主要划分为：

- **`routes/`**: API 接口定义，按功能模块拆分（如系统、插件、用户等）。
- **`services/`**: 业务逻辑层。包含授权验证、升级下载、心跳检测等核心逻辑。
- **`config/`**: 集中化配置管理（环境变量加载、默认值设定等）。
- **`middleware/`**: 权限验证、日志记录等拦截装置。

---

## ⚙️ 环境配置

项目支持通过根目录下的 `.env` 文件进行灵活配置。

## ⚙️ 系统配置说明

项目通过 `server/config/env.js` 统一管理配置，并支持通过 `.env` 进行自定义覆盖。

### 1. 核心服务地址 (Services)
你可以通过自定义这些地址来实现私有化授权或搭建自己的插件市场：

| 环境变量 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `AUTH_SERVER_URL` | **授权/激活服务器**。用于注册码验证、迁移与找回。你可以根据协议自行开发兼容的授权服务器。 | `https://auth.webxx.top` |
| `PLUGIN_REGISTRY_URL`| **插件市场注册表**。系统将从此 JSON 地址拉取插件列表。支持 GitHub Raw 或私有 API 地址。 | `.../api/registry.json` |
| `UPDATE_OWNER` | **更新仓库所有者**。GitHub 自动更新检测的组织/用户名。 | `txwebroot` |
| `UPDATE_REPO` | **更新仓库名**。GitHub 自动更新检测的仓库名称。 | `Navlink-Releases` |

### 2. 模式开关 (Features)
| 环境变量 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `SKIP_LICENSE` | **免激活模式**。设为 `true` 后，系统将跳过所有本地指纹和在线授权校验，变为完全开放版。 | `false` |

---

## 🚀 快速开始

### 方式一：Docker Compose 部署（推荐）

1.  **准备配置文件**：
    复制镜像中预设的 `.env.example` 并重命名为 `.env`，根据需要修改配置。
    ```bash
    cp .env.example .env
    ```

2.  **启动服务**：
    ```bash
    docker-compose up -d
    ```

### 方式二：本地开发
```bash
# 1. 安装依赖
npm install

# 2. 启动前端和后端开发环境
npm run dev:all
```

---

## ⚙️ 配置说明

项目支持通过 `.env` 文件进行高度自定义。详细配置项请参考 [.env.example](file:///Users/txwen/Documents/自建项目/Navlink-Releases/.env.example)。

### 关键环境变量
| 变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `AUTH_SERVER_URL` | 授权/注册服务器地址 | `https://auth.webxx.top` |
| `PLUGIN_REGISTRY_URL`| 插件市场注册表地址 | `https://auth.webxx.top/api/registry.json` |
| `SKIP_LICENSE` | **免激活模式** (true 为跳过验证) | `true` |
| `PORT` | 服务运行端口 | `3001` |
| `ENCRYPTION_KEY` | 敏感数据加密密钥 | `navlink-default-encryption-key-32` |

---

## 🛠️ 常用开发脚本

通过 `npm run <command>` 执行：

| 脚本命令 | 说明 |
| :--- | :--- |
| `dev:all` | **全栈开发模式**。同时启动前端 Vite 开发服务器和后端 Node.js 服务。 |
| `build:all` | **生产构建与混淆**。执行前端打包并对后端代码进行安全混淆，生成 `dist` 和 `dist-server`。 |
| `obfuscate:backend`| **后端代码混淆**。手动触发对 `server/` 源码的保护混淆。 |
| `build:docker` | **本地镜像构建**。在本地直接编译并构建 Docker 镜像，适合本地测试。 |
| `test` | **运行单元测试**。基于 Vitest 执行自动化测试套件。 |

---

## � 运维与自动化脚本 (`scripts/`)

除了常用的 `npm` 指令，`scripts/` 目录下还提供了一些高级运维工具：

| 脚本文件 | 说明 | 使用场景 |
| :--- | :--- | :--- |
| `build-and-push.sh` | **多架构镜像推送到 GHCR** | 开发者正式发布新版本到 GitHub |
| `obfuscate-backend.js` | **后端 Node.js 代码混淆** | 在打包镜像前对源码进行安全加密 |
| `package-plugins.cjs` | **插件自动打包工具** | 将开发好的插件目录打包为符合标准的 ZIP 包 |
| `init-env.sh` | **环境初始化脚本** | 引导新用户安装环境并生成初始配置 |
| `install-from-ghcr.sh` | **远程安装脚本** | 供用户一键从 GitHub 拉取镜像并部署 |
| `make_migration.js` | **数据库迁移生成器** | 数据库结构变更时生成新的历史记录 |

---

## �📜 更多技术细节
- [项目结构说明手册](docs/项目结构说明.md)
- [插件开发与分发指南](docs/共享模块开发指南.md)
- [代码混淆与安全性说明](docs/代码混淆实施说明.md)

---
© 2025 Navlink Team. 基于 Apache License 2.0 协议开源。

