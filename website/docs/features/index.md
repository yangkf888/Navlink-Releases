# 功能特性

NavLink 是一个功能丰富的现代化导航站系统。

<div class="hero-banner">
  <h2>✨ 一站式智能导航解决方案</h2>
  <p>聚合搜索 · 智能分类 · AI 助手 · 插件扩展</p>
</div>

<style>
.hero-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.hero-banner h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
}
.hero-banner p {
  margin: 0;
  opacity: 0.9;
}
</style>

## 核心功能

<div class="feature-grid">

<div class="feature-card">
  <div class="feature-icon">🔍</div>
  <h3>聚合搜索</h3>
  <ul>
    <li>多搜索引擎一键切换</li>
    <li>热词推荐快速搜索</li>
    <li>拼音/首字母模糊匹配</li>
    <li>搜索历史记录</li>
    <li>站内链接即时匹配</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">🎨</div>
  <h3>高度定制</h3>
  <ul>
    <li>主题色自由选择</li>
    <li>背景图片/纯色/渐变</li>
    <li>多种导航栏样式</li>
    <li>字体大小可调</li>
    <li>毛玻璃效果</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">📂</div>
  <h3>智能导航</h3>
  <ul>
    <li>多级分类管理</li>
    <li>拖拽排序</li>
    <li>智能链接识别</li>
    <li>链接健康检测</li>
    <li>分类访问控制</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">🤖</div>
  <h3>AI 助手</h3>
  <ul>
    <li>支持多 AI 提供商</li>
    <li>流式输出实时显示</li>
    <li>知识库问答 (RAG)</li>
    <li>对话历史管理</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">🔌</div>
  <h3>插件系统</h3>
  <ul>
    <li>Docker 容器管理</li>
    <li>VPS 服务器运维</li>
    <li>订阅到期提醒</li>
    <li>本地知识库</li>
    <li>更多插件开发中...</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">🔐</div>
  <h3>安全可靠</h3>
  <ul>
    <li>自托管数据</li>
    <li>用户认证鉴权</li>
    <li>分类访问控制</li>
    <li>一键在线升级</li>
    <li>多用户权限控制</li>
  </ul>
</div>

<div class="feature-card">
  <div class="feature-icon">🧩</div>
  <h3>Chrome 扩展</h3>
  <ul>
    <li>一键保存当前页面</li>
    <li>快捷键快速添加链接</li>
    <li>自动获取网站信息</li>
    <li>选择分类直接保存</li>
    <li>支持私有链接同步</li>
  </ul>
</div>

</div>

<style>
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
}

@media (max-width: 960px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}

.feature-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--vp-c-brand-1);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}

.feature-card ul {
  margin: 0;
  padding-left: 1.25rem;
}

.feature-card li {
  margin: 0.4rem 0;
  color: var(--vp-c-text-2);
}
</style>

## 技术架构

| 层级 | 技术栈 |
|------|--------|
| **前端** | React 18 + TypeScript + Vite |
| **样式** | TailwindCSS + CSS Variables |
| **后端** | Node.js + Express |
| **数据库** | SQLite |
| **部署** | Docker (amd64/arm64) |

## 浏览器支持

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 14+ |
| Edge | 90+ |

## 了解更多

- [聚合搜索](/features/search) - 智能搜索功能详解
- [智能导航](/features/navigation) - 分类和链接管理
- [AI 助手](/features/ai-chat) - AI 对话功能
- [主题定制](/features/customization) - 个性化配置
- [后台管理](/features/admin) - 管理功能介绍
- [Chrome 扩展](/features/chrome-extension) - 浏览器扩展使用
