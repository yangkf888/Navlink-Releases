# Video 插件 2.0 终极实施方案 (Master Blueprint)

本方案不仅是目标的集合，更是视频插件底层架构升级的**工程蓝图**。它整合了性能优化、异步任务、智能转码及用户交互的所有讨论细节。

---

## 1. 核心架构：性能与效率 (Backend)

### A. 轻量化增量扫描 (MediaScanService)
*   **实现方法**：
    - **逻辑去耦**：将 `ffprobe` 探测从 `processMediaFolder` 移除。
    - **增量校验**：引入 `folder_metadata` 映射。在扫描前，查询数据库中该路径下的 `file_count`。若文件数量与路径未变，直接跳过整个目录。
    - **并发锁**：使用 `p-limit` 模块。定义 `DIR_SCAN_LIMIT = 5`，确保即便目录极深，Node.js 事件循环也不会卡死。

### B. 异步探测任务系统 (ScanQueueService)
*   **实现方法**：
    - **状态管理**：在 `netdisk_media` 表增加 `probe_status` (0:未探测, 1:成功, -1:失败)。
    - **后台调度**：扫描完成后，触发一个 `Worker` 队列。该队列使用 `PROBE_CONCURRENCY = 1~3`（可调）静默运行。
    - **智能间隔**：每次 `ffprobe` 后休眠 `500ms`，配合 `os.loadavg()`，若负载超过阈值（如 2.0）则自动暂停。

### C. 图片采集鲁棒性 (ImageCacheService)
*   **实现方法**：
    - **原子操作**：`download -> sharp -> write to .tmp -> rename to .webp`。
    - **Magic Number 校验**：在读取缓存前，检查文件头部字节确保其为合法的 WebP。
    - **失败名单**：连续失败 3 次的 URL 记录到 `failed_images` 表，24小时内不再重试。

---

## 2. 核心功能：自适应播放 (Transcode)

### A. 三级智能路由 (TranscodeService)
*   **算法逻辑**：
    1.  **Direct (直连)**：`v_codec == 'h264' && ext == 'mp4'`。
    2.  **Transmux (转封装)**：`v_codec == 'h264' && ext == 'mkv'`。FFmpeg 参数使用 `-c:v copy -c:a aac`，CPU 占用极低。
    3.  **Transcode (全转码)**：其余情况。

### B. 客户端能力感知 (Frontend -> Backend)
*   **实现方法**：
    - **协商请求**：前端播放前调用 `/api/play-decision`，带上能力参数 `canPlayH265: true`。
    - **动态决策**：如果前端支持且后台标签显示资源是 H.265，后端直接下发 `Direct Play` URL，绕过转码服务。

---

## 3. 核心体验：交互与纠偏 (Frontend)

### A. 虚拟列表集成 (Netdisk.tsx)
*   **实现方法**：
    - 使用 `react-window` 或 `react-virtuoso` 替换 `grid` 渲染逻辑。
    - **效果**：仅渲染窗口可见的 12~24 个卡片，解决数千部影片导致的 DOM 内存溢出。

### B. 媒体库纠偏功能
*   **实现方法**：
    - **数据锁定**：增加 `is_locked` 字段。一旦用户手动修改过，自动将其标记。
    - **TMDB 智能弹窗**：在详情页提供「修正识别」按钮，调用 `tmdbService.searchMulti` 让用户手动认领正确的资源 ID。

---

## 4. 关键数据库变更 (Schema)

```sql
ALTER TABLE netdisk_media ADD COLUMN probe_status INTEGER DEFAULT 0; -- 探测状态
ALTER TABLE netdisk_media ADD COLUMN v_codec TEXT;                  -- 视频编码
ALTER TABLE netdisk_media ADD COLUMN container TEXT;                -- 封装格式
ALTER TABLE netdisk_media ADD COLUMN is_locked INTEGER DEFAULT 0;   -- 元数据锁定锁
ALTER TABLE video_sources ADD COLUMN scan_concurrency INTEGER DEFAULT 5; -- 扫描并发设置
```

---

## 5. 实施路线图建议
1.  **Step 1**：执行数据库补全及扫描降耦（解决 CPU 问题）。
2.  **Step 2**：实现异步探测队列（补全元数据标签）。
3.  **Step 3**：重构播放决策路由（实现智能转码与直播）。
4.  **Step 4**：前端 UI 虚拟化与纠偏功能。

这份方案是未来实施的**总纲**。建议在处理时，先从 Step 1 这种「救急」的工作开始。
