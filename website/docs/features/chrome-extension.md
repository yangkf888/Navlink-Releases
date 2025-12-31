# Chrome 扩展

NavLink Helper 是一个帮助您快速添加链接到导航站的 Chrome 浏览器扩展。

<div class="info-banner">
  <span class="icon">🧩</span>
  <span>一键保存网页到 NavLink，让收藏更高效</span>
</div>

<style>
.info-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0;
}
.info-banner .icon {
  font-size: 1.5rem;
}
</style>

## 功能特性

| 功能 | 说明 |
|------|------|
| 🖱️ **右键菜单** | 在任何页面或链接上右键，快速添加 |
| ⚡ **快捷键** | `Ctrl+Shift+A`（Mac: `Cmd+Shift+A`） |
| 🎨 **智能获取** | 自动获取网站标题、描述、图标 |
| 📁 **记住分类** | 自动记住最近使用的分类 |
| 📝 **历史记录** | 查看最近添加的链接 |
| 🔐 **安全认证** | JWT Token 安全保护 |
| 📚 **知识库** | 保存网页或选中文字到本地知识库 |

## 安装扩展

### 方式一：开发者模式（推荐）

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `chrome-extension` 文件夹
5. 完成！扩展已安装

### 方式二：打包安装

1. 在 `chrome://extensions/` 点击「打包扩展程序」
2. 选择 `chrome-extension` 文件夹
3. 生成 `.crx` 文件后拖拽到浏览器安装

## 首次配置

1. 点击浏览器工具栏的扩展图标
2. 点击「设置」按钮
3. 填写 NavLink 服务器地址（如 `https://nav.example.com`）
4. 输入管理员密码登录
5. 配置完成！

## 使用方法

### 右键菜单添加

在任意网页上右键 → 选择「添加到 NavLink」

### 快捷键添加

| 系统 | 快捷键 |
|------|--------|
| Windows/Linux | `Ctrl+Shift+A` |
| macOS | `Cmd+Shift+A` |

::: tip 💡 自定义快捷键
可在 `chrome://extensions/shortcuts` 修改快捷键
:::

### 扩展图标添加

点击工具栏扩展图标 → 点击「添加到 NavLink」

## 添加链接流程

1. 触发添加（右键/快捷键/图标）
2. 在弹出框中选择目标分类
3. 可选：选择子分类
4. 可选：修改标题、描述
5. 点击「添加」完成

## 保存到知识库

Chrome 扩展支持将网页内容保存到本地知识库，方便后续 AI 问答检索。

### 保存整个网页

1. 在目标网页上点击扩展图标
2. 选择「保存到知识库」
3. 网页内容将自动提取并保存

### 保存选中文字

1. 在网页上选中需要保存的文字
2. 右键选择「保存到 NavLink 知识库」
3. 选中的文字将保存到知识库

::: tip 💡 知识库用途
保存的内容可用于 AI 助手的 RAG（检索增强生成）问答，让 AI 基于您收集的知识回答问题。
:::

## 常见问题

<details>
<summary><strong>提示「未登录」怎么办？</strong></summary>

前往设置页面，填写服务器地址并登录。

</details>

<details>
<summary><strong>无法连接到服务器？</strong></summary>

- 检查服务器地址是否正确
- 确保 NavLink 服务正在运行
- 检查网络连接

</details>

<details>
<summary><strong>右键菜单没有选项？</strong></summary>

尝试重新加载扩展或重启浏览器。

</details>

<details>
<summary><strong>添加失败怎么办？</strong></summary>

- 检查是否已登录
- 确认网络连接正常
- 验证服务器是否可访问

</details>

## 技术信息

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖，轻量高效
- **Chrome APIs**: contextMenus, tabs, storage, notifications, commands
