# 视频管理插件 (Video)

<div class="plugin-hero video">
  <div class="hero-icon">🎬</div>
  <h2>视频与电视直播管理</h2>
  <p>全能视频管理中心，支持 STRM 播放、直播源管理与实时转码</p>
</div>

<style>
.plugin-hero {
  color: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin: 1.5rem 0 2rem;
}
.plugin-hero.video {
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

Video 插件是 NavLink 的核心媒体功能插件，旨在为用户提供从网络云盘（Alist/Openlist）、TV 直播源到本地视频流的统一管理和自适应播放体验。

## 核心功能

### 📺 网络资源站 (CMS)

- **广泛支持**：支持接入基于 **苹果CMS (AppleCMS)** 格式的资源站。
- **采集管理**：一键添加资源站接口，支持分类浏览与视频检索。
- **即点即播**：支持资源站提供的多种流媒体解析与播放。

### 📺 电视直播 (TV Live)

- **源管理**：支持批量导入 `.m3u` 直播源。
- **自适应检测**：自动检测直播源有效性及延迟。
- **内置播放器**：支持 HLS/Dash/CCTV 等流协议直接播放。

### ☁️ 云盘视频 (Alist/Openlist)

- **无缝连接**：支持通过对接 **Alist** 或 **Openlist**，实现影视文件直接在浏览器播放。
- **自动封面**：支持通过 TMDB 自动抓取视频封面及元数据信息。
- **转码方案**：解决不同网络环境下高清视频播放卡顿问题。

### ⚡ 实时转码 (Transcoding)

- **一键安装 FFmpeg**：Linux/Docker 环境下支持一键部署便携版 FFmpeg，零门槛开启转码。
- **硬件加速**：支持 **NVENC (Nvidia)**, **QSV (Intel)**, **VA-API** 等主流硬件加速。
- **多码率适配**：根据带宽自动调整清晰度。

## 配置说明

### 1. 硬件加速配置

要使用硬件加速，请确保您的容器已映射对应的设备驱动，例如：

```yaml
# docker-compose.yml 示例 (Nvidia)
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

### 2. FFmpeg 安装

对于 Docker 用户，无需手动在宿主机安装：
1. 进入 Video 插件设置。
2. 在「STRM 转码」部分，系统会自动识别您的 Linux 系统。
3. 点击「一键安装便携版」即可完成初始化。

## 使用场景

- ✅ **精简版 NAS**：无需搭建 Emby/Plex，轻量化播放网盘资源。
- ✅ **全能播放器**：统一管理全球电视直播频道。
- ✅ **低带宽播放**：在户外通过实时转码观看家中的 4K 蓝光资源。

## 截图预览

> 功能截图待补充
