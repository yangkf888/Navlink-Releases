# 更新日志

<div class="changelog-header">
  <h2>📋 版本更新记录</h2>
  <p>持续迭代，不断优化</p>
</div>

<div class="timeline">
<div class="timeline-item latest">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.1.6</span>
      <span class="badge-latest">最新版本</span>
    </div>
    <div class="date">2026-01-17</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type feature">✨ 新功能</span>
        <ul>
          <li><strong>卡片定制</strong> - 热门导航和内容分类区域支持链接卡片背景及悬浮颜色自定义</li>
          <li><strong>品牌同步</strong> - 支持站点名称全局自定义，自动同步至页面、后台及浏览器标签页</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type improve">🔧 优化</span>
        <ul>
          <li><strong>视觉系统</strong> - 调整顶部导航至黄金比例高度，增强页面呼吸感</li>
          <li><strong>搜索体验</strong> - 搜索框下方热词优化为极简文字流设计，交互更通透</li>
          <li><strong>动态对比</strong> - 全站文字支持动态对比度检测，根据背景自动切换黑白颜色</li>
          <li><strong>资源管理</strong> - 优化网格视图下的图片显示效果，支持图标类资源锐化预览</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type fix">🐛 修复</span>
        <ul>
          <li><strong>侧边栏兼容</strong> - 修复主应用背景更改导致插件页顶部导航文字颜色冲突的 Bug</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.1.5</span>
    </div>
    <div class="date">2026-01-16</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type feature">✨ 新功能</span>
        <ul>
          <li><strong>内容分类</strong> - 新增 Chrome 书签导入功能，支持快速同步外部数据</li>
          <li><strong>首屏搜索</strong> - 支持自定义文字大小及颜色，个性化搜索体验</li>
          <li><strong>全局外观</strong> - 前台热门网址、内容分类、侧边栏背景颜色支持深度定制</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type improve">🔧 优化</span>
        <ul>
          <li><strong>系统稳定性</strong> - 优化防止未捕获异常导致进程退出，增强自动重启机制</li>
          <li><strong>通讯性能</strong> - 增强 SSE 连接错误处理，提升实时数据传输可靠性</li>
          <li><strong>日志管理</strong> - 优化服务端与控制台日志显示，输出更加精简清晰</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.1.1</span>
    </div>
    <div class="date">2026-01-09</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type fix">🐛 修复</span>
        <ul>
          <li><strong>核心系统</strong> - 修复保留旧数据重建容器时，由于管理员重命名可能导致的数据库唯一约束冲突错误</li>
          <li><strong>订阅插件</strong> - 修复自动续订功能在特定条件下参数传递错误导致失效的问题 (v2.1.1)</li>
          <li><strong>视频插件</strong> - 优化搜索算法，增加关键词二次过滤，大幅提升搜索结果精准度 (v1.0.5)</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.1.0</span>
    </div>
    <div class="date">2026-01-04</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type warning">⚠️ 重要提示</span>
        <ul>
          <li><strong>升级到2.1.0最新版本后，应用商城的插件也需要同步更新</strong>，不然可能会无法使用侧边栏！</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type fix">🐛 修复</span>
        <ul>
          <li>修复 sub 插件初始化时漏了数据库字段</li>
          <li>修复导航站内容分类子类tab拖拽排序</li>
          <li>修复 ConfigContext 配置更新死循环警告</li>
          <li>修复数据库缺失 Role Permissions 表导致启动失败</li>
          <li>修复在线更新内容较多时需要滚动查看，现在可以展示全部更新内容</li>
          <li>修复在移动端很难点击退出登录按钮问题</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type improve">🔧 更新</span>
        <ul>
          <li>更新全部插件，插件新增暗黑模式和明亮模式</li>
          <li>更改插件侧边栏的实现方式</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.0.17</span>
    </div>
    <div class="date">2024-12-31</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type feature">✨ 新功能</span>
        <ul>
          <li><strong>忘记激活码找回</strong> - 激活页面添加"忘记激活码？通过邮箱找回"功能，用户可自助获取新激活码</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.0.16</span>
    </div>
    <div class="date">2024-12-29</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type feature">✨ 新功能</span>
        <ul>
          <li><strong>搜索增强</strong> - 页面加载自动聚焦、搜索历史保存（最多15条）、拼音/首字母模糊匹配、键盘导航</li>
          <li><strong>AI 流式输出</strong> - AI 回复逐字显示，支持 SSE 实时推送</li>
        </ul>
      </div>
      <div class="change-group">
        <span class="change-type fix">🐛 修复</span>
        <ul>
          <li>修复 VPS 插件新用户数据库表缺失导致 500 错误</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.0.15</span>
    </div>
    <div class="date">2024-12-28</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type docs">📝 文档</span>
        <ul>
          <li>完善用户手册文档</li>
          <li>更新 NavManage 项目说明</li>
          <li>优化注册码系统说明</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.0.14</span>
    </div>
    <div class="date">2024-12-24</div>
    <div class="changes">
      <div class="change-group">
        <span class="change-type improve">🔧 改进</span>
        <ul>
          <li>优化插件市场 URL 配置</li>
          <li>更新授权服务器地址</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="timeline-item major">
  <div class="timeline-dot"></div>
  <div class="timeline-content">
    <div class="version-header">
      <span class="version">v2.0.0</span>
      <span class="badge-major">🎉 重大更新</span>
    </div>
    <div class="date">2024-12-01</div>
    <div class="major-desc">NavLink 2.0 首个正式版本，完全重构！</div>
    <div class="changes">
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">🏗️</div>
          <div class="feature-title">架构升级</div>
          <div class="feature-desc">React 18 + TypeScript 前端<br>Node.js + Express 后端<br>SQLite 数据库</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔍</div>
          <div class="feature-title">核心功能</div>
          <div class="feature-desc">聚合搜索 · 多级分类<br>主题定制 · 用户认证</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔌</div>
          <div class="feature-title">插件系统</div>
          <div class="feature-desc">Docker · VPS 运维<br>订阅监控 · 知识库</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <div class="feature-title">AI 功能</div>
          <div class="feature-desc">多提供商支持<br>流式输出 · RAG 问答</div>
        </div>
      </div>
    </div>
  </div>
</div>

</div>

<div class="changelog-footer">
  <a href="https://github.com/txwebroot/Navlink-Releases/releases" target="_blank">
    查看更多历史版本 →
  </a>
</div>

<style>
.changelog-header {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 16px;
  color: white;
  margin-bottom: 2rem;
}
.changelog-header h2 {
  margin: 0 0 0.5rem;
  border: none;
  padding: 0;
  color: white;
}
.changelog-header p {
  margin: 0;
  opacity: 0.9;
}

.timeline {
  position: relative;
  padding-left: 30px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #6366f1 0%, #a5b4fc 100%);
}

.timeline-item {
  position: relative;
  margin-bottom: 2rem;
}
.timeline-dot {
  position: absolute;
  left: -26px;
  top: 8px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #6366f1;
  border: 3px solid white;
  box-shadow: 0 0 0 3px #6366f1;
}
.timeline-item.latest .timeline-dot {
  background: #10b981;
  box-shadow: 0 0 0 3px #10b981;
}
.timeline-item.major .timeline-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 3px #f59e0b;
  width: 18px;
  height: 18px;
  left: -28px;
}

.timeline-content {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--vp-c-divider);
}
.timeline-item.latest .timeline-content {
  border-color: #10b981;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
}
.timeline-item.major .timeline-content {
  border-color: #f59e0b;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
}

.version-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.version {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.badge-latest {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
}
.badge-major {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
}
.date {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.75rem;
}

.change-group {
  margin-bottom: 0.75rem;
}
.change-type {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.change-type.feature { background: #dbeafe; color: #1d4ed8; }
.change-type.fix { background: #fce7f3; color: #be185d; }
.change-type.docs { background: #e0e7ff; color: #4338ca; }
.change-type.improve { background: #d1fae5; color: #047857; }
.change-type.warning { background: #fef3c7; color: #b45309; }

.dark .change-type.feature { background: #1e3a8a; color: #93c5fd; }
.dark .change-type.fix { background: #831843; color: #f9a8d4; }
.dark .change-type.docs { background: #312e81; color: #c7d2fe; }
.dark .change-type.improve { background: #064e3b; color: #6ee7b7; }
.dark .change-type.warning { background: #78350f; color: #fcd34d; }

.changes ul {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}
.changes li {
  margin: 0.3rem 0;
  line-height: 1.5;
}

.major-desc {
  font-size: 1rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  margin-bottom: 1rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
@media (max-width: 640px) {
  .feature-grid { grid-template-columns: 1fr; }
}
.feature-card {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.75rem;
  text-align: center;
  border: 1px solid var(--vp-c-divider);
}
.feature-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}
.feature-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}
.feature-desc {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}

.changelog-footer {
  text-align: center;
  margin-top: 2rem;
  padding: 1.5rem;
}
.changelog-footer a {
  color: #6366f1;
  font-weight: 600;
  text-decoration: none;
}
.changelog-footer a:hover {
  text-decoration: underline;
}
</style>
