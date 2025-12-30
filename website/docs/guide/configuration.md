# 配置说明

NavLink 支持通过后台可视化界面进行配置，无需手动编辑配置文件。

<div class="config-hero">
  <h2>⚙️ 可视化配置，简单易用</h2>
  <p>所见即所得，配置即生效</p>
</div>

<style>
.config-hero {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.config-hero h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
}
.config-hero p {
  margin: 0;
  opacity: 0.9;
}
</style>

## 基础设置

登录后台后，点击右上角头像进入管理面板。

### 站点信息

| 配置项 | 说明 |
|--------|------|
| 网站 Logo | 导航栏显示的 Logo 图片 |
| Favicon | 浏览器标签页图标 |
| 首页格言 | Hero 区域显示的标题和副标题 |
| 页脚版权 | 页面底部版权信息 |

### 主题配色

| 配置项 | 说明 |
|--------|------|
| 主色调 | 按钮、链接等强调色 |
| 背景色 | 页面背景颜色 |
| 文字颜色 | 主要文字颜色 |
| 字体大小 | 全局字体大小 |

### 背景设置

支持两种背景模式：

1. **纯色背景** - 选择颜色或渐变
2. **图片背景** - 上传图片或填写 URL

### 导航栏样式

- **沉浸式** - 透明背景，融入页面
- **毛玻璃** - 半透明模糊效果
- **独立背景** - 自定义导航栏背景色

## 搜索配置

### 搜索引擎

添加和管理搜索引擎：

```
名称: Google
URL: https://www.google.com/search?q=
占位符: 搜索你想知道的...
```

### 热词推荐

配置搜索框下方的快捷热词：

- 可设置跳转 URL
- 或仅作为搜索关键词

## 分类与链接

### 分类管理

- 支持多级分类（Tab 模式）
- 拖拽排序
- 设置「未登录隐藏」

### 链接管理

每个链接包含：

| 字段 | 说明 |
|------|------|
| 标题 | 链接显示名称 |
| URL | 目标地址 |
| 描述 | 鼠标悬浮提示 |
| 图标 | FontAwesome 图标或图片 URL |
| 颜色 | 图标颜色 |

::: tip 💡 智能识别
添加链接时可使用「智能识别」功能，自动获取网站标题和图标。
:::

## 侧边栏配置

### 个人名片

- 头像、昵称、简介
- 背景颜色

### 社交链接

添加社交媒体图标和链接。

### 热点榜单

配置 API 获取实时热点，支持：

- 百度热点
- GitHub Trending
- 知乎热榜
- 自定义 API

## 数据管理

<div class="data-actions">

### 导出配置

点击「导出配置」下载 `config.json` 文件。

### 导入配置

上传 `config.json` 或直接粘贴 JSON 内容。

### 本地备份

自动保存最近 5 个快照到浏览器 localStorage。

</div>

## AI 配置

### 添加 AI 提供商

支持 OpenAI API 兼容的服务：

| 字段 | 示例 |
|------|------|
| 名称 | DeepSeek |
| Base URL | https://api.deepseek.com/v1 |
| API Key | sk-xxx |
| 模型 | deepseek-chat |

### 知识库 (RAG)

启用知识库后，AI 对话会自动搜索相关文档。
