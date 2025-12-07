# NavLink 安装指南（Docker 镜像版）

## 🚀 快速开始

### 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 2GB 可用内存
- 5GB 可用磁盘

### 安装步骤

#### 1. 解压安装包

```bash
unzip navlink-v1.0.0.zip
cd navlink-install
```

#### 2. 配置环境变量

```bash
# 从模板创建配置文件
cp .env.example .env

# 编辑配置（必须修改密钥！）
vim .env
```

**必须修改的配置**：

```bash
# 安全密钥（使用随机字符串）
JWT_SECRET=<修改为32位随机字符串>
SESSION_SECRET=<修改为32位随机字符串>
ENCRYPTION_KEY=<修改为32位随机字符串>

# 管理员密码（建议修改）
DEFAULT_ADMIN_PASSWORD=<设置强密码>
```

**快速生成密钥**：

```bash
# macOS/Linux
openssl rand -base64 32

# 或使用
head -c 32 /dev/urandom | base64
```

#### 3. 启动服务

```bash
docker compose up -d
```

#### 4. 访问应用

- **主页**: http://localhost:3001
- **管理后台**: http://localhost:3001/admin
- **默认账号**: admin / 您设置的密码

---

## 📊 管理命令

### 查看状态

```bash
docker compose ps
```

### 查看日志

```bash
docker compose logs -f
```

### 停止服务

```bash
docker compose down
```

### 重启服务

```bash
docker compose restart
```

### 更新到最新版本

```bash
# 拉取最新镜像
docker compose pull

# 重启服务
docker compose down
docker compose up -d
```

---

## 💾 数据备份

### 备份所有数据

```bash
# 停止服务
docker compose down

# 备份数据目录
tar czf navlink-backup-$(date +%Y%m%d).tar.gz data/ plugins/ logs/

# 重启服务
docker compose up -d
```

### 恢复数据

```bash
# 停止服务
docker compose down

# 解压备份
tar xzf navlink-backup-20241207.tar.gz

# 重启服务
docker compose up -d
```

---

## 🔧 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker compose logs

# 检查端口占用
lsof -i :3001

# 检查权限
ls -la data/ plugins/ logs/
```

### 忘记管理员密码

```bash
# 方法1：重置数据库（会丢失数据）
docker compose down
rm -rf data/auth.db
docker compose up -d

# 方法2：修改 .env 中的默认密码后重启
vim .env
docker compose restart
```

### 应用商城无法访问

检查 `.env` 文件中的 `PLUGIN_REGISTRY_TOKEN` 是否正确配置。

---

## 🔒 安全建议

1. **更改默认密钥** - 使用强随机字符串
2. **使用强密码** - 管理员密码至少12位
3. **定期备份** - 至少每周备份一次
4. **限制访问** - 使用防火墙限制端口访问
5. **HTTPS** - 生产环境使用 Nginx 反向代理

---

## 📝 配置说明

### 端口配置

默认端口: 3001

修改端口（编辑 `docker-compose.yml`）：

```yaml
ports:
  - "8080:3001"  # 主机端口:容器端口
```

### 数据目录

| 目录 | 说明 |
|------|------|
| `data/` | 数据库和配置文件 |
| `plugins/` | 已安装的插件 |
| `logs/` | 应用日志 |

---

## 🎯 应用商城

应用商城已预先配置，无需额外设置。

进入管理后台 → 系统设置 → 应用商城，即可浏览和安装插件。

---

## 📞 技术支持

- 使用问题：查看日志 `docker compose logs`
- 功能建议：联系管理员
- 紧急问题：检查官方文档

---

## ⚠️ 重要提醒

- 不要将 `.env` 文件分享给他人
- 定期更新到最新版本
- 生产环境务必修改所有默认密钥

---

**祝使用愉快！** 🎉
