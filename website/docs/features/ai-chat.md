# AI 智能助手

NavLink 内置 AI 对话功能，支持多种 AI 提供商，并可结合知识库进行智能问答。

## 支持的 AI 提供商

支持所有兼容 OpenAI API 的服务：

| 提供商 | Base URL | 推荐模型 |
|--------|----------|----------|
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat |
| OpenAI | `https://api.openai.com/v1` | gpt-4o, gpt-4o-mini |
| 月之暗面 | `https://api.moonshot.cn/v1` | moonshot-v1-8k |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | glm-4 |
| 自定义 | 任意兼容 OpenAI 的 API | - |

## 配置 AI

### 添加 AI 提供商

1. 进入后台 → AI 设置
2. 点击「添加提供商」
3. 填写配置：
   - 名称（自定义）
   - Base URL
   - API Key
   - 模型名称
4. 保存并测试

### 配置示例

**DeepSeek 配置：**

```
名称: DeepSeek
Base URL: https://api.deepseek.com/v1
API Key: sk-xxx...
模型: deepseek-chat
```

## 流式输出

AI 回复采用流式输出（SSE）：

- 实时显示生成内容
- 逐字显示，体验更好
- 无需等待完整响应

## 知识库增强 (RAG)

结合知识库插件实现智能问答：

### 工作原理

1. 用户提问
2. 系统检索知识库相关内容
3. 将检索结果作为上下文
4. AI 基于上下文生成回答

### 使用场景

- 基于收藏的文档回答问题
- 个人知识库智能检索
- 技术文档快速查询

## 对话管理

### 对话历史

- 自动保存对话记录
- 支持查看历史对话
- 可清空对话重新开始

### 快捷操作

- 复制 AI 回复
- 重新生成回复
- 停止生成

## 使用技巧

::: tip 💡 提示
- 问题越具体，回答越精准
- 可以追问让 AI 补充细节
- 结合知识库可获得更准确的回答
:::
