# NavLink 安装指南

## 🚀 快速开始

### 1. 环境要求

- Docker 和 Docker Compose
- （可选）Node.js 20+ 用于本地开发

### 2. 安装步骤

#### 步骤 1：克隆或解压项目

```bash
cd navlink
```

#### 步骤 2：配置环境变量

```bash
# 从模板创建配置文件
cp .env.example .env

# 编辑配置文件
vim .env  # 或使用其他编辑器
```

**必须修改的配置**：

```bash
# 安全密钥（必须修改！）
JWT_SECRET=<生成32位随机字符串>
SESSION_SECRET=<生成32位随机字符串>
ENCRYPTION_KEY=<生成32位随机字符串>

# 管理员账号（建议修改）
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=<设置强密码>

# 插件注册表（如果需要应用商城）
PLUGIN_REGISTRY_URL=https://your-registry-url.com/plugins.json
```

**生成强密钥**：

```bash
# 使用 OpenSSL 生成
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 步骤 3：启动服务

```bash
# 构建并启动
docker compose up -d

# 查看日志
docker compose logs -f
```

#### 步骤 4：访问应用

- 主页：http://localhost:3001
- 管理后台：http://localhost:3001/admin
- 默认账号：admin / 你设置的密码

---

## 🔒 安全建议

1. **更改默认密钥**：绝不使用 `.env.example` 中的示例值
2. **使用强密码**：管理员密码至少12位，包含大小写、数字、符号
3. **定期备份**：数据目录 `data/` 包含所有配置和数据
4. **HTTPS 部署**：生产环境使用反向代理（Nginx）配置 HTTPS

---

## 📂 数据持久化

所有数据存储在以下目录（Docker 卷）：

```
data/       - 数据库和配置
plugins/    - 已安装的插件
logs/       - 日志文件
```

**备份方法**：

```bash
# 停止服务
docker compose down

# 备份数据
tar czf navlink-backup-$(date +%Y%m%d).tar.gz data/ plugins/

# 重启服务
docker compose up -d
```

---

## 🔧 常见问题

### Q: 忘记管理员密码？

```bash
# 重置密码（需要修改数据库）
docker compose down
# 删除 data/auth.db，重启时会使用 .env 中的默认账号重新创建
docker compose up -d
```

### Q: 如何更新？

```bash
# 拉取最新代码
git pull  # 或解压新版本

# 重新构建
docker compose build

# 重启
docker compose down && docker compose up -d
```

### Q: 端口冲突？

修改 `docker-compose.yml`：

```yaml
ports:
  - "8080:3001"  # 改为其他端口
```

---

## 📞 支持

- 文档：查看项目 README.md
- 问题反馈：GitHub Issues
- 更多配置：查看 `.env.example` 中的注释

---

**重要提醒**：
- ⚠️ `.env` 文件包含敏感信息，不要分享给他人
- ⚠️ 不要将 `.env` 提交到 Git
- ⚠️ 定期更换密钥和密码
