# 属性编辑功能 — 阶段 4 技术方案

> 日期：2026-05-28
> 状态：待审核
> 涉及阶段：阶段 4（画布交互接入）

---

## 一、阶段概述

阶段 4 把属性编辑的完整流程串起来：右键/长按组件 → 选中 + 翻转 → 编辑属性 → 退出。

| 改动 | 文件 | 内容 |
|------|------|------|
| 右键/长按触发 | CanvasLayer.tsx | onContextMenu + 长按 500ms |
| 选中联动 | CanvasLayer.tsx | 右键时 selectNode + openPropertyPanel |
| 全局退出 | App.tsx | click 画布空白 / ESC → closePropertyPanel + selectNode(null) |
| 清理测试代码 | App.tsx | 移除测试按钮、自动添加组件、window.toast |

---

## 二、改动详解

### 2.1 CanvasLayer.tsx

**新增 onContextMenu：**

```typescript
onContextMenu={(e) => {
  e.preventDefault()
  e.stopPropagation()
  selectNode(id)
  openPropertyPanel(id)
}}
```

**新增长按 500ms（移动端预留）：**

```typescript
const longPressTimer = useRef<ReturnType<typeof setTimeout>>(null)

onPointerDown={(e) => {
  if (e.button === 2) return  // 右键不处理
  longPressTimer.current = setTimeout(() => {
    selectNode(id)
    openPropertyPanel(id)
  }, 500)
}}
onPointerUp={() => clearTimeout(longPressTimer.current)}
onPointerLeave={() => clearTimeout(longPressTimer.current)}
```

**注意：** 长按和现有的左键拖拽需要共存。左键快速点击（<500ms）走拖拽，长按（>=500ms）走编辑。

**选中态样式（编辑模式）：**

当前已有 `isSelected` 样式（`1px solid #636366`），复用即可。
编辑模式下额外加轻微阴影：

```typescript
const isEditing = showPropertyPanel && selectedId === id

outline: isEditing
  ? '1px solid rgba(99,99,102,0.4)'
  : isSelected
    ? '1px solid #636366'
    : isHovered
      ? '1px solid rgba(99,99,102,0.25)'
      : 'none',
boxShadow: isEditing
  ? '0 0 0 4px rgba(99,99,102,0.08)'
  : isDropTarget
    ? '0 0 0 1px #636366, inset 0 0 20px rgba(99,99,102,0.06)'
    : 'none',
```

### 2.2 App.tsx

**全局退出逻辑：**

```typescript
useEffect(() => {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // 排除：点击在 Dock 上
    if (target.closest('[data-dock]')) return
    // 排除：点击在被编辑组件上
    if (target.closest('[data-component-id]')) return
    // 排除：点击在 Toast 上
    if (target.closest('#hermes-toast-container')) return

    // 退出编辑
    useUIStore.getState().closePropertyPanel()
    useCanvasStore.getState().selectNode(null)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      useUIStore.getState().closePropertyPanel()
      useCanvasStore.getState().selectNode(null)
    }
  }

  document.addEventListener('mousedown', handleClick)
  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('mousedown', handleClick)
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [])
```

**清理测试代码：**
- 移除测试按钮（top: 50 的那个 button）
- 移除自动添加组件的 useEffect
- 移除 window.toast 挂载
- 移除 testNodeId 相关代码

### 2.3 Dock.tsx

**添加 data-dock 属性**（供全局退出排除判断）：

```html
<div data-dock style={{ position: 'fixed', bottom: 12, ... }}>
```

同时移除 PanelErrorBoundary（调试完成）。

---

## 三、交互流程

```
用户右键画布组件
  → selectNode(id) + openPropertyPanel(id)
  → 组件显示选中态（灰色边框 + 轻微阴影）
  → Dock 翻转到属性面板
  → 用户编辑属性...

用户点击画布空白区域
  → closePropertyPanel() + selectNode(null)
  → 组件选中态消失
  → Dock 翻回组件列表

用户按 ESC
  → 同上

用户点击被编辑的组件
  → 不退出（排除逻辑）

用户点击 Dock
  → 不退出（排除逻辑）
```

---

## 四、可能的 Bug

| Bug | 原因 | 应对 |
|-----|------|------|
| 长按和拖拽冲突 | 长按 500ms 后触发编辑，但拖拽也在 pointerdown 启动 | 长按只在 >=500ms 时触发，快速点击走拖拽 |
| 右键菜单弹出 | 浏览器默认右键菜单 | 已有全局 contextmenu preventDefault |
| 退出后 Dock 翻转卡住 | closePropertyPanel 时 isFlipping 状态 | 已有 setTimeout 500ms 重置 |
| 点组件上的子元素没排除 | e.target 是子元素不是组件容器 | 用 closest('[data-component-id]') 判断 |

---

## 五、文件清单

| 文件 | 改动 |
|------|------|
| `src/components/Canvas/CanvasLayer.tsx` | 加 onContextMenu + 长按 + 编辑态样式 |
| `src/App.tsx` | 全局退出逻辑 + 清理测试代码 |
| `src/components/Dock/Dock.tsx` | 加 data-dock 属性，移除 ErrorBoundary |
