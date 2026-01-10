# Video 插件 2.0 代码审查文档

> 版本: 2.0.0  
> 日期: 2026-01-10  
> 作者: AI Assistant

---

## 目录

1. [概述](#概述)
2. [数据库变更](#数据库变更)
3. [扫描性能优化](#扫描性能优化)
4. [后台异步探测队列 (ScanQueueService)](#后台异步探测队列-scanqueueservice)
5. [图片缓存增强](#图片缓存增强)
6. [播放决策与能力协商](#播放决策与能力协商)
7. [媒体库纠偏功能](#媒体库纠偏功能)
8. [前端虚拟列表](#前端虚拟列表)
9. [修改文件清单](#修改文件清单)

---

## 概述

Video 2.0 是一次针对视频插件的重大性能优化和功能增强。主要解决以下问题：

1. **扫描时 CPU 负载过高** - 引入增量扫描机制并移除同步 `ffprobe` 调用
2. **大规模媒体库卡顿** - 引入虚拟列表渲染
3. **图片缓存损坏与重复请求** - 原子化写入 + 持久化失败名单
4. **元数据误识别** - TMDB 手动纠偏功能

---

## 数据库变更

### 变更位置
`plugins/video/backend-nodejs/database/index.js`

### 新增字段

| 表名 | 字段 | 类型 | 说明 |
|------|------|------|------|
| `netdisk_media` | `probe_status` | INTEGER DEFAULT 0 | 探测状态 (0:待探测, 1:成功, -1:失败) |
| `netdisk_media` | `v_codec` | TEXT | 视频编码格式 (h264, h265 等) |
| `netdisk_media` | `container` | TEXT | 封装格式 (mp4, mkv, avi) |
| `netdisk_media` | `is_locked` | INTEGER DEFAULT 0 | 元数据锁定 (手动编辑后保护) |
| `video_sources` | `scan_concurrency` | INTEGER DEFAULT 5 | 用户可配置的扫描并发数 |
| `failed_images` | `url` | TEXT PRIMARY KEY | 缓存失败的图片 URL |
| `failed_images` | `count` | INTEGER | 失败次数 |
| `failed_images` | `last_fail` | INTEGER | 最后一次失败时间戳 |

### 实现代码

```javascript
// netdisk_media 表迁移
const mediaColumnsToAdd = [
    // ... 已有字段
    // Video 2.0 新增字段
    { name: 'probe_status', type: 'INTEGER DEFAULT 0' },
    { name: 'v_codec', type: 'TEXT' },
    { name: 'container', type: 'TEXT' },
    { name: 'is_locked', type: 'INTEGER DEFAULT 0' }
];

// video_sources 表迁移
const sourcesMigrations = [
    // ... 已有字段
    { column: 'scan_concurrency', sql: 'ALTER TABLE video_sources ADD COLUMN scan_concurrency INTEGER DEFAULT 5' }
];

// failed_images 表创建
db.run(`CREATE TABLE IF NOT EXISTS failed_images (
    url TEXT PRIMARY KEY,
    count INTEGER,
    last_fail INTEGER
)`);
```

### 设计原理

- **`probe_status` & `v_codec`**: 状态机结合编码信息，支撑智能播放决策
- **`failed_images`**: 持久化记录失效 URL，避免重启后重复请求
- **`is_locked`**: 防止扫描覆盖用户手动编辑的元数据
- **`container`**: 用于三级智能路由决策（direct/transmux/transcode）

---

## 扫描性能优化

### 变更位置
`plugins/video/backend-nodejs/services/MediaScanService.js`

### 改动要点

1. **引入 `p-limit` 控制目录递归并发**
2. **增量指纹校验**: 引入路径与文件数对比逻辑
3. **解耦探测逻辑**: 移除扫描时的 `ffprobe` 同步调用

### 实现代码

#### 1. 增量指纹校验 (性能杀手锏)

```javascript
// 在 scanFolder 逻辑中
async isFolderChanged(path, currentFileCount) {
    const db = getDatabase();
    const metadata = db.get('SELECT file_count FROM folder_metadata WHERE path = ?', [path]);
    
    if (metadata && metadata.file_count === currentFileCount) {
        return false; // 数量未变，直接跳过整个目录
    }
    return true;
}
```

#### 2. 并发与异步解耦

```javascript
const limit = pLimit(5); // DIR_SCAN_LIMIT

// 扫描时不执行 ffprobe
metadata.container = this.extractContainer(fileName);
metadata.probe_status = 0; // 标记待探测
```

### 设计原理

- **增量校验**: 避免对未变动的大型目录进行深度遍历，极大提升二次扫描速度
- **p-limit**: 限制并发递归，防止 Node.js 事件循环阻塞
- **异步探测**: 扫描阶段仅做文件发现，将昂贵的耗时操作转移至后台队列

---

## 后台异步探测队列 (ScanQueueService)

### 变更位置
`plugins/video/backend-nodejs/services/ScanQueueService.js`

### 功能说明

在系统空闲时自动补全视频元数据。扫描任务结束后，由该服务接管探测工作。

### 核心配置

```javascript
const PROBE_CONCURRENCY = 2;      // 探测并发数
const LOAD_THRESHOLD = 2.0;       // 超过该负载自动暂停
```

### 设计原理

- **负载感知**: 通过 `os.loadavg()` 监测系统负载，确保不影响核心服务
- **低优先级**: 采用生产者-消费者模型，在空闲时段运行

---

## 图片缓存增强

### 变更位置
`plugins/video/backend-nodejs/services/ImageCacheService.js`

### 改动要点

1. **原子化写入**: 先写 `.tmp` 再 `rename`，防止读写冲突
2. **持久化失败名单**: 失败 URL 写入 `failed_images` 表，有效期 24 小时

### 实现代码

#### 1. 持久化失败管理

```javascript
async checkAndRecordFailure(url) {
    const db = getDatabase();
    const record = db.get('SELECT * FROM failed_images WHERE url = ?', [url]);
    
    if (record && (Date.now() - record.last_fail < 24 * 3600 * 1000)) {
        if (record.count >= 3) return true; // 冷却中
    }
    // ... 执行下载逻辑
}
```

### 设计原理

- **原子写入**: 确保 WebP 缓存文件的完整性
- **持久化名单**: 即使后端重启，也不会立刻重试已知的失效请求，保护后端带宽

---

## 播放决策与能力协商

### 变更位置
`plugins/video/backend-nodejs/routes/transcode.js`

### 新增 API
`POST /api/plugins/video/api/transcode/play-decision`

### 请求参数

```json
{
  "url": "视频 URL",
  "v_codec": "h264",
  "container": "mp4",
  "clientCaps": {
    "canPlayH265": false,
    "canPlayMkv": false
  }
}
```

### 返回值

```json
{
  "success": true,
  "data": {
    "decision": "direct|transmux|transcode",
    "reason": "决策原因",
    "playUrl": "播放 URL",
    "sessionId": "转码会话 ID (如有)"
  }
}
```

### 决策逻辑

```javascript
if (codec === 'h264' || codec === 'avc1') {
    if (cont === 'mp4') {
        decision = 'direct';
        reason = 'H.264 + MP4 直接播放';
    } else if (cont === 'mkv') {
        decision = caps.canPlayMkv ? 'direct' : 'transmux';
    }
} else if (codec === 'hevc' || codec === 'h265') {
    if (caps.canPlayH265) {
        decision = cont === 'mp4' ? 'direct' : 'transmux';
    } else {
        decision = 'transcode';
        reason = '客户端不支持 H.265，需转码';
    }
}
```

### 设计原理

- **三级路由**: Direct (直连) → Transmux (转封装) → Transcode (全转码)
- **客户端能力感知**: 前端告知后端其解码能力，后端动态决策
- **最小化 CPU**: 优先直连和转封装，避免不必要的转码

---

## 媒体库纠偏功能

### 变更位置
`plugins/video/backend-nodejs/routes/netdisk.js`

### 新增 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/netdisk/media/:id` | PATCH | 单片编辑并自动锁定 |
| `/netdisk/media/:id/tmdb-search` | POST | TMDB 搜索 |
| `/netdisk/media/:id/tmdb-apply` | POST | 应用 TMDB 元数据 |

### TMDB 搜索实现

```javascript
router.post('/media/:id/tmdb-search', async (req, res) => {
    const { query, year } = req.body;
    const apiKey = db.get("SELECT value FROM settings WHERE key = 'tmdb_api_key'")?.value;
    
    const { TmdbService } = require('../services/TmdbService');
    const tmdb = new TmdbService(apiKey);
    const results = await tmdb.searchMulti(query, year);
    
    res.json({ success: true, data: results });
});
```

### TMDB 应用实现

```javascript
router.post('/media/:id/tmdb-apply', async (req, res) => {
    const { tmdb_id, media_type } = req.body;
    
    let detail = media_type === 'movie' 
        ? await tmdb.getMovieDetail(tmdb_id)
        : await tmdb.getTVDetail(tmdb_id);
    
    db.run(`
        UPDATE netdisk_media SET 
            title = ?, original_title = ?, year = ?, overview = ?,
            poster_url = ?, fanart_url = ?, rating = ?, genres = ?,
            tmdb_id = ?, is_locked = 1
        WHERE id = ?
    `, [detail.title, detail.original_title, ...]);
});
```

### 设计原理

- **手动纠偏**: 用户可搜索 TMDB 并选择正确的匹配
- **自动锁定**: 应用后设置 `is_locked = 1`，防止扫描覆盖
- **分离搜索与应用**: 搜索返回列表，用户确认后再应用

---

## 前端虚拟列表

### 变更位置
`plugins/video/frontend/src/pages/Netdisk.tsx`

### 依赖安装

```bash
npm install react-virtuoso --save
```

### 实现代码

```tsx
import { VirtuosoGrid } from 'react-virtuoso';

// 三级视图渲染
<VirtuosoGrid
    style={{ height: 'calc(100vh - 200px)' }}
    totalCount={media.length}
    overscan={200}
    listClassName="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
    itemContent={(index) => renderMediaCard(media[index])}
    endReached={() => {
        if (hasMore && !loadingMore) {
            loadMoreMedia();
        }
    }}
    components={{
        Footer: () => (
            <div className="h-16 flex items-center justify-center mt-4">
                {loadingMore ? <Spinner /> : hasMore ? <LoadMoreHint /> : <EndHint />}
            </div>
        )
    }}
/>
```

### 设计原理

- **虚拟化渲染**: 仅渲染可视区域内的卡片（约 12-24 个）
- **DOM 减少**: 解决数千部影片导致的内存溢出
- **`overscan`**: 预渲染 200px 外的内容，提升滚动流畅度

---

## 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `database/index.js` | 修改 | 新增字段迁移及 `failed_images` 表创建 |
| `services/MediaScanService.js` | 修改 | p-limit, 增量指纹校验, 异步探测标记 |
| `services/ImageCacheService.js` | 修改 | 原子写入, 持久化失败名单 (DB) |
| `services/ScanQueueService.js` | **新增** | 后台探测服务 (原 ProbeQueueService) |
| `routes/netdisk.js` | 修改 | PATCH API, TMDB 纠偏 API |
| `routes/transcode.js` | 修改 | play-decision API |
| `server.js` | 修改 | 启动 ScanQueueService |
| `manifest.json` | 修改 | 版本号 → 2.0.0 |
| `frontend/package.json` | 修改 | 添加 react-virtuoso |
| `frontend/src/pages/Netdisk.tsx` | 修改 | VirtuosoGrid 集成 |

---

## 验证清单

- [ ] **扫描性能**: 二次扫描时，未变动目录是否通过指纹校验跳过
- [ ] **异步队列**: 后台探测队列是否正常运行并补全 `v_codec`
- [ ] **图片持久化**: 重启服务后，已知失效的图片 URL 是否仍在冷却期
- [ ] **原子写入**: 模拟崩溃情况下，缓存目录是否存在 0 字节损坏文件
- [ ] **TMDB 纠偏**: 应用后 `is_locked` 是否正确阻止了后续扫描覆盖
- [ ] **虚拟列表**: 万级数据下滚动帧率是否稳定在 60fps
- [ ] **智能路由**: H.264/MP4 资源是否正确触发了 `direct` 播放

---

*文档结束*
