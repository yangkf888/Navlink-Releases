# Docker 管理插件

<div class="plugin-hero docker">
  <div class="hero-icon">🐳</div>
  <h2>Docker 容器管理</h2>
  <p>轻量级 Docker 可视化管理面板</p>
</div>

<style>
.plugin-hero {
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero.docker {
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
}
.plugin-hero .hero-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}
.plugin-hero h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
  color: white;
}
.plugin-hero p {
  margin: 0;
  opacity: 0.9;
}
</style>

## 功能概述

Docker 管理插件为您提供轻量级的 Docker 可视化管理面板，无需复杂的 Portainer 等工具，即可完成日常容器管理操作。

## 核心功能

### 🏃 容器管理

| 功能 | 说明 |
|------|------|
| **状态查看** | 实时查看所有容器运行状态 |
| **生命周期** | 启动、停止、重启、删除容器 |
| **实时日志** | 查看容器输出日志，支持实时刷新 |
| **详细信息** | 查看容器配置、端口映射、挂载卷等 |

### 📦 镜像管理

- 浏览本地所有镜像列表
- 查看镜像大小、创建时间
- 删除无用镜像释放磁盘空间
- 拉取新镜像

### 🔗 远程连接

支持管理远程服务器上的 Docker：

- **本地 Docker** - 通过 docker.sock 连接
- **SSH 隧道** - 通过 SSH 连接远程服务器的 Docker

## 配置说明

### 挂载 Docker Socket

在 docker-compose.yml 中添加：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### 添加远程节点

1. 进入 Docker 插件
2. 点击「添加节点」
3. 选择连接类型（本地/SSH）
4. 填写服务器信息

## 使用场景

- ✅ 个人服务器容器管理
- ✅ 开发环境 Docker 管理
- ✅ 小型团队容器运维
- ✅ 多服务器统一管理

## 截图预览

> 功能截图待补充
