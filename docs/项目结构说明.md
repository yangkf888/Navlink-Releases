# NavLink 项目结构说明

## 📁 src/ 目录结构

```
src/
├── App.tsx                        # 主应用路由配置
├── main.tsx                       # Vite 入口文件
├── index.css                      # 全局样式
├── tsconfig.json                  # TypeScript 配置文件
├── tsconfig.node.json             # Vite TypeScript 配置
│
├── apps/                          # 多应用架构
│   ├── admin/                     # 后台管理应用
│   │   ├── App.tsx               # Admin 应用入口
│   │   ├── config/               # Admin 配置
│   │   │   └── routes.ts         # 集中式路由配置
│   │   ├── components/           # Admin 专用组件
│   │   │   └── ProtectedRoute.tsx # 路由权限守卫
│   │   ├── layout/               # Admin 布局组件
│   │   │   ├── AdminLayout.tsx   # 主布局
│   │   │   ├── Header.tsx        # 顶部栏
│   │   │   └── Sidebar.tsx       # 侧边栏
│   │   ├── pages/                # Admin 页面(按后台侧边栏组织)
│   │   │   ├── Dashboard.tsx     # 仪表盘
│   │   │   ├── PermissionDenied.tsx # 403页面
│   │   │   ├── Content/          # 内容管理模块
│   │   │   │   ├── BasicSettings.tsx      # 全局外观
│   │   │   │   ├── TopNavSettings.tsx     # 顶部导航
│   │   │   │   ├── HeroSettings.tsx       # 首屏搜索
│   │   │   │   ├── PromoSettings.tsx      # 热门/推广
│   │   │   │   ├── CategorySettings.tsx   # 内容分类
│   │   │   │   └── SidebarSettings.tsx    # 侧边栏
│   │   │   └── System/           # 系统管理模块
│   │   │       ├── Plugins/              # 应用商城
│   │   │       ├── AIConfig.tsx          # AI配置
│   │   │       ├── LinkHealth.tsx        # 链接健康
│   │   │       ├── MediaManagement.tsx   # 资源管理
│   │   │       ├── DataManagement.tsx    # 数据管理
│   │   │       ├── Users.tsx             # 用户管理
│   │   │       ├── Permissions.tsx       # 权限管理
│   │   │       ├── Tenants.tsx           # 租户管理
│   │   │       ├── Logs.tsx              # 系统日志
│   │   │       └── Monitor.tsx           # 监控面板
│   │   ├── types/                # Admin 类型定义
│   │   │   └── index.ts
│   │   └── utils/                # Admin 工具函数
│   │       └── index.ts
│   │
│   └── navlink/                   # 前台导航站应用
│       ├── App.tsx
│       ├── layout/
│       ├── pages/
│       └── components/
│
└── shared/                        # 共享资源
    ├── components/                # 共享UI组件
    │   ├── ui/                    # 基础UI组件
    │   │   ├── AdminInput.tsx    # 输入框组件
    │   │   ├── AdminButton.tsx   # 按钮组件
    │   │   ├── Accordion.tsx     # 手风琴组件
    │   │   └── LinkItemEditor.tsx
    │   ├── layout/                # 布局组件
    │   │   ├── TopNavbar.tsx
    │   │   └── FloatingMenu.tsx
    │   └── common/                # 通用组件
    │       ├── Icon.tsx
    │       ├── Toast.tsx
    │       ├── ConfirmDialog.tsx
    │       ├── AlertDialog.tsx
    │       ├── PromptDialog.tsx
    │       ├── LoginDialog.tsx
    │       ├── ErrorBoundary.tsx
    │       └── ConfirmModal.tsx
    │
    ├── hooks/                     # 共享React Hooks
    │   ├── useAppConfig.ts
    │   ├── usePermissions.ts
    │   ├── useSessionManager.ts
    │   └── useDialogs.ts
    │
    ├── services/                  # API服务层
    │   └── api.ts                 # API调用封装
    │
    ├── store/                     # 全局状态管理
    │   └── AppStore.tsx
    │
    ├── utils/                     # 工具函数
    │   ├── url.ts
    │   └── linkHealthChecker.ts
    │
    ├── lib/                       # 第三方库封装
    │
    ├── types/                     # TypeScript类型定义
    │   └── index.ts
    │
    ├── context/                   # React Context
    │   └── ConfigContext.tsx
    │
    └── constants.ts               # 全局常量
```

## 🎯 目录职责说明

### apps/ - 应用目录
- **admin/**: 后台管理系统,独立的React应用
- **navlink/**: 前台导航站,独立的React应用
- 每个应用有自己的路由、布局、页面和专用组件

### shared/ - 共享资源
- **components/**: 可复用的UI组件,按功能分类
  - `ui/`: 基础表单组件、展示组件
  - `layout/`: 布局相关组件
  - `common/`: 弹窗、提示等通用组件
  
- **hooks/**: 自定义React Hooks,提供复用逻辑
- **services/**: API调用层,统一管理后端接口
- **store/**: 全局状态管理(Zustand/Redux等)
- **utils/**: 纯工具函数,不依赖React
- **lib/**: 第三方库的二次封装
- **types/**: TypeScript类型定义
- **context/**: React Context Provider
- **constants.ts**: 全局常量定义

## 📝 导入路径规范

### 使用路径别名 @/
```typescript
// ✅ 推荐:使用别名
import { api } from '@/shared/services/api';
import { useAppConfig } from '@/shared/hooks/useAppConfig';
import { Button } from '@/shared/components/ui/AdminButton';

// ❌ 避免:相对路径
import { api } from '../../../shared/services/api';
```

### 应用内导入
```typescript
// Admin应用内组件导入
import { StatCard } from '../components/StatCard';
import { AdminLayout } from '../layout/AdminLayout';
```

## 🔧 优化记录

### 2025-12-05 第三次优化 - 清理废弃文件和重复代码
1. ✅ 删除4个废弃的.js文件(已有.tsx版本)
2. ✅ 删除navlink/components/layout下的重复组件(TopNavbar, FloatingMenu)
3. ✅ 删除重复的navlink/data/constants.ts(与shared/constants.ts完全相同)
4. ✅ 删除空navlink/data目录
5. ✅ 共删除7个文件,减少约30KB+重复代码

### 2025-12-05 第二次优化 - Admin页面按后台侧边栏重组
1. ✅ 删除 `apps/navlink/components/admin/` 废弃组件
2. ✅ 删除 `apps/admin/pages/Navigation/` 和 `Settings/` 废弃目录
3. ✅ 创建 `apps/admin/pages/Content/` 内容管理模块
4. ✅ 创建 `apps/admin/pages/System/` 系统管理模块
5. ✅ 按后台侧边栏菜单结构重组所有页面
6. ✅ 创建 `apps/admin/types/` 和 `apps/admin/utils/`
7. ✅ 修复所有导入路径和默认导出
8. ✅ 添加 Monitor.tsx 监控面板占位页

### 2025-12-05 第一次优化 - 共享资源整理
1. ✅ 删除重复的 `apps/admin/components/ui/` 组件
2. ✅ 删除重复的 `shared/constants.js` 文件
3. ✅ 移动 `components/store/AppStore.tsx` → `shared/store/AppStore.tsx`
4. ✅ 移动 `shared/utils/api.ts` → `shared/services/api.ts`
5. ✅ 创建 `shared/lib/` 目录用于第三方库封装
6. ✅ 统一使用 `@/shared` 路径别名
7. ✅ 更新所有导入路径引用

### 2025-12-09 第四次优化 - 集中式权限管理系统重构
1. ✅ 创建 `apps/admin/config/routes.ts` 集中管理所有路由配置
2. ✅ 创建 `ProtectedRoutes` 组件实现统一的路由级权限控制
3. ✅ 移除分散在各个页面中的 `RequirePermission` HOC 包装，代码更清晰
4. ✅ 新增 `tsconfig.json` 和 `tsconfig.node.json` 修复 IDE 路径别名识别问题
5. ✅ 修复多个插件和页面的 Lint 错误

### 优化效果
- 权限管理集中化，易于维护和审计
- 路由配置可视化，一目了然
- IDE 开发体验提升，报错减少

### 2025-12-09 第五次优化 - 后端工程化基建
1. ✅ 引入数据库迁移系统 (SQLite Migrations)，告别手动管理 SQL
2. ✅ 集成 Swagger/OpenAPI (API Docs)，自动生成交互式接口文档
3. ✅ 引入 Vitest 单元测试框架，建立自动化测试基线
4. ✅ 完善 TypeScript 类型定义，补充系统级通用接口 (User, ApiResponse等)
5. ✅ 优化 `package.json` 脚本，新增 `test`, `migrate:make` 等命令

### 优化效果
- 数据库变更可追溯、可回滚
- API 文档实时同步，降低沟通成本
- 代码质量有测试保障，维护信心提升

## 🚀 最佳实践

1. **新组件放置规则**:
   - 仅用于单个应用 → `apps/{app}/components/`
   - 多个应用共用 → `shared/components/`

2. **API调用规则**:
   - 所有API调用通过 `shared/services/api.ts`
   - 避免在组件中直接使用 fetch/axios

3. **状态管理规则**:
   - 全局状态 → `shared/store/`
   - 应用级状态 → `apps/{app}/store/`
   - 页面级状态 → 组件内 useState

4. **类型定义规则**:
   - 共享类型 → `shared/types/`
   - 应用专用类型 → `apps/{app}/types/`

## 📦 构建输出

```
dist/
├── index.html
├── assets/
│   ├── main-{hash}.css      # 样式文件
│   ├── AdminPanel-{hash}.js # Admin应用包
│   └── main-{hash}.js       # 主应用包
```

## 🔗 相关文档

- [开发计划](NavLink_开发计划_v2.0_调整版.md)
- [项目报告](PROJECT_REPORT.md)
- [安全配置](SECURITY.md)
