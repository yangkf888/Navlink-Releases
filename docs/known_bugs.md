# 已知未更正 Bug 清单

本文档记录项目中已知但暂未修复的 Bug 及其技术分析。

## 1. ConfigContext 配置更新死循环警告

### 错误信息
在部分用户的浏览器控制台中，可能会出现红色警告：
```
Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

### 触发条件
- **高频操作**：用户在后台管理界面进行频繁操作（如连续拖拽分类、快速输入配置）。
- **多标签页**：用户同时打开了多个本站点的标签页。
- **特定网络环境**：在网络延迟较高或异步操作时序堆积的情况下更容易复现。

### 原因分析
该问题源于 `ConfigContext.tsx` 中的状态同步机制存在设计缺陷，导致了状态更新的无限循环或过度递归。

1.  **自我监听与更新冗余**：
    - `setConfig` 函数在更新 React 状态后，会同步派发一个全局 CustomEvent (`nav-config-updated`)。
    - 同一个 Provider 内的 `useEffect` 同时监听了这个事件，并再次调用 `setConfigState`。
    - 这导致一次更新操作实际上触发了两次状态变更流程（一次直接调用，一次通过事件回调）。

2.  **事件风暴**：
    - `window.dispatchEvent` 是同步的。
    - 在高频操作下（如拖拽库频繁触发 `onDragEnd`），大量的状态更新和事件派发在极短时间内堆积。
    - React 的状态更新队列深度超过限制（通常为 50 次嵌套更新）。

3.  **多标签页干扰**：
    - 跨标签页的 `storage` 事件监听机制可能导致两个标签页互相“乒乓”式地触发更新，尤其是在自动保存逻辑 (`useEffect` + `setTimeout`) 同时由于 `config` 变化被触发时。

### 建议修复方案
需要对 `ConfigContext.tsx` 进行重构，通过以下方式打破循环链：

1.  **移除内部事件监听**：
    - 删除 `ConfigContext.tsx` 内部对 `nav-config-updated` 事件的监听逻辑。
    - React Context 的状态变化会自动传递给子组件，不需要通过 DOM 事件来通知自己。

2.  **优化 `setConfig` 逻辑**：
    - `setConfig` 只需负责更新 `setConfigState` 和 `localStorage`（用于持久化）。
    - 派发事件仅用于通知**外部**非 React 代码（如果确实有需求），而不应被自身消费。

3.  **防抖处理**：
    - 对 `saveConfig` 的自动保存逻辑增加更严格的防抖 (Debounce) 或节流 (Throttle) 控制，避免因中间状态变化频繁触发网络请求和后续的状态同步。

---

## 2. 数据库缺失 Role Permissions 表导致启动失败

### 错误信息
容器启动日志中出现以下错误，导致应用功能异常或 Crash：
```
Failed to get all role permissions: SqliteError: no such table: role_permissions
    at Database.prepare (/app/node_modules/better-sqlite3/lib/methods/wrappers.js:5:21)
    ...
```

### 触发条件
- **新部署**：首次部署包含 RBAC 功能的新版本应用。
- **数据持久化**：使用已存在的 `navlink.db` 数据库文件（该文件由旧版本创建）。
- **启动时**：后端服务启动并尝试加载权限配置时。

### 原因分析
这是一个数据库迁移缺失的问题。

1.  **代码依赖不匹配**：
    - 后端代码 `RolePermissionsDAO.js` 依赖于 `role_permissions` 表的存在，并在启动时尝试查询该表。
2.  **初始化脚本缺失**：
    - 数据库初始化文件 `server/database/initConfigDB.js` 中包含 `site_config`, `categories` 等表的创建语句，但**完全缺失**了 `CREATE TABLE IF NOT EXISTS role_permissions` 的定义。
3.  **无自动迁移**：
    - 当前系统缺乏自动检测并应用缺失表的迁移机制。如果数据库文件已存在，初始化脚本通常只会检查那些已在脚本中定义的表，而不会“凭空”创建未定义的表。

### 建议修复方案
需要更新数据库初始化逻辑：

1.  **更新 `initConfigDB.js`**：
    - 在 `initConfigDB.js` 中添加 `role_permissions` 表的创建 SQL 语句。
    ```sql
    CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT PRIMARY KEY,
        permissions TEXT NOT NULL, -- JSON string
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ```

2.  **添加迁移脚本**：
    - 对于已存在的数据库，需要启动时检查并创建该表。

3.  **容错处理**：
    - 在 `RolePermissionsDAO.js` 中增加 `try-catch` 或表存在性检查，如果是首次启动且表不存在，应优雅降级而不是抛出未捕获异常。
