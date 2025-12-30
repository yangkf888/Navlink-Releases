# VPS 运维插件

<div class="plugin-hero vps">
  <div class="hero-icon">🖥️</div>
  <h2>VPS 服务器运维</h2>
  <p>一站式管理您的所有 VPS 服务器</p>
</div>

<style>
.plugin-hero {
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero.vps {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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

VPS 运维插件提供一站式服务器管理能力，支持多服务器管理、实时监控、SSH 终端和命令片段库。

## 核心功能

### 📊 资源监控

通过 SSH 自动采集并展示服务器实时状态：

| 监控项 | 说明 |
|--------|------|
| **CPU 使用率** | 实时 CPU 占用百分比 |
| **内存占用** | 已用/总内存，占用百分比 |
| **磁盘空间** | 各分区使用情况 |
| **网络延迟** | 服务器响应延迟 |
| **在线状态** | 实时连接状态检测 |

### 📁 分组管理

支持创建多个分组，将服务器分类管理：

- **开发环境** - 开发测试服务器
- **生产环境** - 线上生产服务器
- **个人服务器** - 个人 VPS 小鸡

### 💻 Web SSH 终端

内置网页版 SSH 终端，无需第三方工具：

- 全功能终端模拟
- 支持快捷键
- 支持复制粘贴
- 自动记录会话

### 📝 命令片段 (Snippets)

内置命令库功能，将常用命令保存为片段：

```bash
# 示例：查看系统信息
uname -a && cat /etc/os-release

# 示例：查看磁盘使用
df -h

# 示例：查看内存使用
free -h
```

## 认证方式

支持两种服务器认证方式：

| 方式 | 说明 |
|------|------|
| **密码认证** | 使用用户名和密码登录 |
| **SSH 私钥** | 使用 SSH 密钥对认证 |

::: tip 💡 安全提示
所有敏感信息（密码、私钥）均加密存储，确保安全。
:::

## 添加服务器

1. 进入 VPS 插件
2. 点击「添加服务器」
3. 填写服务器信息：
   - 名称、IP 地址、端口
   - 认证方式（密码/私钥）
   - 所属分组
4. 点击「测试连接」验证
5. 保存即可

## 使用场景

- ✅ 多 VPS 服务器统一管理
- ✅ 服务器资源实时监控
- ✅ 快速 SSH 连接执行命令
- ✅ 常用命令保存和复用
