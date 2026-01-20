# Docker 部署详解

本文详细介绍 NavLink 的 Docker 部署方式和高级配置选项。

<div class="info-banner">
  <div class="info-icon">🐳</div>
  <div class="info-content">
    <strong>Docker 镜像信息</strong>
    <p>镜像：<code>ghcr.io/txwebroot/navlink-releases</code> | 架构：amd64 / arm64 | 大小：~200MB</p>
  </div>
</div>

<style>
.info-banner {
  background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
}
.info-banner .info-icon {
  font-size: 2.5rem;
}
.info-banner .info-content strong {
  font-size: 1.1rem;
  color: white;
}
.info-banner .info-content p {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.95);
}
.info-banner code {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
  font-size: 0.9em;
}
</style>

## 完整 docker-compose.yml

参考官方部署配置：

```yaml
services:
  navlink:
    # 使用 GitHub Container Registry 镜像 (公共发布版)
    image: ghcr.io/txwebroot/navlink-releases:latest
    container_name: navlink-app
    hostname: navlink-app #固定hostname,防止在线升级指纹变化需要重新激活
    restart: unless-stopped

    # 加载 .env 文件中的环境变量
    env_file:
      - .env

    ports:
      - "8000:${PORT}"

    environment:
      # 核心配置
      NODE_ENV: ${NODE_ENV}
      PORT: ${PORT}

      # 安全密钥
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      SESSION_SECRET: ${SESSION_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}

      # 默认管理员账号
      DEFAULT_ADMIN_USERNAME: ${DEFAULT_ADMIN_USERNAME}
      DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD}

      # Redis Configuration
      REDIS_ENABLED: ${REDIS_ENABLED}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PORT: ${REDIS_PORT}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      REDIS_DB: ${REDIS_DB}

      # Backup Configuration
      BACKUP_ENABLED: ${BACKUP_ENABLED}
      BACKUP_SCHEDULE: ${BACKUP_SCHEDULE}
      BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS}
      BACKUP_PATH: ${BACKUP_PATH}

    volumes:
      # 持久化数据存储在当前目录
      - ./data:/app/data
      - ./plugins:/app/plugins
      - ./logs:/app/logs
      # Docker socket挂载 - 允许Docker插件管理宿主机Docker
      - /var/run/docker.sock:/var/run/docker.sock

  redis:
    image: redis:alpine
    container_name: navlink-redis
    restart: unless-stopped
    volumes:
      - ./redis_data:/data
```

::: warning ⚠️ 重要配置说明
- `hostname: navlink-app` - **必须固定**，防止容器重建后指纹变化导致需要重新激活
- `JWT_SECRET` - 生产环境**务必修改**为随机字符串
- 所有环境变量需在 `.env` 文件中定义
:::

## .env 文件示例

在 `docker-compose.yml` 同级目录下创建 `.env` 文件，内容参考如下：

```bash
# 运行环境
NODE_ENV=production
# 容器内部服务端口
PORT=3001

# 安全密钥 (生产环境务必修改，建议 32 位随机字符)
JWT_SECRET=your-super-secret-random-string
SESSION_SECRET=your-session-secret-string
ENCRYPTION_KEY=your-encryption-key-32-chars

# Token 有效期
JWT_EXPIRES_IN=24h

# 初始管理员账号 (仅首次启动有效)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# Redis 配置 (如不使用可设为 false)
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# 自动备份配置
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 3 * * *"
BACKUP_RETENTION_DAYS=7
BACKUP_PATH=/app/data/backups
```

## Redis 配置场景指南

根据您的需求选择最合适的 Redis 配置方式：

### 场景 A：使用自带的 Redis 容器 (推荐)
如果您没有现成的 Redis 服务，直接使用 `docker-compose.yml` 中定义的容器最为方便。

*   **`.env` 配置**：
    *   `REDIS_ENABLED=true`
    *   `REDIS_HOST=redis` (匹配 compose 中的服务名)
    *   `REDIS_PORT=6379`
*   **注意**：请保持 `docker-compose.yml` 中的 `redis` 服务定义不被注释。

### 场景 B：复用外部 Redis (如宿主机或其他容器)
如果您已经有一个运行中的 Redis 服务，可以删除多余的容器以节省资源。

*   **`.env` 配置**：
    *   `REDIS_ENABLED=true`
    *   `REDIS_HOST=192.168.1.100` (指向您的实际 Redis IP)
    *   `REDIS_PORT=6379`
    *   `REDIS_PASSWORD=your_password` (如有密码请务必填写)
*   **清理步骤**：
    1.  注释或删除 `docker-compose.yml` 中的 `redis` 服务代码块。
    2.  注释或删除 `docker-compose.yml` 中的 `redis_data` 卷定义。

### 场景 C：不使用 Redis
NavLink 依然可以运行，但性能和响应速度会有轻微下降。

*   **`.env` 配置**：`REDIS_ENABLED=false`
*   **清理**：可安全删除 compose 文件中的所有 `redis` 相关部分。

## 环境变量说明

以下变量需在 `.env` 文件中配置：

<div class="var-table">

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `production` | 运行环境 |
| `PORT` | `3001` | 服务端口 |
| `JWT_SECRET` | `your-random-secret` | JWT 密钥 ⚠️ 必须修改 |
| `JWT_EXPIRES_IN` | `24h` | Token 有效期 |
| `SESSION_SECRET` | `your-session-secret` | Session 密钥 ⚠️ |
| `ENCRYPTION_KEY` | `your-encryption-key` | 加密密钥 ⚠️ |
| `DEFAULT_ADMIN_USERNAME` | `admin` | 初始管理员用户名 |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | 初始管理员密码 ⚠️ 首次登录后修改 |
| `REDIS_ENABLED` | `true` | 是否启用 Redis 缓存 |
| `REDIS_HOST` | `redis` | Redis 主机地址 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | `your_password` | Redis 密码 (没有留空) |
| `REDIS_DB` | `0` | Redis 数据库索引 (0-15) |
| `BACKUP_ENABLED` | `true` | 是否启用自动备份 |
| `BACKUP_SCHEDULE` | `0 3 * * *` | 备份 Cron 表达式 |
| `BACKUP_RETENTION_DAYS` | `7` | 备份保留天数 |
| `BACKUP_PATH` | `/app/data/backups` | 备份存储路径 |

</div>

## 数据目录说明

```
./data/
├── navlink.db     # 主数据库（配置、分类、链接）
├── auth.db        # 认证数据库（用户、权限）
├── docker.db      # Docker 插件数据
├── vps.db         # VPS 插件数据
├── sub.db         # 订阅插件数据
├── kbrag.db       # 知识库插件数据
├── video.db       # 视频插件数据
├── uploads        # 图标/图片数据
├── cache          # video插件视频封面数据
├── transcode      # video插件视频转码临时数据（会自动删除）
└── backups/       # 自动备份目录
```

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name nav.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nav.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

### Caddy

```
nav.example.com {
    reverse_proxy localhost:8000
}
```

## 升级指南

### 方式一：命令行升级

<div class="upgrade-steps">

```bash
# 1. 拉取最新镜像
docker compose pull

# 2. 重启服务（数据自动保留）
docker compose up -d

# 3. 查看日志确认启动成功
docker logs -f navlink-app
```

</div>

### 方式二：后台在线升级

NavLink 支持在系统管理后台直接进行在线升级：

1. 登录管理后台
2. 进入「系统管理」→「系统升级」
3. 点击「检查更新」查看最新版本
4. 点击「立即升级」自动完成升级

::: info 💡 在线升级要求
- 容器必须挂载 Docker Socket (`/var/run/docker.sock`)
- 需要网络能够访问 GitHub Container Registry
:::

::: tip 💡 升级前建议
在后台「数据管理」中导出配置备份，以防万一。
:::

## 常见问题

<details>
<summary><strong>端口冲突怎么办？</strong></summary>

修改 `.env` 文件中的 `PORT` 变量：

```bash
PORT=3001  # 改为您需要的端口
```

然后重启容器即可。

</details>

<details>
<summary><strong>权限问题怎么解决？</strong></summary>

```bash
chmod -R 755 data plugins logs
```

</details>

<details>
<summary><strong>Docker 插件无法连接？</strong></summary>

确保挂载了 docker.sock：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

</details>

<details>
<summary><strong>如何查看详细日志？</strong></summary>

```bash
docker logs navlink-app --tail 100 -f
```

</details>

<details>
<summary><strong>ARM 设备如何安装 FFmpeg？</strong></summary>

Video 插件的便携版 FFmpeg 仅支持 x86_64 架构。对于 ARM 设备（如树莓派、RK3528、玩客云等），需要在容器启动时安装：

修改 `docker-compose.yml`，添加 `command`：

```yaml
services:
  navlink:
    image: ghcr.io/txwebroot/navlink-releases:latest
    command: sh -c "apk add --no-cache ffmpeg && node server.js"
    # ... 其他配置保持不变
```

重启容器后，FFmpeg 会在每次启动时自动安装（约 10-30 秒）。

</details>
