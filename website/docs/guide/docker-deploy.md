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
    # 使用 GitHub Container Registry 镜像
    image: ghcr.io/txwebroot/navlink-releases:latest
    container_name: navlink-app
    hostname: navlink-app  # 固定 hostname，防止升级后指纹变化需重新激活
    restart: unless-stopped

    # 加载环境变量文件（可选）
    env_file:
      - .env

    ports:
      - "8000:3002"

    environment:
      # 核心配置
      NODE_ENV: production
      PORT: 3002
      TZ: Asia/Shanghai

      # 安全密钥（生产环境务必修改）
      JWT_SECRET: your-jwt-secret-change-me
      JWT_EXPIRES_IN: 24h
      SESSION_SECRET: your-session-secret
      ENCRYPTION_KEY: your-encryption-key

      # 默认管理员账号
      DEFAULT_ADMIN_USERNAME: admin
      DEFAULT_ADMIN_PASSWORD: admin123

      # Redis 配置（可选）
      REDIS_ENABLED: "false"
      REDIS_HOST: redis
      REDIS_PORT: 6379

      # 备份配置（可选）
      BACKUP_ENABLED: "true"
      BACKUP_SCHEDULE: "0 3 * * *"
      BACKUP_RETENTION_DAYS: 7
      BACKUP_PATH: /app/data/backups

    volumes:
      # 数据持久化
      - ./data:/app/data
      - ./plugins:/app/plugins
      - ./logs:/app/logs
      # Docker 插件需要挂载 docker.sock
      - /var/run/docker.sock:/var/run/docker.sock

  # Redis 服务（可选，用于缓存）
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
:::

## 环境变量说明

<div class="var-table">

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3002` | 服务端口 |
| `TZ` | `UTC` | 时区设置 |
| `NODE_ENV` | `production` | 运行环境 |
| `JWT_SECRET` | 自动生成 | JWT 密钥 ⚠️ |
| `JWT_EXPIRES_IN` | `24h` | Token 有效期 |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | 初始管理员密码 |
| `LOG_LEVEL` | `info` | 日志级别 |

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

::: tip 💡 升级前建议
在后台「数据管理」中导出配置备份，以防万一。
:::

## 常见问题

<details>
<summary><strong>端口冲突怎么办？</strong></summary>

修改 docker-compose.yml 中的端口：

```yaml
ports:
  - "8080:3002"  # 改为其他端口
```

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
