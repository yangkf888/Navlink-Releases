# 聚合搜索

NavLink 的搜索功能经过精心设计，让您快速找到需要的内容。

<div class="search-hero">
  <h2>🔍 更智能的搜索体验</h2>
  <p>拼音匹配 · 历史记录 · 站内即搜</p>
</div>

<style>
.search-hero {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.search-hero h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  border: none;
  padding: 0;
}
.search-hero p {
  margin: 0;
  opacity: 0.9;
}
</style>

## 多引擎搜索

支持添加多个搜索引擎，一键切换：

- ✅ Google
- ✅ 百度
- ✅ Bing
- ✅ DuckDuckGo
- ✅ 自定义引擎

## 拼音匹配

输入拼音或首字母即可匹配中文结果：

<div class="pinyin-demo">

| 输入 | 可匹配 |
|------|--------|
| `baidu` | 百度 |
| `bd` | 百度 |
| `github` | GitHub |
| `tb` | 淘宝 |

</div>

## 历史记录

<div class="feature-list">

- ✅ 自动保存最近 15 条搜索记录
- ✅ 支持拼音匹配历史
- ✅ 单条删除或清空全部
- ✅ 键盘上下键快速选择

</div>

## 站内匹配

输入关键词时自动匹配：

- 链接标题
- 链接描述
- 链接 URL

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `↑` `↓` | 选择结果 |
| `Enter` | 确认/搜索 |
| `Esc` | 关闭下拉 |
| `Cmd/Ctrl + K` | 打开搜索（可配置） |

<style>
.feature-list {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
}

.feature-list li {
  margin: 0.5rem 0;
}

.pinyin-demo table {
  margin: 1rem 0;
}

.pinyin-demo code {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
</style>
