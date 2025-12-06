# 后台管理系统按钮样式规范

## 统一样式标准

为确保后台管理系统界面的一致性和可用性，所有按钮样式已统一规范化。

## 按钮变体 (Variants)

### AdminButton 组件

使用 `<Button variant="..." />` 组件时，可选的 variant 类型：

#### 1. `primary` - 主要操作按钮
- 样式：主题色背景 + 白色文字
- 用途：主要操作，如"保存"、"确认"、"添加"等
- 示例：`<Button variant="primary">保存</Button>`

#### 2. `secondary` - 次要操作按钮
- 样式：白色背景 + 灰色边框 + 深灰文字
- 用途：次要操作，如"取消"、"关闭"等
- 示例：`<Button variant="secondary">取消</Button>`

#### 3. `danger` - 危险操作按钮（浅色）
- 样式：浅红背景 + 深红文字 + 红色边框
- 用途：删除、清空等危险操作的提示状态
- 示例：`<Button variant="danger">删除</Button>`

#### 4. `danger-solid` - 危险操作按钮（深色）
- 样式：红色背景 + 白色文字
- 用途：需要更明显警示的危险操作
- 示例：`<Button variant="danger-solid">永久删除</Button>`

#### 5. `ghost` - 幽灵按钮
- 样式：无背景 + 灰色文字 + hover时显示背景
- 用途：低优先级操作
- 示例：`<Button variant="ghost">详情</Button>`

#### 6. `outline` - 轮廓按钮
- 样式：透明背景 + 主题色边框和文字 + hover时反转
- 用途：需要突出但不是主要操作的按钮
- 示例：`<Button variant="outline">查看更多</Button>`

#### 7. `selected` - 选中状态按钮 ⭐ **新增**
- 样式：**红色背景 + 白色文字** (bg-red-500 text-white)
- 用途：切换按钮的选中状态
- 示例：动态切换 variant
```tsx
<Button variant={isSelected ? 'selected' : 'ghost'}>
  选项
</Button>
```

## 原生 button 元素的切换状态

### toggleButtonClass 工具函数

对于使用原生 `<button>` 元素实现的切换按钮，使用统一的工具函数：

```tsx
import { toggleButtonClass } from '@/shared/utils/url';

// 基础用法（使用默认样式）
<button 
  onClick={handleClick}
  className={toggleButtonClass(isSelected)}
>
  选项
</button>

// 自定义基础样式
<button 
  onClick={handleClick}
  className={toggleButtonClass(isSelected, 'px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
>
  小按钮
</button>
```

### 样式规范

**选中状态：红底白字**
- 背景：`bg-red-500`
- 文字：`text-white`
- 阴影：`shadow-sm`
- Hover：`hover:bg-red-600`

**未选中状态：灰色文字**
- 背景：透明
- 文字：`text-gray-500`
- Hover：`hover:bg-gray-50`

## 实际应用示例

### 1. 背景类型切换（BasicSettings.tsx）

```tsx
<button
  onClick={() => update(c => ({ ...c, backgroundImage: '' }))}
  className={toggleButtonClass(!isImageMode)}
>
  纯色背景
</button>
<button
  onClick={() => update(c => ({ ...c, backgroundImage: ' ' }))}
  className={toggleButtonClass(isImageMode)}
>
  图片背景
</button>
```

### 2. 导航栏模式切换

```tsx
<button
  onClick={() => update(c => ({ ...c, hero: { ...c.hero, overlayNavbar: true } }))}
  className={toggleButtonClass(config.hero.overlayNavbar !== false, 'px-3 py-1.5 text-xs font-medium rounded-md transition-all')}
>
  沉浸式
</button>
```

### 3. 使用 AdminButton 组件

```tsx
// 删除按钮
<Button variant="danger" onClick={handleDelete}>
  删除
</Button>

// 添加按钮
<Button variant="primary" onClick={handleAdd}>
  添加
</Button>

// 取消按钮
<Button variant="secondary" onClick={handleCancel}>
  取消
</Button>
```

## 注意事项

1. **统一性**：所有后台管理页面的切换按钮必须使用 `toggleButtonClass` 或 `variant="selected"`
2. **可见性**：选中状态必须是红底白字，确保在任何背景下都清晰可见
3. **一致性**：相同功能的按钮在不同页面应使用相同的 variant
4. **语义化**：按钮的 variant 应该反映其功能（primary/secondary/danger）

## 迁移指南

从旧样式迁移到新规范：

```tsx
// ❌ 旧写法（不推荐）
<button 
  className={`px-4 py-2 ${isSelected ? 'bg-blue-500 text-white' : 'text-gray-500'}`}
>
  选项
</button>

// ✅ 新写法（推荐）
<button className={toggleButtonClass(isSelected)}>
  选项
</button>

// 或使用 AdminButton 组件
<Button variant={isSelected ? 'selected' : 'ghost'}>
  选项
</Button>
```

## 更新日志

- 2024-12-05: 添加 `selected` variant 到 AdminButton
- 2024-12-05: 创建 `toggleButtonClass` 工具函数
- 2024-12-05: 统一所有后台管理页面的按钮样式为红底白字
