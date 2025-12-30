# 常见问题

<div class="faq-hero">
  <h2>❓ 常见问题解答</h2>
  <p>遇到问题？先看看这里</p>
</div>

<style>
.faq-hero {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.faq-hero h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
}
.faq-hero p {
  margin: 0;
  opacity: 0.9;
}

.faq-section {
  margin: 2rem 0;
}

.faq-section h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

details {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  margin: 0.75rem 0;
  overflow: hidden;
}

details summary {
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

details summary:hover {
  background: var(--vp-c-bg-mute);
}

details summary::before {
  content: '▶';
  font-size: 0.75rem;
  transition: transform 0.2s;
}

details[open] summary::before {
  transform: rotate(90deg);
}

details > div,
details > p {
  padding: 0 1.5rem 1rem;
}

details pre {
  margin: 0.5rem 0;
}
</style>

<div class="faq-section">

## 🐳 部署相关

<details>
<summary>Docker 容器无法启动？</summary>

**1. 检查端口是否被占用**

```bash
lsof -i:8000
```

**2. 查看容器日志**

```bash
docker logs navlink-app
```

**3. 确保数据目录权限正确**

```bash
chmod -R 755 data plugins logs
```

</details>

<details>
<summary>忘记管理员密码？</summary>

删除认证数据库重新初始化：

```bash
# 停止容器
docker stop navlink-app

# 删除认证数据库
rm data/auth.db

# 重启容器（会使用默认密码 admin123）
docker start navlink-app
```

⚠️ 这将重置所有用户账户！其他数据不受影响。

</details>

<details>
<summary>如何备份数据？</summary>

**方式一：后台导出**

登录后台 → 数据管理 → 导出配置

**方式二：命令行备份**

```bash
# 停止容器
docker stop navlink-app

# 备份整个 data 目录
tar -czvf navlink-backup-$(date +%Y%m%d).tar.gz data/

# 重启容器
docker start navlink-app
```

</details>

<details>
<summary>升级后需要重新激活？</summary>

确保 docker-compose.yml 中配置了固定的 `hostname`：

```yaml
services:
  navlink:
    image: ghcr.io/txwebroot/navlink-releases:latest
    hostname: navlink-app  # 必须固定！
```

这样升级后容器指纹不会变化，无需重新激活。

</details>

</div>

<div class="faq-section">

## 🔧 功能相关

<details>
<summary>搜索没有结果？</summary>

1. ✅ 确保已添加链接分类和链接
2. ✅ 检查搜索关键词是否匹配标题或描述
3. ✅ 拼音搜索需要输入完整拼音或首字母

</details>

<details>
<summary>AI 对话报错？</summary>

1. ✅ 检查 API Key 是否正确
2. ✅ 确认 Base URL 格式（需包含 `/v1`）
3. ✅ 检查网络连接（部分 API 可能需要代理）

**常用配置：**

| 提供商 | Base URL |
|--------|----------|
| DeepSeek | `https://api.deepseek.com/v1` |
| OpenAI | `https://api.openai.com/v1` |

</details>

<details>
<summary>插件安装失败？</summary>

1. ✅ 确保 `plugins` 目录已挂载
2. ✅ 检查磁盘空间是否充足
3. ✅ 查看后台日志获取详细错误

```bash
docker logs navlink-app --tail 50
```

</details>

<details>
<summary>链接健康检测不准确？</summary>

部分网站有反爬机制，可能误判为失效。可以：

- 手动标记为健康
- 排除特定域名
- 调整检测超时时间

</details>

</div>

<div class="faq-section">

## ⚡ 性能优化

<details>
<summary>响应缓慢怎么办？</summary>

1. ✅ 检查服务器配置（建议 1GB+ 内存）
2. ✅ 减少首页显示的链接数量
3. ✅ 关闭不使用的插件
4. ✅ 启用 Redis 缓存（可选）

</details>

<details>
<summary>数据库过大怎么办？</summary>

清理历史日志：

```bash
docker exec -it navlink-app sh -c "rm -rf logs/*"
```

</details>

</div>

<div class="faq-section">

## 📌 其他问题

<details>
<summary>如何修改端口？</summary>

修改 docker-compose.yml：

```yaml
ports:
  - "8080:3002"  # 改为新端口
```

然后重启：

```bash
docker compose up -d
```

</details>

<details>
<summary>如何配置 HTTPS？</summary>

推荐使用反向代理（Nginx/Caddy）配置 SSL。

参考 [Docker 部署详解 - 反向代理](/guide/docker-deploy#反向代理配置)

</details>

<details>
<summary>如何查看版本号？</summary>

- 登录后台 → 系统设置 → 系统升级
- 或查看容器镜像：`docker inspect navlink-app | grep Image`

</details>

</div>

---

<div class="help-banner">
  <h3>还有其他问题？</h3>
  <p>欢迎在 <a href="https://github.com/txwebroot/Navlink-Releases/issues">GitHub Issues</a> 提问！</p>
</div>

<style>
.help-banner {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  margin-top: 2rem;
}
.help-banner h3 {
  margin: 0 0 0.5rem;
}
.help-banner p {
  margin: 0;
}
</style>
