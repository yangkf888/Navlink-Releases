# NavLink Video 插件：Emby 同步技术实现蓝图

本文档详细记录了 NavLink Video 插件与 Emby 媒体服务器实现深度集成（包含封面、内容、首页、多级筛选、双向进度同步）的技术设计方案，旨在为后续系统迭代或同类功能开发提供精确的工程参考。

---

## 1. 核心认证协议

Emby 接口的稳定性高度依赖认证头（Header）。我们在后端统一采用了 `X-Emby-Token` 与 `X-Emby-Authorization` 双重保险模式。

### 认证头构造逻辑
```javascript
// 在媒体服务器服务类中统一封装
static getReportingHeaders(api_key, user_id) {
    const authLine = `Emby UserId="${user_id}", Client="NavLink", Device="Web", DeviceId="NAVLINK-WEB-V2", Version="2.0.0", Token="${api_key}"`;
    return {
        'X-Emby-Token': api_key,
        'X-Emby-Authorization': authLine,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
}
```

---

## 2. 首页数据聚合 (Dynamic Home View)

NavLink 不通过硬编码展示分类，而是动态镜像 Emby 的首页布局，确保感知一致。

### 数据流向
1.  **后端路由**: `GET /media-servers/:id/home`
2.  **核心调用点**: 
    -   `/emby/Users/:userId/Items/Resume` (拉取“继续观看”记录，限制 Limit 为 12)。
    -   `/emby/Items?Recursive=true&IncludeItemTypes=Movie,Series&Limit=20&SortBy=DateCreated&SortOrder=Descending` (拉取最新内容)。
3.  **前端渲染**: 使用 `MediaServerHomeView` 组件，将返回的 Section 列表动态转化为横向滚动海报墙。

---

## 3. 多级内容与高级筛选

### 内容加载
通过 `GET /emby/Items` 实现。
-   **关键字段**: 必须包含 `Fields: 'PrimaryImageAspectRatio,ProductionYear,UserData,CommunityRating,RuntimeTicks'`。
-   **递归模式**: 对于常规库，使用 `Recursive=true`；对于二级文件夹，则通过 `ParentId` 进行锚定。

### 筛选排序 (Sort & Filter)
前端通过 `sortBy` 和 `sortOrder` 参数映射 Emby 的原生排序指令：
-   **默认**: `DateCreated,SortName` (最新加入在前)。
-   **评分**: `CommunityRating,SortName`。
-   **年份**: `ProductionYear,SortName`。

---

## 4. 双向进度同步：极致方案 (The Ultimate Sync Strategy)

这是本项目最具技术难度的部分，采用了“双轨制”上行和“强制读秒”下行。

### 4.1 上行同步（Video -> Emby）- “双轨保险”
为了对抗 Emby 会话匹配不稳定的顽疾，我们在后端并联了两条路：

1.  **实时轨**: 调用 `/Sessions/Playing/Progress`。用于在播放过程中向 Emby 汇报心跳，确保 Emby 管理面板显示“正在播放”。
2.  **数据库轨 (黑科技)**: 在**暂停**或**播放结束**时，直接调用：
    -   `POST /emby/Users/:userId/Items/:itemId/UserData`
    -   **Payload**: `{ PlaybackPositionTicks: currentTicks }`
    -   **逻辑建议**: 直接修改用户数据库记录，跳过所有会话验证，实现 100% 成功率的断点归档。

### 4.2 下行同步（Emby -> Video）- “二段强制跳转”
1.  **后端加固**: 在加载视频详情 `getItemDetail` 时，显式带上 `Fields: 'UserData'` 参数。
2.  **前端读取**: 播放器启动前，从 `UserData.PlaybackPositionTicks` 中提取进度。
3.  **播放器执行**: 由于 HLS 协议在 JS 初始化时的不确定性，我们在 Artplay 的 `ready` 事件中执行了**二次硬跳转**：
    ```javascript
    art.on('ready', () => {
        if (startTime > 0) {
            art.seek = startTime; // 强制指针重置
        }
    });
    ```

---

## 5. 图像与媒体服务映射

### 封面图构造
NavLink 使用 Emby 的镜像地址进行实时代理，避免本地存储压力。
-   **主海报**: `/emby/Items/:id/Images/Primary?maxWidth=300&tag=:tag&api_key=:key`
-   **缩略图**: `/emby/Items/:id/Images/Thumb?maxWidth=400&tag=:tag&api_key=:key`

### 播放流地址
通过 `getPlaybackInfo` (POST) 动态获取 `MediaSourceId`，并发起流请求：
-   **地址结构**: `/videos/:itemId/stream.:container?MediaSourceId=:sid&Static=true&api_key=:key`

---

## 6. 开发与发布规范 (Build Chain)
-   **前端编译**: 插件前端逻辑变更后，必须进入 `plugins/video/frontend` 执行 `npm run build`。
-   **静态分发**: 后端会挂载 `dist` 目录作为插件的静态资源服务。

---

> [!NOTE]
> 本方案已在 2026 年 1 月的专项修复中通过生产验证，其核心价值在于绕过了 Emby 不稳定的 Sessions 接口，转而使用 UserData 接口实现了金融级的同步稳定性。 antisense antisocial antisense antisocial antisocial antisocial antisymmetric Antisocial.
