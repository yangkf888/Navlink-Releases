# 订阅监控插件

<div class="plugin-hero sub">
  <div class="hero-icon">📅</div>
  <h2>订阅与监控</h2>
  <p>全方位的数字资产过期提醒工具</p>
</div>

<style>
.plugin-hero {
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero.sub {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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

订阅监控插件帮助您追踪各类服务订阅、SSL 证书和域名的到期时间，通过多种渠道发送提醒通知，确保您不错过任何续费时间。

## 核心功能

### 📋 订阅追踪

记录各种服务订阅的到期时间：

| 订阅类型 | 示例 |
|----------|------|
| **流媒体** | Netflix、Spotify、Apple Music |
| **云服务** | VPS、云存储、CDN |
| **软件订阅** | JetBrains、Office 365 |
| **会员服务** | 各类网站会员 |

### 🔐 SSL/域名监控

自动检测证书和域名有效期：

- **SSL 证书** - 自动获取证书到期时间
- **域名注册** - 监控域名续费时间
- **提前预警** - 到期前 7/15/30 天提醒

### 🔔 多渠道通知

支持多种通知方式，确保及时收到提醒：

| 渠道 | 说明 |
|------|------|
| **Telegram** | 通过 Telegram Bot 推送 |
| **Bark** | iOS 设备推送通知 |
| **邮件** | 发送邮件提醒 |
| **Webhook** | 自定义 HTTP 回调 |

## 添加订阅

1. 进入订阅监控插件
2. 点击「添加订阅」
3. 填写订阅信息：
   - 名称、类型
   - 到期日期
   - 价格（可选）
   - 备注（可选）
4. 保存即可

## 配置通知

### Telegram 通知

1. 创建 Telegram Bot（通过 @BotFather）
2. 获取 Bot Token 和 Chat ID
3. 在插件设置中填写配置

### Bark 通知 (iOS)

1. 在 App Store 下载 Bark App
2. 获取设备 Key
3. 在插件设置中填写 Key

### 邮件通知

1. 准备 SMTP 服务器信息
2. 在插件设置中配置：
   - SMTP 服务器/端口
   - 发件人邮箱/密码
   - 收件人邮箱

## 提醒规则

- **提前 30 天** - 首次提醒
- **提前 7 天** - 二次提醒
- **提前 1 天** - 紧急提醒
- **已过期** - 每日提醒直到处理

::: tip 💡 提示
可在设置中自定义提醒时间和频率。
:::

## 使用场景

- ✅ VPS/服务器续费提醒
- ✅ 域名到期提醒
- ✅ SSL 证书过期预警
- ✅ 各类订阅服务管理
