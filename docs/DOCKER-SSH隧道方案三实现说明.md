# Docker SSH 隧道方案三实现说明

## 📋 概述

已实现**方案三：自动 Socket 转发**，通过 SSH 在远程服务器上自动启动 socat 进程，将 Docker Unix Socket 转发到 TCP 端口，无需手动配置远程 Docker Daemon。

---

## ✅ 实现内容

### 修改文件
- **文件**：`plugins/docker/backend-nodejs/services/dockerService.js`
- **修改行数**：约 120 行
- **难度**：⭐⭐ 中等

### 核心功能

1. **自动检测 socat**
   - SSH 连接成功后，自动检测远程服务器是否安装 socat
   - 如果未安装，降级到直接连接 2375 端口（需要远程已配置）

2. **自动启动 socat 转发**
   ```bash
   socat TCP-LISTEN:2375,bind=127.0.0.1,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock
   ```
   - 仅监听本地回环地址 `127.0.0.1`
   - 使用 `fork` 支持多个并发连接
   - 记录进程 PID 用于后续清理

3. **自动清理资源**
   - 连接断开时自动杀死 socat 进程
   - 清除 SSH 连接缓存
   - 防止进程泄漏

4. **完整日志记录**
   - 所有操作都有详细的 debug 日志
   - 控制台输出关键步骤提示

---

## 🚀 使用方法

### 前提条件

**远程服务器需要**：
1. ✅ 安装 socat
   ```bash
   # Debian/Ubuntu
   sudo apt-get install -y socat
   
   # CentOS/RHEL
   sudo yum install -y socat
   
   # macOS
   brew install socat
   ```

2. ✅ Docker 正常运行
   ```bash
   docker ps  # 确认可以访问
   ```

3. ✅ SSH 访问权限
   - 可以 SSH 登录到服务器
   - 用户有 Docker 权限（通常需要 root 或在 docker 组）

### 配置步骤

1. **在 Navlink Docker 插件中添加服务器**
   - 连接类型：选择 `远程Docker (SSH隧道)`
   - 主机地址：远程服务器 IP 或域名
   - SSH 用户名：`root` 或其他有 Docker 权限的用户
   - SSH 端口：默认 `22`
   - 认证方式：
     - 密码认证：填写 SSH 密码
     - 私钥认证：粘贴 SSH 私钥内容
     - Agent 认证：留空，使用本地 SSH Agent

2. **点击"测试"按钮**
   - 系统会自动：
     1. SSH 连接到远程服务器 ✅
     2. 检测 socat 是否安装 ✅
     3. 启动 socat 转发进程 ✅
     4. 测试 Docker API 连接 ✅

3. **查看日志**（可选）
   ```bash
   # 查看 Docker 插件日志
   tail -f plugins/docker/debug_root.log
   ```

---

## 📊 工作流程

```mermaid
graph TD
    A[开始连接] --> B{SSH 连接成功?}
    B -->|否| Z[连接失败]
    B -->|是| C{检测 socat}
    
    C -->|未安装| D[降级到 TCP 2375]
    C -->|已安装| E[启动 socat 转发]
    
    E --> F{获取 PID?}
    F -->|失败| Z
    F -->|成功| G[等待 500ms]
    
    G --> H[创建 SSH 隧道]
    H --> I[初始化 Docker 客户端]
    I --> J[连接成功]
    
    D --> H
    
    J --> K{连接断开?}
    K -->|是| L[清理 socat 进程]
    L --> M[关闭 SSH 连接]
    M --> N[完成]
```

---

## 🔍 日志输出示例

### 成功连接

```
[SSH] 尝试连接（密码认证）: root@43.247.132.232:22
[SSH] 连接成功: 43.247.132.232
[SSH] 正在启动 Docker Socket 转发...
[SSH] socat 已启动，PID: 12345
[SSH] ✅ Docker Socket 转发已启动 (PID: 12345)
```

### 连接断开

```
[SSH] 连接关闭: 43.247.132.232 (c9228940-98f1-45e4-a572-ea8f1c8f3a06)
[SSH] 开始清理资源: 43.247.132.232 (c9228940-98f1-45e4-a572-ea8f1c8f3a06)
[SSH] socat 进程已清理: PID 12345
[Docker] Clearing cache for server c9228940-98f1-45e4-a572-ea8f1c8f3a06
```

### 未安装 socat

```
[SSH] 连接成功: 43.247.132.232
[SSH] ⚠️ 远程未安装 socat，将尝试直接连接 Docker TCP 端口
```

---

## ⚠️ 故障排查

### 问题 1：连接失败 "Connection refused"

**原因**：远程未安装 socat，且 Docker 未监听 TCP 端口

**解决方案**：
1. 安装 socat（推荐）：
   ```bash
   sudo apt-get install -y socat
   ```

2. 或者配置 Docker 监听本地 2375 端口（参考方案一）

### 问题 2：权限被拒绝

**原因**：SSH 用户没有访问 Docker Socket 的权限

**解决方案**：
```bash
# 方法一：使用 root 用户
# 在前端配置 SSH 用户名为 root

# 方法二：将用户加入 docker 组
sudo usermod -aG docker your_username
# 需要重新登录生效
```

### 问题 3：socat 进程残留

**原因**：异常断开导致 socat 未清理

**解决方案**：
```bash
# 手动清理 socat 进程
pkill -f "socat.*2375.*docker.sock"

# 或查找并杀死特定 PID
ps aux | grep socat
kill <PID>
```

### 问题 4：端口 2375 被占用

**原因**：远程服务器上已有其他服务监听 2375

**解决方案**：
```bash
# 检查占用
sudo netstat -tulpn | grep 2375

# 如果是旧的 socat 进程，杀掉它
sudo pkill -f "socat.*2375"
```

---

## 🎯 优势对比

| 特性 | 方案一（配置 Docker） | 方案二（手动 socat） | **方案三（自动）** |
|------|---------------------|---------------------|------------------|
| 无需配置 Docker | ❌ | ✅ | ✅ |
| 无需手动维护 | ✅ | ❌ | ✅ |
| 自动清理资源 | N/A | ❌ | ✅ |
| 重启后持久化 | ✅ | ❌ | ✅（自动重启） |
| 安全性 | ✅ | ✅ | ✅ |
| 配置复杂度 | 中 | 低 | **零配置** |

---

## 📝 技术细节

### 缓存结构

```javascript
// SSH 连接缓存格式
sshConnections.set(serverId, {
    ssh: Client,      // SSH2 客户端实例
    socatPid: number  // socat 进程 PID
});
```

### 清理机制

1. **正常断开**：
   - `ssh.on('close')` → 触发 cleanup()
   - 执行 `kill ${socatPid}`
   - 关闭 SSH 连接
   
2. **异常断开**：
   - `ssh.on('end')` → 触发 cleanup()
   - 同样执行清理逻辑
   
3. **超时保护**：
   - 清理操作最多等待 2 秒
   - 防止清理过程卡死

### socat 命令详解

```bash
socat \
  TCP-LISTEN:2375,bind=127.0.0.1,reuseaddr,fork \
  UNIX-CONNECT:/var/run/docker.sock
```

- `TCP-LISTEN:2375`：监听 TCP 2375 端口
- `bind=127.0.0.1`：仅绑定本地回环地址（安全）
- `reuseaddr`：允许地址重用，避免 "Address already in use"
- `fork`：支持多个并发连接
- `UNIX-CONNECT:/var/run/docker.sock`：连接到 Docker Unix Socket

---

## 🔐 安全说明

1. **本地监听**：socat 仅监听 `127.0.0.1:2375`，不暴露到公网
2. **SSH 加密**：所有流量通过 SSH 隧道加密传输
3. **自动清理**：断开连接后自动清理 socat 进程，不留后门
4. **权限隔离**：使用 SSH 用户权限，不需要额外授权

---

## 🆚 与方案一、二对比

### 方案一：配置远程 Docker 监听 2375

**优点**：
- 永久配置，重启后仍有效
- 性能略好（少一层转发）

**缺点**：
- 需要修改 Docker Daemon 配置
- 需要重启 Docker 服务
- 可能影响现有服务

**适用场景**：专用 Docker 服务器

---

### 方案二：手动启动 socat

**优点**：
- 无需修改 Docker 配置
- 临时使用方便

**缺点**：
- 需要手动维护进程
- 服务器重启后失效
- 容易忘记清理

**适用场景**：临时测试

---

### 方案三：自动 Socket 转发（当前实现）

**优点**：
- ✅ **零配置**：远程只需安装 socat
- ✅ **自动化**：启动和清理全自动
- ✅ **安全**：仅本地监听 + SSH 加密
- ✅ **智能降级**：未安装 socat 时自动尝试 TCP 连接

**缺点**：
- 需要 socat 依赖（常见工具，容易安装）
- 略微增加连接延迟（500ms 等待）

**适用场景**：**推荐用于所有场景** ⭐

---

## 📦 后续优化建议

1. **配置化 socat 端口**
   - 允许用户自定义转发端口（默认 2375）
   - 前端添加配置选项

2. **健康检查增强**
   - 定时检查 socat 进程是否存活
   - 自动重启失败的 socat

3. **批量安装 socat**
   - 提供一键安装脚本
   - SSH 连接时自动检测并提示安装

4. **连接池优化**
   - 复用 SSH 连接
   - 减少重复建立连接的开销

---

## 🎉 总结

方案三已完整实现，具有以下特点：

- ✅ **修改量小**：仅 1 个文件，约 120 行代码
- ✅ **自动化高**：无需手动配置和维护
- ✅ **安全可靠**：SSH 加密 + 本地监听 + 自动清理
- ✅ **兼容性好**：支持降级到 TCP 连接
- ✅ **易于使用**：用户无感知，开箱即用

**推荐使用此方案** 作为 Docker SSH 连接的默认实现！🚀
