# 插件系统

NavLink 采用插件架构，核心功能精简，扩展功能通过插件实现。

<div class="plugin-hero">
  <h2>🔌 按需扩展，功能无限</h2>
  <p>安装您需要的插件，打造专属功能</p>
</div>

<style>
.plugin-hero {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
}
.plugin-hero p {
  margin: 0;
  opacity: 0.9;
}
</style>

## 官方插件

<div class="plugin-grid">

<div class="plugin-card docker">
  <div class="plugin-header">
    <span class="plugin-icon">🐳</span>
    <span class="plugin-badge">官方</span>
  </div>
  <h3>Docker 管理</h3>
  <p>管理 Docker 容器和镜像</p>
  <ul>
    <li>容器启动/停止/重启/删除</li>
    <li>镜像拉取/删除</li>
    <li>实时日志查看</li>
    <li>远程 SSH 连接</li>
  </ul>
  <a href="/plugins/docker" class="plugin-link">查看详情 →</a>
</div>

<div class="plugin-card vps">
  <div class="plugin-header">
    <span class="plugin-icon">🖥️</span>
    <span class="plugin-badge">官方</span>
  </div>
  <h3>VPS 运维</h3>
  <p>多服务器管理和运维</p>
  <ul>
    <li>服务器分组管理</li>
    <li>Web SSH 终端</li>
    <li>实时资源监控</li>
    <li>命令片段库</li>
  </ul>
  <a href="/plugins/vps" class="plugin-link">查看详情 →</a>
</div>

<div class="plugin-card sub">
  <div class="plugin-header">
    <span class="plugin-icon">📅</span>
    <span class="plugin-badge">官方</span>
  </div>
  <h3>订阅监控</h3>
  <p>服务订阅和证书监控</p>
  <ul>
    <li>订阅到期提醒</li>
    <li>SSL 证书监控</li>
    <li>域名过期监控</li>
    <li>多渠道通知</li>
  </ul>
  <a href="/plugins/sub" class="plugin-link">查看详情 →</a>
</div>

<div class="plugin-card kbrag">
  <div class="plugin-header">
    <span class="plugin-icon">📚</span>
    <span class="plugin-badge">官方</span>
  </div>
  <h3>知识库 (KB-RAG)</h3>
  <p>本地知识库和 AI 问答</p>
  <ul>
    <li>Chrome 扩展收藏</li>
    <li>向量化存储</li>
    <li>AI 语义检索</li>
    <li>知识库问答</li>
  </ul>
  <a href="/plugins/kbrag" class="plugin-link">查看详情 →</a>
</div>

</div>

<style>
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
}

@media (max-width: 768px) {
  .plugin-grid {
    grid-template-columns: 1fr;
  }
}

.plugin-card {
  background: var(--vp-c-bg-soft);
  border-radius: 16px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.plugin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.plugin-card.docker::before { background: linear-gradient(90deg, #0ea5e9, #2563eb); }
.plugin-card.vps::before { background: linear-gradient(90deg, #10b981, #059669); }
.plugin-card.sub::before { background: linear-gradient(90deg, #f59e0b, #d97706); }
.plugin-card.kbrag::before { background: linear-gradient(90deg, #8b5cf6, #7c3aed); }

.plugin-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.12);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.plugin-icon {
  font-size: 2rem;
}

.plugin-badge {
  background: var(--vp-c-brand-1);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.plugin-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

.plugin-card > p {
  color: var(--vp-c-text-2);
  margin: 0 0 1rem;
}

.plugin-card ul {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
}

.plugin-card li {
  margin: 0.3rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.plugin-link {
  display: inline-block;
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: none;
}

.plugin-link:hover {
  text-decoration: underline;
}
</style>

## 安装插件

### 从插件市场安装

1. 登录后台管理
2. 进入「插件中心」
3. 选择需要的插件点击「安装」
4. 等待下载和初始化完成

### 插件数据存储

每个插件的数据独立存储：

```
data/
├── docker.db    # Docker 插件
├── vps.db       # VPS 插件
├── sub.db       # 订阅插件
└── kbrag.db     # 知识库插件
```

## 插件管理

### 启用/禁用

在后台「插件中心」可以启用或禁用已安装的插件。

### 卸载插件

1. 先在后台禁用插件
2. 删除 `plugins/插件名` 目录
3. 重启服务

::: warning ⚠️ 注意
卸载插件会删除该插件的所有数据！建议先备份。
:::
