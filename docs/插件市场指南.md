# NavLink 插件市场实施指南

## 📦 系统架构

### 1. 整体流程

```
用户访问应用商城 
    ↓
前端展示插件列表(含安装状态)
    ↓
用户点击"安装"
    ↓
后端从GitHub下载ZIP
    ↓
解压到plugins/目录
    ↓
验证manifest.json
    ↓
重新扫描插件
    ↓
安装完成
```

### 2. 文件结构

```
navlink/
├── plugins/                          # 本地安装的插件
│   ├── sub/
│   │   ├── manifest.json
│   │   ├── index.js
│   │   └── package.json
│   ├── vps/
│   └── docker/
│
├── server/
│   └── services/
│       └── PluginMarketService.js   # 插件市场服务
│
└── docs/
    └── plugin-registry-example.json  # 注册表示例
```

---

## 🚀 部署步骤

### Step 1: 安装依赖

```bash
npm install adm-zip
```

### Step 2: 创建GitHub仓库

创建一个新仓库存放插件: `navlink-plugins`

```
navlink-plugins/
├── registry.json          # 插件注册表
├── sub/
│   ├── manifest.json
│   └── sub.zip           # 打包后的插件
├── vps/
└── docker/
```

### Step 3: 配置注册表URL

在 `.env` 文件中设置:

```env
PLUGIN_REGISTRY_URL=https://raw.githubusercontent.com/YOUR_ORG/navlink-plugins/main/registry.json
```

### Step 4: 更新路由配置

在 `src/apps/admin/router.tsx` 中添加路由:

```typescript
{
  path: 'plugin-market',
  element: <PluginMarket />
}
```

### Step 5: 更新侧边栏菜单

在侧边栏配置中添加"应用商城"菜单项。

---

## 📝 插件打包规范

### manifest.json 必须字段

```json
{
  "id": "sub",                    // 唯一ID
  "name": "订阅转换",               // 显示名称
  "version": "1.2.0",             // 版本号
  "description": "...",           // 描述
  "author": "NavLink Team",       // 作者
  "type": "node",                 // 类型: node/python/binary/docker
  "entry": "index.js",            // 入口文件
  "port": 10001                   // 可选: 固定端口
}
```

### 打包流程

```bash
# 1. 进入插件目录
cd plugins/sub

# 2. 确保有manifest.json
cat manifest.json

# 3. 打包为ZIP
zip -r sub.zip . -x "*.git*" -x "node_modules/*"

# 4. 上传到GitHub Release
gh release create sub-v1.2.0 sub.zip
```

---

## 🔧 API接口说明

### 1. 获取插件市场列表

```http
GET /api/plugin-market
Authorization: Bearer <token>
```

响应:
```json
[
  {
    "id": "sub",
    "name": "订阅转换",
    "version": "1.2.0",
    "installed": true,
    "installedVersion": "1.1.0",
    "updateAvailable": true,
    "status": "running"
  }
]
```

### 2. 安装插件

```http
POST /api/plugin-market/:id/install
Authorization: Bearer <token>
```

### 3. 更新插件

```http
POST /api/plugin-market/:id/update
Authorization: Bearer <token>
```

### 4. 卸载插件

```http
DELETE /api/plugin-market/:id
Authorization: Bearer <token>
```

### 5. 刷新缓存

```http
POST /api/plugin-market/refresh
Authorization: Bearer <token>
```

---

## 🎨 前端组件说明

### PluginMarket.tsx

- **功能**: 插件市场主页面
- **特性**:
  - 搜索功能
  - 分类过滤
  - 安装/更新/卸载
  - 实时状态显示
  - 进度提示

### PluginCard

- 单个插件卡片
- 显示安装状态
- 更新提示
- 操作按钮

---

## 🛡️ 安全考虑

### 1. 权限控制

- 安装/更新/卸载 需要管理员权限
- 查看市场 只需登录

### 2. 下载验证

```javascript
// 验证manifest.json
if (manifest.id !== pluginId) {
    throw new Error('Plugin ID mismatch');
}
```

### 3. 备份机制

更新插件时自动备份:
```javascript
await fs.rename(pluginDir, backupDir);
// 更新失败时恢复
await fs.rename(backupDir, pluginDir);
```

---

## 📊 缓存策略

- **注册表缓存**: 5分钟
- **本地状态**: 实时
- **手动刷新**: 清除缓存重新获取

---

## 🔄 插件生命周期

```
未安装 → 安装中 → 已停止 → 启动中 → 运行中
                ↓          ↓
              安装失败    启动失败
                ↓          ↓
              卸载        重试/停止
```

---

## 📖 使用示例

### 用户角度

1. 进入后台 → 系统管理 → 应用商城
2. 搜索需要的插件
3. 点击"安装"按钮
4. 等待安装完成
5. 到"插件管理"页面启动插件

### 开发者角度

```bash
# 1. 创建插件
mkdir plugins/my-plugin
cd plugins/my-plugin

# 2. 创建manifest.json
cat > manifest.json << EOF
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "type": "node",
  "entry": "index.js",
  "author": "Me"
}
EOF

# 3. 创建入口文件
cat > index.js << EOF
const port = process.env.PORT || 10001;
console.log(\`READY:\${port}\`);
EOF

# 4. 打包
zip -r my-plugin.zip .

# 5. 上传到GitHub并更新registry.json
```

---

## 🐛 故障排查

### 问题1: 下载失败

**原因**: 网络问题或GitHub限流

**解决**:
- 检查网络连接
- 使用代理: `HTTPS_PROXY=http://proxy:port`
- 检查downloadUrl是否正确

### 问题2: 解压失败

**原因**: ZIP格式错误

**解决**:
- 重新打包: `zip -r plugin.zip . -x "*.git*"`
- 检查文件权限

### 问题3: 安装后无法启动

**原因**: manifest.json 配置错误

**解决**:
- 检查type字段
- 检查entry文件路径
- 查看启动日志

---

## 🎯 后续优化

1. **进度条**: 显示下载/解压进度
2. **依赖检查**: 安装前检查requirements
3. **版本锁定**: 支持安装特定版本
4. **评分系统**: 用户可以评价插件
5. **自动更新**: 定期检查并提示更新
6. **插件仓库镜像**: 国内CDN加速

---

## 📚 参考资料

- [插件开发文档](./PLUGIN_DEVELOPMENT.md)
- [manifest.json规范](./PLUGIN_MANIFEST.md)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
