# 底部栏循环横向滚动 — 问题文档

> 日期：2026-05-28
> 目的：向其他 AI 寻求可行的技术方案
> 涉及文件：src/components/Dock/Dock.tsx

---

## 一、目标

底部栏（Dock）是一个固定在页面底部的组件选择栏，显示用户可拖拽到画布上的组件。

### 布局要求

```
当前固定显示 7 个组件，布局如下（所有空相等）：

|  空  | 组件 |  空  | 组件 |  空  | 组件 |  空  | 组件 |  空  | 组件 |  空  | 组件 |  空  | 组件 |  空  |
```

- 面板宽度固定 452px
- 组件图标 44×48px
- 所有间距相等（左边距 = 右边距 = 组件间距 = 18px）
- 当前布局已正确实现，间距全部一致

### 滚动要求

1. **循环**：滚到最后一个组件后继续滚，紧接着出现第一个组件，反之亦然。无空白区域，无限循环
2. **轮播图模式**：每次滚动一个组件+一个间距的距离（62px），像轮播图那样一格一格进
3. **滚轮驱动**：用鼠标滚轮控制，不是拖拽或点击箭头
4. **丝滑**：滚动动画要平滑（lerp 或 CSS transition），不能一跳一跳
5. **可控**：滚轮滚一下走一格，快速滚多下连续走多格，响应跟手
6. **视觉**：滚动时一个组件从一边滑入，另一个从另一边滑出

### 放大效果

底部栏有 macOS Dock 风格的放大效果：
- 鼠标 hover 的组件 scale(1.25)
- 相邻组件 scale(1.1)
- 其他 scale(1)
- 面板高度 64px，组件高度 48px，放大后 60px 不溢出

---

## 二、已尝试的方案和失败原因

### 方案 1：原生 scroll + scrollLeft += deltaY

```tsx
// overflow-x: auto 的容器
el.addEventListener('wheel', (e) => {
  e.preventDefault()
  el.scrollLeft += e.deltaY
})
```

**失败原因**：原生 scroll 范围有限，滚动到末尾出现空白区域，无法循环。

---

### 方案 2：原生 scroll + 三倍内容 + 边界跳转

```tsx
// items 渲染三份 [A|A|A]，初始 scroll 在中间那份
const tripledItems = [...allItems, ...allItems, ...allItems]
el.scrollLeft = oneSetWidth  // 中间那份起点

// 边界跳转
if (el.scrollLeft < threshold) el.scrollLeft += oneSetWidth
if (el.scrollLeft > maxThreshold) el.scrollLeft -= oneSetWidth
```

**失败原因**：
- 两个方向只有一个能循环（边界阈值计算错误，右边界超出实际 scroll 范围）
- `scrollBy({ behavior: 'smooth' })` 是异步动画，设置 `scrollLeft` 后动画还在继续跑，覆盖跳转位置
- 改成同步 `scrollLeft += deltaY` 后循环能工作，但：
  - 滚动太快（每 tick 固定跳一格）
  - 改成 `+= deltaY` 后速度正常但不对齐到步进边界
  - 加 lerp + round 后不跟手（lerp 0.2 太慢，round 每帧跳动导致视觉抖动）

---

### 方案 3：React 状态 + RAF 动画

```tsx
const [startIndex, setStartIndex] = useState(0)
const [offsetX, setOffsetX] = useState(0)

const animate = useCallback(() => {
  // lerp offset → setOffsetX
  // 到位 → setStartIndex(prev => prev + 1)
}, [totalCount])

useEffect(() => {
  el.addEventListener('wheel', handler)  // handler 调用 animate
}, [animate])
```

**失败原因**：闭包断裂。

```
1. animate 内调 setStartIndex → 触发 React 重渲染
2. animate 被 useCallback 重建（新引用）
3. RAF 循环里 requestAnimationFrame(animate) 引用的是旧函数
4. 旧函数的 ref/闭包是旧值 → 动画卡死
5. useEffect 依赖 [animate]，每次重建都重新注册 wheel 监听
```

---

### 方案 4：React 状态 + ref 桥接

```tsx
const animateRef = useRef<(() => void) | null>(null)

// wheel handler 通过 ref 调用，不依赖 useCallback
handler = () => { animateRef.current?.() }

// animate 更新到 ref
useEffect(() => {
  animateRef.current = () => { /* RAF 循环 */ }
}, [startIndex])
```

**理论上可行但未完整实现**。需要处理：
- startIndex 切换时 offset 归零 + items 重渲染的视觉连续性
- 多个 effect 之间的 RAF 生命周期管理
- 代码复杂度高，容易出错

---

### 方案 5：纯 DOM 驱动（RAF + 直接 DOM 操作）

```tsx
const startIndexRef = useRef(0)
const offsetRef = useRef(0)

function renderItems() {
  container.innerHTML = ''
  for (let i = -BUFFER; i < VISIBLE_COUNT + BUFFER; i++) {
    const idx = ((startIndexRef.current + i) % total + total) % total
    container.appendChild(createItemEl(allItems[idx]))
  }
}

function tick() {
  offsetRef.current = current + diff * 0.2
  container.style.transform = `translateX(${offsetRef.current}px)`
  // 到位 → startIndexRef.current += 1 → renderItems() → offset 归零
}
```

**失败原因**：
- 初始 offset 计算错误（左侧缓冲 item 在可视区内可见）
- 加了 BASE_OFFSET 后"效果太拉"（用户反馈）
- 纯 DOM 创建的 item 缺少 React 组件的交互能力（hover 放大效果等）
- 代码量大，维护困难

---

## 三、当前代码状态

### 底部栏（Dock.tsx）— 当前静态版本

```tsx
const ITEM_WIDTH = 44
const ITEM_HEIGHT = 48
const GAP = 18
const VISIBLE_COUNT = 7
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 452px

// 渲染
<div className="glass-panel-dark" style={{
  width: DOCK_WIDTH,
  height: 64,
  display: 'flex',
  alignItems: 'center',
  gap: GAP,
  paddingLeft: GAP,
  overflow: 'hidden',
}}>
  {visibleItems.map((item, index) => (
    <DockItem key={item.name} ... />
  ))}
</div>

// DockItem
<div style={{
  width: ITEM_WIDTH,
  height: ITEM_HEIGHT,
  transform: `scale(${scale})`,  // scale 由 hover 驱动
  transformOrigin: 'bottom center',
  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
}}>
  <span style={{ fontSize: 22 }}>{icon}</span>
  <span style={{ fontSize: 9 }}>{displayName}</span>
</div>
```

### 组件注册

```tsx
const categories = registry.getCategories()
const allItems = categories.flatMap(cat => registry.getByCategory(cat))
// 当前 14 个组件，只显示前 7 个
const visibleItems = allItems.slice(0, VISIBLE_COUNT)
```

### 3D 翻转（Dock 正面 → PropertyPanel 背面）

```tsx
<div style={{
  perspective: 1000,
  transformStyle: 'preserve-3d',
  transform: showPropertyPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
}}>
  {/* 正面：组件栏 */}
  {/* 背面：属性面板（position: absolute, rotateX(180deg)） */}
</div>
```

---

## 四、技术约束

1. **React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand**
2. **不用 @dnd-kit**：拖拽系统是自研 Pointer Events，DockItem 的 pointerdown 触发 `startDockDrag`
3. **面板层级**：z-index 9999，画布在下面
4. **放大效果必须保留**：macOS Dock 风格的 scale 放大，transformOrigin: bottom center
5. **3D 翻转必须保留**：选中组件时 Dock 翻转显示 PropertyPanel
6. **组件数据从 registry 读取**：`registry.getCategories()` + `registry.getByCategory(cat)`

---

## 五、需要的方案

请提供一个完整的、可直接实现的技术方案，要求：

1. 解决循环滚动问题（首尾无缝衔接）
2. 滚轮驱动，每次滚动一格（一个组件+一个间距 = 62px）
3. 动画平滑（lerp / CSS transition / 原生 smooth scroll 均可）
4. 快速滚轮能连续响应（多格连贯滚动）
5. 保持现有的放大效果和 3D 翻转
6. 代码简洁，避免闭包陷阱

如果方案涉及三倍内容循环，请给出正确的边界跳转逻辑和初始 scroll 位置计算。
如果方案涉及 React 状态驱动，请说明如何避免 useCallback 闭包断裂。
如果方案涉及纯 DOM 驱动，请说明如何保留 hover 放大等 React 交互能力。
