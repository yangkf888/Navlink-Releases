# 快速开始

本指南将帮助您在 **5 分钟内** 部署 NavLink 导航站。

<div class="tip-banner">
  <span class="icon">💡</span>
  <span>推荐使用 Docker 部署，简单快捷，支持一键升级</span>
</div>

<style>
.tip-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0;
}
.tip-banner .icon {
  font-size: 1.5rem;
}
</style>

## 环境要求

| 项目 | 要求 |
|------|------|
| **Docker** | 20.10+（推荐） |
| **内存** | 1GB+ |
| **磁盘** | 1GB+ |

## Docker 部署

### 方式一：使用 docker-compose（推荐）

**1. 创建项目目录**

```bash
mkdir navlink && cd navlink
```

**2. 创建 docker-compose.yml**

```yaml
services:
  navlink:
    image: ghcr.io/txwebroot/navlink-releases:latest
    container_name: navlink-app
    hostname: navlink-app  # 固定 hostname，防止升级后指纹变化需重新激活
    restart: unless-stopped
    ports:
      - "8000:3002"
    environment:
      - TZ=Asia/Shanghai
      - NODE_ENV=production
      - JWT_SECRET=your-secret-key-change-me
      - DEFAULT_ADMIN_PASSWORD=admin123
    volumes:
      - ./data:/app/data
      - ./plugins:/app/plugins
      - ./logs:/app/logs
      # Docker 插件需要（可选）
      - /var/run/docker.sock:/var/run/docker.sock
```

**3. 启动服务**

```bash
docker compose up -d
```

**4. 访问站点**

打开浏览器访问 `http://localhost:8000`

::: tip 💡 默认账户
- 用户名：`admin`
- 密码：`admin123`

⚠️ 请登录后立即修改密码！
:::

---

### 方式二：直接使用 docker run

```bash
docker run -d \
  --name navlink \
  --hostname navlink-app \
  -p 8000:3002 \
  -e TZ=Asia/Shanghai \
  -e JWT_SECRET=your-secret-key \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/plugins:/app/plugins \
  ghcr.io/txwebroot/navlink-releases:latest
```

---

## 验证部署

<div class="step-cards">

<div class="step-card">
  <div class="step-number">1</div>
  <div class="step-content">
    <h4>访问站点</h4>
    <p>打开 http://localhost:8000</p>
  </div>
</div>

<div class="step-card">
  <div class="step-number">2</div>
  <div class="step-content">
    <h4>登录后台</h4>
    <p>使用默认账号登录</p>
  </div>
</div>

<div class="step-card">
  <div class="step-number">3</div>
  <div class="step-content">
    <h4>修改密码</h4>
    <p>进入设置修改密码</p>
  </div>
</div>

</div>

<style>
.step-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
}

@media (max-width: 768px) {
  .step-cards {
    grid-template-columns: 1fr;
  }
}

.step-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  transition: all 0.3s ease;
}

.step-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.step-number {
  background: linear-gradient(135deg, #646cff 0%, #41d1ff 100%);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 0.25rem 0;
  font-weight: 600;
}

.step-content p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
</style>

## 常见问题

### 端口被占用？

修改 docker-compose.yml 中的端口映射：

```yaml
ports:
  - "8080:3002"  # 改为 8080 或其他端口
```

### 容器无法启动？

查看日志排查问题：

```bash
docker logs navlink-app
```

## 下一步

<div class="next-steps">

- 📖 [Docker 部署详解](/guide/docker-deploy) - 更多配置选项
- ⚙️ [配置说明](/guide/configuration) - 自定义您的导航站
- ❓ [常见问题](/guide/faq) - 遇到问题？

</div>

<style>
.next-steps {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.next-steps ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.next-steps li {
  padding: 0.5rem 0;
}

.next-steps a {
  font-weight: 500;
}
</style>
