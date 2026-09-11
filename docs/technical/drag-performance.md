# 拖拽性能优化技术说明

> 日期：2026-05-25
> 适用场景：React 应用中基于 Pointer Events 的拖拽交互

---

## 问题概述

Page Builder 项目的画布组件拖拽功能出现明显卡顿。根因是 pointermove 事件处理函数未做帧率节流，每帧执行多次 layout-forcing 操作和 store 更新。

---

## 技术原理

### 1. pointermove 事件频率

浏览器中 `pointermove` 事件的触发频率取决于输入设备的轮询率：

| 设备 | 典型轮询率 |
|------|-----------|
| 普通鼠标 | 125Hz（每秒 125 次） |
| 游戏鼠标 | 1000Hz |
| 触控板 | 90-120Hz |
| 触摸屏 | 60-240Hz |

屏幕刷新率通常为 60Hz（每秒 60 帧）。当 pointermove 以 125Hz 触发但屏幕只刷新 60 次时，有超过一半的计算结果不会被显示——这些是纯浪费。

### 2. Layout Thrashing（布局抖动）

`Element.getBoundingClientRect()` 是一个 **layout-forcing** 操作。调用它时，浏览器必须同步执行以下步骤：

```
调用 getBoundingClientRect()
  → 检查是否有待处理的样式/布局变更
  → 如果有 → 强制同步重排（synchronous reflow）
  → 返回元素的几何信息
```

如果在一帧内多次调用 getBoundingClientRect，且中间有 DOM 写操作（如修改样式），每次调用都会触发一次完整的重排：

```
getBoundingClientRect()  → 强制重排（读取布局）
修改 DOM 样式            → 标记布局为脏（写入）
getBoundingClientRect()  → 再次强制重排（读取布局）  ← 布局抖动
修改 DOM 样式            → 再次标记为脏
getBoundingClientRect()  → 第三次强制重排           ← 布局抖动
```

这就是 **layout thrashing**——读写交替导致浏览器被迫反复计算布局。

### 3. React 异步渲染

Zustand 的 `set()` 调用不会立即更新 DOM。更新流程：

```
store.set({ key: value })
  → 通知所有订阅该 store 的 React 组件
  → React 调度重渲染（异步，不立即执行）
  → React 计算 Virtual DOM diff
  → React 批量更新真实 DOM
```

关键时序：`store.set()` 之后立即查询 DOM，读到的是**旧值**。这在缓存动态渲染元素的引用时会导致问题——元素在 store 更新时可能还不存在于 DOM 中。

### 4. requestAnimationFrame 节流

`requestAnimationFrame(callback)` 在浏览器下一次重绘前执行 callback，天然对齐屏幕刷新率（通常 60fps）。

标准节流模式：

```ts
let rafId = 0
let latestEvent: PointerEvent | null = null

function processFrame() {
  rafId = 0
  const e = latestEvent
  if (!e) return
  // 执行计算（每帧最多一次）
}

function handlePointerMove(e: PointerEvent) {
  latestEvent = e          // 始终记录最新事件
  if (rafId === 0) {       // 如果没有待执行的帧
    rafId = requestAnimationFrame(processFrame)  // 调度下一帧执行
  }
}
```

效果：
- 125Hz 鼠标 → 60fps 处理（计算量减少 52%）
- 1000Hz 鼠标 → 60fps 处理（计算量减少 94%）
- 每次计算的结果都会被渲染（无浪费）

---

## 问题代码分析

### 原始 handleMove（无节流）

```ts
const handleMove = (e: PointerEvent) => {
  // 读取 #1
  const canvasPos = toCanvas(e.clientX, e.clientY)  // → getBoundingClientRect()

  // 写入 #1
  state.updateDragPosition(previewX, previewY)       // → store.set() → 触发 React 重渲染

  // 读取 #2（无直接 layout forcing，但遍历数据结构）
  const hitId = hitTestContainer(...)

  // 写入 #2
  state.setTargetContainer(hitId)                    // → store.set()

  // 读取 #3
  const rect = scrollEl.getBoundingClientRect()      // → 强制重排

  // DOM 查询
  const trashZone = document.querySelector('[data-trash-zone]')  // → DOM 遍历

  // 读取 #4
  const trashRect = trashZone.getBoundingClientRect() // → 强制重排

  // 写入 #3
  state.setOverTrash(over)                            // → store.set()
}
```

每帧开销：3 次 getBoundingClientRect + 1 次 querySelector + 3 次 store 更新。
以 125Hz 鼠标计算：每秒 375 次强制重排 + 125 次 DOM 遍历 + 375 次 React 调度。

### 优化后 handleMove（RAF 节流）

```ts
let rafId = 0
let lastEvent: PointerEvent | null = null

function processFrame() {
  rafId = 0
  const e = lastEvent
  if (!e) return

  // 全部计算集中在一个帧回调内
  // 读取和写入仍然交替，但每帧只执行一次
  // ...
}

const handleMove = (e: PointerEvent) => {
  lastEvent = e
  if (rafId === 0) {
    rafId = requestAnimationFrame(processFrame)
  }
}
```

每帧开销：不变（仍是 3 次 getBoundingClientRect 等）。
但执行频率：从 125Hz 降到 60Hz。
每秒开销：180 次强制重排 + 60 次 DOM 遍历 + 180 次 React 调度。
**计算量减少 52%**。

---

## DOM 引用缓存的陷阱

### 问题

```ts
// 拖拽开始时缓存
const trashZone = document.querySelector('[data-trash-zone]')

function processFrame() {
  if (trashZone) { ... }  // trashZone 可能是 null
}
```

垃圾桶组件的渲染条件是 `isDragging && dragSource === 'canvas'`。当 `isDragging` 变为 true 时：

```
1. Zustand store 更新 isDragging = true
2. 触发 attachListeners()（在 useEffect 的 subscribe 回调中）
3. querySelector 执行 → 垃圾桶 DOM 还不存在（React 还没渲染）→ 返回 null
4. React 开始渲染 TrashZone 组件 → DOM 创建
5. processFrame 执行 → trashZone 是 null → 垃圾桶检测永远不执行
```

### 解决方案

**方案 A：每帧动态查询**（已采用）
```ts
function processFrame() {
  const trashZone = document.querySelector('[data-trash-zone]')  // 每帧查询
  if (trashZone) { ... }
}
```
在 RAF 节流下（60fps），querySelector 的开销可忽略。

**方案 B：MutationObserver 监听**（更优雅但更复杂）
```ts
const observer = new MutationObserver(() => {
  cachedTrashZone = document.querySelector('[data-trash-zone]')
})
observer.observe(document.body, { childList: true, subtree: true })
```

**方案 C：React ref 传递**（需要组件间通信）
```tsx
// App.tsx 中用 ref 引用 TrashZone
const trashRef = useRef<HTMLDivElement>(null)
<TrashZone ref={trashRef} />
// 将 trashRef 传递给 Canvas 组件
```

---

## 性能优化检查清单

针对 React 应用中的高频交互（拖拽、滚动、缩放）：

| 检查项 | 方法 |
|--------|------|
| 高频事件是否节流 | pointermove/mousemove/scroll 是否包裹在 RAF 中 |
| getBoundingClientRect 调用次数 | 单个事件处理器内不应超过 2 次 |
| querySelector 频率 | 不应在每帧执行，除非有 RAF 节流 |
| store 更新次数 | 单帧内多次 set() 应合并为一次 |
| React 状态更新 | 高频事件处理器内避免 setState，用 ref 代替 |
| DOM 引用缓存时机 | 条件渲染的元素不能在创建时缓存 |

---

## 扩展：画布边缘 resize 的技术细节

### 1. minHeight 与 flex stretch

当画布 div 放在 flex 容器内且只设了 `minHeight` 时，默认 `align-items: stretch` 会把它拉伸成容器内容区高度。这导致：
- 初始高度不是配置的 800px，而是视口决定的某个值（如 819px）
- 用户一打开页面就能滚动
- store 里的 `canvasHeight` 和实际渲染高度不一致

**解决**：`alignSelf: 'flex-start'` 阻止 stretch，高度回归 `minHeight`。

### 2. Store 高度与 DOM 高度不同步

画布用 `minHeight: canvasHeight`，当内容撑开时：
- DOM 实际高度 = max(内容高度, store.canvasHeight)
- store 里可能还是旧值（如 800）
- 用户在实际底部（如 1000px）按下拖拽，store 从 800 开始计算 → “自动多一段”

**解决**：`pointerdown` 时用 `getBoundingClientRect().height` 读取实际渲染高度，同步到 store。

### 3. RAF 循环内 scroll 与 resize 竞争

在同一个 RAF 循环里同时做：
- `setCanvasHeight(newH)` → 触发 React 异步渲染
- `canvas.getBoundingClientRect().bottom` → 读当前 DOM

时序问题：
```
RAF tick
  → setCanvasHeight(810)   // 通知 React 重渲染
  → getBoundingClientRect() // 读到的还是 800（React 没渲柕完）
  → scrollTop += 8         // 计算基于错误的位置
  → 下一帧 React 渲柕完成，高度变成 810
  → 下一帧 RAF 又读到 810，scroll 追赴
```

这种追赴导致明显抖动。

**解决**：不读 canvas rect，直接根据鼠标位置判断是否需要滚动。鼠标在视口下半部 → 向下滚动。简单稳定，不依赖 React 渲柕状态。

### 4. 非对称缩放参数设计

放大和缩小使用不同的距离-速度曲线：

| 方向 | 微调区 | 最大速度 | 曲线 | 理由 |
|------|--------|---------|------|------|
| 缩小 | 200px | 60px/frame | `(d/200)^4 * 60` | 需要克制，防止意外裁掉内容 |
| 放大 | 150px | 30px/frame | `(d/150)^4 * 30` | 需要直觉，但太快会失控 |

**设计原理**：
- 缩小是破坏性操作 → 更长的微调区，更慢的速度上限
- 放大是建设性操作 → 短一些的微调区，更低的速度上限
- 两个方向的手感差异符合心理预期

### 5. 缩小下限逻辑

画布高度不能缩到裁掉组件：
- 有组件时：最小高度 = 最底部组件的底边位置
- 无组件时：最小高度 = `config.designHeight`

```ts
let contentBottom = 0
state.nodes.forEach((node) => {
  if (!node.visible) return
  const absPos = state.getAbsolutePos(node.id)
  const bottom = absPos.y + node.height
  if (bottom > contentBottom) contentBottom = bottom
})

const minHeight = contentBottom > 0 ? contentBottom : state.config.designHeight
```

---

## 参考资料

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
- [Google Web Fundamentals: Rendering Performance](https://developers.google.com/web/fundamentals/performance/rendering)
- [React docs: Synchronous and Batched Updates](https://react.dev/reference/react-dom/client/createRoot#react-18-batching)
