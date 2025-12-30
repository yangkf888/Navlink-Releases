# 知识库插件 (KB-RAG)

<div class="plugin-hero kbrag">
  <div class="hero-icon">📚</div>
  <h2>本地知识库</h2>
  <p>打造您的个人离线知识大脑</p>
</div>

<style>
.plugin-hero {
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero.kbrag {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
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

知识库插件 (KB-RAG) 让您能够收藏网页内容到本地，通过向量化存储实现语义级搜索，并结合 AI 进行智能问答。

## 什么是 RAG？

**RAG** (Retrieval Augmented Generation) 是一种将检索与生成相结合的 AI 技术：

1. **检索 (Retrieval)** - 从知识库中找到相关内容
2. **增强 (Augmented)** - 将检索结果作为上下文
3. **生成 (Generation)** - AI 基于上下文生成回答

## 核心功能

### 🌐 网页收藏

配合 NavLink Chrome 扩展使用：

| 功能 | 说明 |
|------|------|
| **一键收藏** | 点击扩展图标保存当前网页 |
| **正文提取** | 自动提取页面主要内容 |
| **元数据保存** | 保存标题、URL、时间等 |
| **分类管理** | 支持添加标签分类 |

### 🔍 向量检索

系统自动对收藏内容进行向量化处理：

- **语义搜索** - 不仅匹配关键词，还理解语义
- **相似度排序** - 按相关性排序结果
- **快速检索** - 毫秒级搜索响应

### 🤖 AI 问答

内置 AI 对话界面，基于知识库内容回答问题：

```
用户: NavLink 如何配置 Docker 部署？

AI: 根据您的知识库内容，NavLink 的 Docker 部署步骤如下：
1. 创建 docker-compose.yml 文件...
2. 配置环境变量...
3. 运行 docker compose up -d...
```

## Chrome 扩展

### 安装扩展

1. 下载 NavLink Chrome 扩展
2. 打开 Chrome 扩展管理页面 (`chrome://extensions`)
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择扩展目录

### 配置扩展

1. 点击扩展图标
2. 进入设置页面
3. 填写 NavLink 服务器地址
4. 保存配置

### 使用方法

1. 浏览到想要保存的网页
2. 点击 NavLink 扩展图标
3. 确认内容预览
4. 点击「保存到知识库」

## 使用场景

- ✅ 技术文档收藏整理
- ✅ 学习笔记积累
- ✅ 项目资料归档
- ✅ 个人知识管理
- ✅ AI 辅助信息检索

## 与 AI 助手集成

知识库插件与 NavLink 内置 AI 助手深度集成：

1. 启用知识库插件
2. 在 AI 设置中开启「知识库增强」
3. 对话时自动检索相关内容
4. AI 基于知识库内容回答

::: tip 💡 提示
知识库内容越丰富，AI 回答越精准。建议持续积累高质量内容。
:::
