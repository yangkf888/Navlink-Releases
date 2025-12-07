# Docker 操作文档

本文档详细说明了如何将 Navlink-Next 项目打包成 Docker 镜像、上传到镜像仓库以及如何下载和使用镜像。

## 目录
- [前置准备](#前置准备)
- [一、打包 Docker 镜像](#一打包-docker-镜像)
- [二、上传镜像到 GitHub Container Registry](#二上传镜像到-github-container-registry)
- [三、上传镜像到 Docker Hub（可选）](#三上传镜像到-docker-hub可选)
- [四、下载并使用镜像](#四下载并使用镜像)
- [五、常见问题解答](#五常见问题解答)

---

## 前置准备

### 1. 安装 Docker

确保您的系统已安装 Docker。您可以通过以下命令验证：

```bash
docker --version
docker-compose --version
```

如果未安装，请访问 [Docker 官网](https://www.docker.com/get-started) 下载并安装。

### 2. Docker 登录凭证

根据您要上传的镜像仓库，准备相应的账号：

- **GitHub Container Registry (ghcr.io)**：需要 GitHub 账号和个人访问令牌（Personal Access Token）
- **Docker Hub**：需要 Docker Hub 账号

---

## 一、打包 Docker 镜像

### 1.1 基本打包方式

在项目根目录下，执行以下命令构建镜像：

```bash
# 构建镜像（基本方式）
docker build -t navlink-next:latest .

# 或者指定版本号
docker build -t navlink-next:2.0.0 .
```

**说明**：
- `-t` 参数用于指定镜像名称和标签
- `.` 表示使用当前目录的 Dockerfile
- `latest` 是默认标签，建议同时打上版本号标签

### 1.2 使用 Docker Compose 构建

如果您使用 Docker Compose，可以执行：

```bash
# 构建镜像
docker-compose build

# 构建并启动容器
docker-compose up --build
```

### 1.3 多平台构建（推荐）

如果需要构建支持多个平台（如 AMD64 和 ARM64）的镜像：

```bash
# 创建并使用 buildx 构建器
docker buildx create --use --name multiarch-builder

# 构建多平台镜像
docker buildx build --platform linux/amd64,linux/arm64 \
  -t navlink-next:latest \
  --load .
```

**注意**：多平台构建需要 Docker Buildx 支持。

### 1.4 验证镜像

构建完成后，验证镜像是否成功创建：

```bash
# 查看本地镜像列表
docker images | grep navlink-next

# 查看镜像详细信息
docker inspect navlink-next:latest
```

---

## 二、上传镜像到 GitHub Container Registry

GitHub Container Registry (GHCR) 是 GitHub 提供的免费镜像托管服务，特别适合开源项目。

### 2.1 创建 GitHub Personal Access Token

1. 登录 GitHub，进入 **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
2. 点击 **Generate new token** > **Generate new token (classic)**
3. 设置权限，至少勾选以下权限：
   - `write:packages` - 上传镜像
   - `delete:packages` - 删除镜像（可选）
   - `read:packages` - 下载镜像
4. 点击 **Generate token** 并**保存好生成的 Token**（只显示一次）

### 2.2 登录 GitHub Container Registry

```bash
# 使用环境变量存储 Token（推荐）
export GITHUB_TOKEN=your_github_token_here

# 登录 GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

或者直接输入密码：

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# 提示输入密码时，粘贴您的 Personal Access Token
```

**重要说明**：
- `YOUR_GITHUB_USERNAME` 替换为您的 GitHub 用户名
- 密码使用您的 Personal Access Token，**不是** GitHub 登录密码

### 2.3 为镜像打标签

```bash
# 格式：ghcr.io/用户名/镜像名:标签
docker tag navlink-next:latest ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
docker tag navlink-next:latest ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:2.0.0

# 示例（假设用户名是 txwebroot）
docker tag navlink-next:latest ghcr.io/txwebroot/navlink-next:latest
docker tag navlink-next:latest ghcr.io/txwebroot/navlink-next:2.0.0
```

### 2.4 推送镜像到 GHCR

```bash
# 推送 latest 标签
docker push ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest

# 推送版本标签
docker push ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:2.0.0
```

### 2.5 设置镜像为公开（可选）

默认情况下，推送到 GHCR 的镜像是私有的。如需公开：

1. 访问 `https://github.com/YOUR_GITHUB_USERNAME?tab=packages`
2. 找到 `navlink-next` 包
3. 点击 **Package settings**
4. 滚动到底部，点击 **Change visibility** > **Public**

### 2.6 一键推送脚本（推荐）

创建一个推送脚本以简化操作：

```bash
# 创建脚本文件
cat > scripts/push-to-ghcr.sh << 'EOF'
#!/bin/bash

# 配置变量
GITHUB_USERNAME="YOUR_GITHUB_USERNAME"
IMAGE_NAME="navlink-next"
VERSION=${1:-latest}

# 登录 GHCR
echo "登录 GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# 构建镜像
echo "构建 Docker 镜像..."
docker build -t ${IMAGE_NAME}:${VERSION} .

# 打标签
echo "为镜像打标签..."
docker tag ${IMAGE_NAME}:${VERSION} ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${VERSION}

# 如果不是 latest，同时推送 latest 标签
if [ "$VERSION" != "latest" ]; then
  docker tag ${IMAGE_NAME}:${VERSION} ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:latest
fi

# 推送镜像
echo "推送镜像到 GHCR..."
docker push ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${VERSION}

if [ "$VERSION" != "latest" ]; then
  docker push ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:latest
fi

echo "✅ 镜像推送完成！"
echo "镜像地址: ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${VERSION}"
EOF

# 设置执行权限
chmod +x scripts/push-to-ghcr.sh
```

使用脚本：

```bash
# 设置环境变量
export GITHUB_TOKEN=your_github_token_here

# 推送 latest 版本
./scripts/push-to-ghcr.sh

# 推送指定版本
./scripts/push-to-ghcr.sh 2.0.0
```

---

## 三、上传镜像到 Docker Hub（可选）

如果您更倾向于使用 Docker Hub：

### 3.1 登录 Docker Hub

```bash
docker login
# 输入您的 Docker Hub 用户名和密码
```

### 3.2 为镜像打标签

```bash
# 格式：用户名/镜像名:标签
docker tag navlink-next:latest YOUR_DOCKERHUB_USERNAME/navlink-next:latest
docker tag navlink-next:latest YOUR_DOCKERHUB_USERNAME/navlink-next:2.0.0
```

### 3.3 推送镜像

```bash
docker push YOUR_DOCKERHUB_USERNAME/navlink-next:latest
docker push YOUR_DOCKERHUB_USERNAME/navlink-next:2.0.0
```

---

## 四、下载并使用镜像

### 4.1 从 GitHub Container Registry 拉取镜像

#### 公开镜像（无需登录）

```bash
# 拉取 latest 版本
docker pull ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest

# 拉取指定版本
docker pull ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:2.0.0
```

#### 私有镜像（需要登录）

```bash
# 登录 GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 拉取镜像
docker pull ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
```

### 4.2 从 Docker Hub 拉取镜像

```bash
# 公开镜像
docker pull YOUR_DOCKERHUB_USERNAME/navlink-next:latest

# 私有镜像（先登录）
docker login
docker pull YOUR_DOCKERHUB_USERNAME/navlink-next:latest
```

### 4.3 使用 Docker Run 启动容器

#### 基本启动方式

```bash
docker run -d \
  --name navlink-next \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/plugins:/app/plugins \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
```

#### 完整配置启动（推荐）

```bash
docker run -d \
  --name navlink-next \
  --restart unless-stopped \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e JWT_SECRET=your-super-secret-jwt-key \
  -e SESSION_SECRET=your-super-secret-session-key \
  -e ENCRYPTION_KEY=your-32-character-encryption-key \
  -e DEFAULT_ADMIN_USERNAME=admin \
  -e DEFAULT_ADMIN_PASSWORD=admin123 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/plugins:/app/plugins \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
```

**参数说明**：
- `--name`：容器名称
- `--restart unless-stopped`：自动重启策略
- `-p 3001:3001`：端口映射（主机:容器）
- `-e`：环境变量
- `-v`：数据卷挂载（主机路径:容器路径）

### 4.4 使用 Docker Compose 启动（推荐）

#### 创建 docker-compose.yml 文件

如果您还没有该文件，创建 `docker-compose.yml`：

```yaml
services:
  navlink2:
    container_name: navlink2-app
    image: ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key-please-change-in-production}
      - SESSION_SECRET=${SESSION_SECRET:-your-super-secret-session-key-please-change-in-production}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-your-32-character-encryption-key}
      - DEFAULT_ADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME:-admin}
      - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-admin123}
      - PLUGIN_REGISTRY_TOKEN=${PLUGIN_REGISTRY_TOKEN:-}
    volumes:
      - ./data:/app/data
      - ./plugins:/app/plugins
      - ./logs:/app/logs
```

#### 创建 .env 文件

复制示例配置文件并修改：

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置（使用您喜欢的编辑器）
nano .env  # 或使用 vim、code 等
```

**重要配置项**（务必修改）：
```env
# 安全密钥（生产环境必须修改）
JWT_SECRET=your-unique-jwt-secret-key-min-32-chars
SESSION_SECRET=your-unique-session-secret-key-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key-exactly-32-chars

# 默认管理员账号
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your-secure-password

# 应用端口
PORT=3001
```

#### 启动服务

```bash
# 启动服务（后台运行）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止并删除数据卷（谨慎使用！）
docker-compose down -v
```

### 4.5 访问应用

启动成功后，在浏览器中访问：

```
http://localhost:3001
```

或使用服务器 IP：

```
http://你的服务器IP:3001
```

### 4.6 容器管理命令

```bash
# 查看运行中的容器
docker ps

# 查看所有容器（包括已停止）
docker ps -a

# 查看容器日志
docker logs navlink-next
docker logs -f navlink-next  # 实时查看

# 进入容器内部
docker exec -it navlink-next sh

# 停止容器
docker stop navlink-next

# 启动容器
docker start navlink-next

# 重启容器
docker restart navlink-next

# 删除容器
docker rm navlink-next

# 删除镜像
docker rmi ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
```

---

## 五、常见问题解答

### Q1: 如何更新到新版本？

```bash
# 方法一：使用 Docker Compose
docker-compose pull          # 拉取最新镜像
docker-compose up -d         # 重建并启动容器

# 方法二：使用 Docker 命令
docker pull ghcr.io/YOUR_GITHUB_USERNAME/navlink-next:latest
docker stop navlink-next
docker rm navlink-next
# 然后重新运行 docker run 命令
```

### Q2: 数据会丢失吗？

不会。只要您正确挂载了数据卷（`-v`），数据会存储在宿主机上：
- `./data`：数据库和应用数据
- `./plugins`：插件文件
- `./logs`：日志文件

即使删除容器，这些数据仍然保留。

### Q3: 如何查看容器内的文件？

```bash
# 进入容器
docker exec -it navlink-next sh

# 查看目录结构
ls -la /app
```

### Q4: 端口被占用怎么办？

修改端口映射：

```bash
# 将主机端口改为 8080
docker run -p 8080:3001 ...

# 或修改 docker-compose.yml
ports:
  - "8080:3001"
```

### Q5: 如何备份数据？

```bash
# 备份数据目录
tar -czf navlink-backup-$(date +%Y%m%d).tar.gz data plugins

# 恢复数据
tar -xzf navlink-backup-20231207.tar.gz
```

### Q6: 无法连接到 GHCR？

可能的解决方案：

1. **检查网络连接**：
```bash
ping ghcr.io
```

2. **使用代理**（如果在中国大陆）：
```bash
# 设置 Docker 代理
mkdir -p ~/.docker
cat > ~/.docker/config.json << EOF
{
  "proxies": {
    "default": {
      "httpProxy": "http://proxy.example.com:8080",
      "httpsProxy": "http://proxy.example.com:8080"
    }
  }
}
EOF
```

3. **使用镜像加速**：
   - 配置 Docker 镜像加速器（阿里云、腾讯云等）

### Q7: 如何查看镜像构建历史？

```bash
# 查看镜像层
docker history navlink-next:latest

# 查看镜像详细信息
docker inspect navlink-next:latest
```

### Q8: 生产环境部署建议？

1. **使用反向代理**（Nginx、Caddy）：
```nginx
# Nginx 配置示例
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

2. **启用 HTTPS**（使用 Let's Encrypt）
3. **设置防火墙规则**
4. **定期备份数据**
5. **监控容器状态**

### Q9: 如何清理未使用的 Docker 资源？

```bash
# 清理未使用的容器
docker container prune

# 清理未使用的镜像
docker image prune

# 清理未使用的数据卷
docker volume prune

# 清理所有未使用的资源（谨慎使用）
docker system prune -a
```

### Q10: 忘记管理员密码怎么办？

```bash
# 停止容器
docker-compose down

# 修改 .env 文件中的密码
nano .env

# 删除数据库（会重置所有数据，谨慎使用！）
rm data/navlink.db

# 重新启动
docker-compose up -d
```

---

## 附录

### A. 快速参考命令

```bash
# === 构建和推送 ===
docker build -t navlink-next:latest .
docker tag navlink-next:latest ghcr.io/username/navlink-next:latest
docker push ghcr.io/username/navlink-next:latest

# === 拉取和运行 ===
docker pull ghcr.io/username/navlink-next:latest
docker-compose up -d

# === 日常管理 ===
docker-compose logs -f        # 查看日志
docker-compose restart        # 重启服务
docker-compose down           # 停止服务
docker-compose pull && docker-compose up -d  # 更新服务
```

### B. 环境变量完整列表

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `NODE_ENV` | 运行环境 | production | 否 |
| `PORT` | 应用端口 | 3001 | 否 |
| `JWT_SECRET` | JWT 密钥 | - | 是 |
| `SESSION_SECRET` | Session 密钥 | - | 是 |
| `ENCRYPTION_KEY` | 加密密钥（32位） | - | 是 |
| `DEFAULT_ADMIN_USERNAME` | 默认管理员用户名 | admin | 是 |
| `DEFAULT_ADMIN_PASSWORD` | 默认管理员密码 | admin123 | 是 |
| `PLUGIN_REGISTRY_URL` | 插件仓库地址 | - | 否 |
| `PLUGIN_REGISTRY_TOKEN` | GitHub Token | - | 否 |

### C. 目录结构说明

```
/app                          # 容器内应用目录
├── dist/                     # 前端构建产物
├── server.js                 # 后端入口文件
├── server/                   # 后端代码
├── data/                     # 数据存储（挂载）
│   └── navlink.db           # SQLite 数据库
├── plugins/                  # 插件目录（挂载）
├── logs/                     # 日志目录（挂载）
└── tmp_packages/            # 临时文件
```

---

## 技术支持

如有问题，请通过以下方式获取帮助：

- **GitHub Issues**: [项目 Issues 页面](https://github.com/YOUR_GITHUB_USERNAME/navlink-next/issues)
- **项目文档**: 查看 `INSTALL.md` 和 `docs/` 目录
- **官方网站**: [项目主页](https://github.com/YOUR_GITHUB_USERNAME/navlink-next)

---

**最后更新时间**: 2025-12-07
**文档版本**: v1.0.0
