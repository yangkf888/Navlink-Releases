# Video 插件架构指南

本文档总结了 Video 插件与其他插件（如 Sub、VPS、KBrag）在架构上的主要差异，特别是**侧边栏**和**移动端顶部栏**的实现方式，为将来其他插件的改造提供指引。

## 一、架构对比

| 特性 | 传统插件 (Sub/VPS) | Video 插件 |
|------|-------------------|------------|
| **侧边栏** | 使用主应用侧边栏 | 插件内部自建侧边栏 |
| **移动端导航** | 继承主应用顶部导航 | 独立移动端顶部栏 |
| **postMessage** | 发送完整侧边栏配置 | 发送空配置 + 隐藏请求 |
| **主题切换** | 依赖主应用 | 插件内部管理 |

---

## 二、核心实现差异

### 2.1 侧边栏实现

#### 传统方式（发送配置给主应用）
```javascript
// 传统插件：发送完整侧边栏配置
window.parent.postMessage({
    type: 'PLUGIN_SET_SIDEBAR',
    payload: {
        title: '插件名',
        items: [
            { id: 'home', label: '首页', icon: 'fas fa-home' },
            { id: 'settings', label: '设置', icon: 'fas fa-cog' }
        ],
        activeId: 'home'
    }
}, '*');
```

#### Video 方式（插件内部侧边栏）
```javascript
// Video 插件：发送空配置，使用内部侧边栏
window.parent.postMessage({
    type: 'PLUGIN_SET_SIDEBAR',
    payload: {
        title: '视频中心',
        subtitle: '多源视频聚合',
        items: [],  // 空项目，不使用主应用侧边栏
        activeId: ''
    }
}, '*');
```

**优势**：
- 更灵活的侧边栏结构（支持折叠组、状态指示器等）
- 独立的主题控制
- 更好的响应式布局控制

### 2.2 移动端顶部栏

#### 传统方式
移动端直接继承主应用的 `TopNavbar`，插件无法自定义。

#### Video 方式

**Step 1: 发送隐藏主应用导航请求**
```javascript
// App.tsx - 插件加载时发送
useEffect(() => {
    const isInIframe = window.parent !== window;
    if (isInIframe) {
        window.parent.postMessage({
            type: 'PLUGIN_REQUEST_HIDE_HEADER',
            payload: { hideMobile: true }
        }, '*');
    }
}, []);
```

**Step 2: 主应用监听并响应**
```tsx
// PluginLayout.tsx
const [hideMobileHeader, setHideMobileHeader] = useState(false);

useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'PLUGIN_REQUEST_HIDE_HEADER') {
            setHideMobileHeader(event.data.payload?.hideMobile ?? false);
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}, []);

// 渲染时条件隐藏
<div className={hideMobileHeader ? 'hidden lg:block' : ''}>
    <TopNavbar ... />
</div>
```

**Step 3: 插件实现自己的移动端顶部栏**
```tsx
// GlobalSearchBar.tsx
<>
    {/* 移动端导航栏 */}
    <div className="lg:hidden sticky top-0 z-20 ...">
        <div className="flex items-center justify-between">
            {/* 左侧：☰ + 标题 */}
            <div className="flex items-center gap-3">
                <button onClick={onToggleSidebar}>
                    <i className="fas fa-bars"></i>
                </button>
                <h1>视频中心</h1>
            </div>
            {/* 右侧：工具按钮 */}
            <div className="flex items-center gap-1">
                <button onClick={() => setMobileSearchOpen(true)}>🔍</button>
                <button onClick={toggleTheme}>🌙</button>
                <button onClick={handleUserClick}>👤</button>
            </div>
        </div>
    </div>

    {/* 桌面端导航栏 */}
    <div className="hidden lg:block sticky top-0 z-20 ...">
        {/* 完整布局：搜索框 + 导航菜单 + 工具栏 */}
    </div>
</>
```

---

## 三、关键组件说明

### 3.1 Layout.tsx

插件的主布局组件，负责：
- 桌面端侧边栏渲染
- 移动端侧边栏抽屉（z-index: 100 确保不被播放器遮挡）
- 将控制函数传递给 GlobalSearchBar 和 Sidebar

```tsx
// 移动端侧边栏抽屉
{mobileOpen && (
    <div className="fixed inset-0 z-[100] lg:hidden">
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
        <div className="absolute left-0 top-0 bottom-0 w-64 bg-gray-950">
            <Sidebar 
                isMobile={true}
                onCloseMobile={() => setMobileOpen(false)}
                activeModule={activeModule}
                onModuleChange={onModuleChange}
            />
        </div>
    </div>
)}
```

### 3.2 Sidebar.tsx

插件内部侧边栏组件，特点：
- 支持折叠/展开
- 移动端显示导航菜单（首页/资源站/电视/直播/网盘）
- 桌面端显示视频源列表

```tsx
interface SidebarProps {
    isMobile?: boolean;
    onCloseMobile?: () => void;
    activeModule?: AppModule;       // 当前激活的模块
    onModuleChange?: (module: AppModule) => void;  // 模块切换回调
    // ... 其他 props
}

// 移动端导航菜单
{isMobile && onModuleChange && (
    <div className="px-2 pb-3 mb-2 border-b border-gray-800">
        <div className="text-xs text-gray-500 px-2 mb-2">导航</div>
        {['home', 'sources', 'tv', 'live', 'netdisk'].map(item => (
            <button onClick={() => { onModuleChange(item); onCloseMobile?.(); }}>
                {item.label}
            </button>
        ))}
    </div>
)}
```

### 3.3 GlobalSearchBar.tsx

全局搜索栏组件，同时承担移动端顶部栏功能：
- 移动端：☰ + 标题 + 搜索/主题/用户按钮
- 桌面端：视频源选择器 + 搜索框 + 导航菜单 + 工具栏
- 移动端搜索弹出层（全屏搜索界面）

---

## 四、改造其他插件的步骤

### Step 1: 创建插件内部侧边栏
1. 复制 `Sidebar.tsx` 作为模板
2. 根据插件需求修改菜单项
3. 在 `Layout.tsx` 中集成

### Step 2: 创建移动端顶部栏
1. 在 GlobalSearchBar 或类似组件中添加移动端布局
2. 使用 `lg:hidden` / `hidden lg:block` 区分移动端/桌面端

### Step 3: 发送 postMessage
```javascript
// 发送空侧边栏配置
window.parent.postMessage({
    type: 'PLUGIN_SET_SIDEBAR',
    payload: { title: '插件名', items: [], activeId: '' }
}, '*');

// 请求隐藏移动端主应用导航
window.parent.postMessage({
    type: 'PLUGIN_REQUEST_HIDE_HEADER',
    payload: { hideMobile: true }
}, '*');
```

### Step 4: 处理 z-index 层级
- 移动端侧边栏抽屉：`z-[100]`
- 搜索弹出层：`z-50`
- 分类导航栏：`z-10`

---

## 五、常见问题

### Q1: 播放器遮挡侧边栏怎么办？
将侧边栏抽屉的 z-index 设为足够高（如 `z-[100]`）。

### Q2: 分类目录展开后立即收回？
- 延迟添加外部点击监听（300ms）
- 排除展开按钮本身的点击事件
- 使用 `mousedown` 而非 `click`

### Q3: 主题切换如何处理？
Video 插件使用 localStorage 独立管理主题，不依赖主应用：
```javascript
const [theme, setTheme] = useState(() => 
    localStorage.getItem('video_theme') || 'dark'
);
```

### Q4: 侧边栏宽度无法正确显示怎么办？

这是一个常见问题，需要确保以下几点：

**1. CSS 全局设置（index.css）：**
```css
html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
}
```

**2. Sidebar 根元素必须包含 `w-full`：**
```tsx
// ✅ 正确
<div className="flex flex-col h-full w-full bg-white">

// ❌ 错误（缺少 w-full）
<div className="flex flex-col h-full bg-white">
```

**3. Layout 容器使用正确的 flex 布局：**
```tsx
<div className="flex h-screen overflow-hidden">
    {/* 侧边栏容器 - 需要 flex-shrink-0 防止被压缩 */}
    <div className="hidden lg:flex w-72 flex-shrink-0 border-r">
        <Sidebar />
    </div>
    
    {/* 内容区域 - flex-1 和 min-w-0 确保正确填充 */}
    <div className="flex-1 min-w-0 flex flex-col">
        {children}
    </div>
</div>
```

**4. 主应用 PluginLayout 必须正确处理空 items：**
```tsx
// 只有当 items 数组不为空时才渲染主应用侧边栏
{pluginSidebarConfig && pluginSidebarConfig.items && pluginSidebarConfig.items.length > 0 && (
    <aside>...</aside>
)}
```

---

## 六、文件结构参考

```
plugins/video/frontend/src/
├── App.tsx                 # 主应用入口，发送 postMessage
├── components/
│   ├── Layout.tsx          # 布局组件，管理侧边栏显示
│   ├── Sidebar.tsx         # 插件内部侧边栏
│   ├── GlobalSearchBar.tsx # 搜索栏 + 移动端顶部栏
│   └── CategoryNav.tsx     # 分类导航（可选）
└── pages/
    └── ...                 # 各页面组件
```

---

## 七、总结

Video 插件的架构设计提供了更高的灵活性和更好的移动端体验，主要通过：

1. **插件内部侧边栏**：完全控制侧边栏的结构和样式
2. **独立移动端顶部栏**：针对移动端优化的导航体验
3. **postMessage 通信**：与主应用协调隐藏/显示元素

这种架构适合需要复杂导航结构或特殊移动端体验的插件。
