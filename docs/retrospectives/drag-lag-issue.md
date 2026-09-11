# 拖拽卡顿问题复盘

> 日期：2026-05-25
> 涉及文件：src/components/Canvas/Canvas.tsx, src/components/Canvas/useCanvasResize.ts

---

## 概括

在给画布添加底部边缘拖拽调整高度功能后，组件拖拽变得明显卡顿。AI 先把原因归结到新加的 resize hook 的 onMouseMove 状态更新上，重写为纯 DOM 操作后问题依旧。随后才定位到真正的根因：组件拖拽的 handleMove 本身就没有 requestAnimationFrame 节流，每帧执行 3 次 getBoundingClientRect + 1 次 querySelector + 2 次 store 更新。加 RAF 节流后解决，但中途又因缓存垃圾桶引用的时机错误导致垃圾桶失效，最终改为每帧动态查询修复。

---

## 一、问题前相关代码

### 1. useCanvasResize hook（问题前，第一版）

```tsx
// useCanvasResize.ts — 第一版用 React state 驱动
const [nearEdge, setNearEdge] = useState(false)  // ← 问题1：每次 mousemove 触发 setState

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (isResizing) return
  const el = canvasRef.current
  if (!el) return
  const rect = el.getBoundingClientRect()        // ← 问题1：每帧强制布局计算
  const y = e.clientY - rect.top
  setNearEdge(y >= rect.height - 8 && y <= rect.height + 2)  // ← 问题1：触发 React 重渲染
}, [isResizing, canvasRef])
```

### 2. Canvas.tsx handleMove（问题前，一直存在的代码）

```tsx
// Canvas.tsx — attachListeners 内的 handleMove
const handleMove = (e: PointerEvent) => {         // ← 问题2：无 RAF 节流，每个 pointermove 都执行
  const state = useDragStore.getState()
  if (!state.isDragging) return

  const canvasPos = toCanvas(e.clientX, e.clientY)  // ← 问题2：getBoundingClientRect #1
  // ...
  state.updateDragPosition(previewX, previewY)       // ← 问题2：store 更新 #1 → React 重渲染

  // ...
  state.setTargetContainer(hitId)                    // ← 问题2：store 更新 #2

  const scrollEl = scrollRef.current
  if (scrollEl) {
    const rect = scrollEl.getBoundingClientRect()    // ← 问题2：getBoundingClientRect #2
    // ...
  }

  const trashZone = document.querySelector('[data-trash-zone]')  // ← 问题2：每帧遍历 DOM
  if (trashZone) {
    const trashRect = trashZone.getBoundingClientRect()  // ← 问题2：getBoundingClientRect #3
    // ...
  }
}
```

### 3. Canvas.tsx 边缘检测（第二版优化后引入的问题）

```tsx
// attachListeners 开头缓存了垃圾桶引用
const trashZone = document.querySelector('[data-trash-zone]')  // ← 问题3：此时垃圾桶可能还没渲染

function processFrame() {
  // ...
  if (trashZone) {  // ← 问题3：null，永远不执行
    // 垃圾桶检测逻辑
  }
}
```

---

## 二、问题与解决过程

### 问题 1：resize hook 的 mousemove 状态更新导致重渲染

**提问**：用户说"不知道为什么，我感觉组件拖拽好卡，是我电脑问题吗"

**AI 的回答**：新加的 useCanvasResize hook 的 onMouseMove 在每次鼠标移动时调 getBoundingClientRect() + setNearEdge 状态更新，导致不必要的重渲染。建议用 ref 代替 state，直接操作 DOM 改 cursor。

**修改前**（useCanvasResize.ts 第一版）：
```tsx
const [nearEdge, setNearEdge] = useState(false)

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const rect = el.getBoundingClientRect()
  setNearEdge(y >= rect.height - 8 && y <= rect.height + 2)
}, [...])

// 返回 React 事件处理器
return { onMouseMove: handleMouseMove, onMouseLeave: handlePointerDown, ... }
```

**修改后**（useCanvasResize.ts 第二版）：
```tsx
const nearEdgeRef = useRef(false)

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const rect = el.getBoundingClientRect()
  const near = y >= rect.height - 8 && y <= rect.height + 2
  if (near !== nearEdgeRef.current) {
    nearEdgeRef.current = near
    el.style.cursor = near ? 'row-resize' : ''  // 直接操作 DOM，不走 setState
  }
}, [...])
```

**结果**：❌ 失败。用户反馈"第一还是卡"。

**根因分析**：
resize hook 的优化方向是对的（避免不必要的重渲染），但它不是卡顿的主因。真正的瓶颈在组件拖拽本身的 handleMove 函数——它从来没有被 RAF 节流过。resize hook 的 mousemove 只是在画布上移动鼠标时触发（不拖拽组件时），而组件拖拽时的 pointermove 频率更高、计算更重。AI 在没有 profiling 数据的情况下，把症状（新加代码后变卡）等同于原因（新代码导致卡），方向判断错误。

---

### 问题 2：handleMove 无 RAF 节流

**提问**：用户反馈"第一还是卡"后，AI 主动检查了 handleMove 代码。

**AI 的回答**：handleMove 每个 pointermove 事件都执行全部计算，无 RAF 节流。每帧 3 次 getBoundingClientRect + 1 次 querySelector + 2 次 store 更新。CLAUDE.md 里写了"用 requestAnimationFrame 节流"但一直没实现。

**修改前**（Canvas.tsx handleMove）：
```tsx
const handleMove = (e: PointerEvent) => {
  const state = useDragStore.getState()
  const canvasPos = toCanvas(e.clientX, e.clientY)      // getBoundingClientRect
  state.updateDragPosition(previewX, previewY)           // store update
  state.setTargetContainer(hitId)                        // store update
  const rect = scrollEl.getBoundingClientRect()          // getBoundingClientRect
  const trashZone = document.querySelector(...)          // DOM traversal
  const trashRect = trashZone.getBoundingClientRect()    // getBoundingClientRect
  state.setOverTrash(over)                               // store update
}
window.addEventListener('pointermove', handleMove)
```

**修改后**（Canvas.tsx handleMove + RAF）：
```tsx
let rafId = 0
let lastEvent: PointerEvent | null = null

function processFrame() {
  rafId = 0
  const e = lastEvent
  if (!e) return
  // ... 全部计算逻辑移到这里，每帧只执行一次
  const trashZone = document.querySelector('[data-trash-zone]')  // 每帧查询
  // ...
}

const handleMove = (e: PointerEvent) => {
  lastEvent = e
  if (rafId === 0) {
    rafId = requestAnimationFrame(processFrame)  // 节流到每帧一次
  }
}
window.addEventListener('pointermove', handleMove)
```

**结果**：✅ 成功。拖拽流畅了。但引入了新问题（垃圾桶失效）。

**根因分析**：
pointermove 事件的触发频率取决于鼠标轮询率（通常 120Hz-1000Hz），远高于屏幕刷新率（60Hz）。不做节流时，120Hz 鼠标每秒执行 120 次完整计算，而屏幕每秒只刷新 60 次——有一半的计算结果根本不会被显示。getBoundingClientRect 是 layout-forcing 操作，会强制浏览器同步计算布局，多次调用导致 layout thrashing（布局抖动）。document.querySelector 每帧遍历 DOM 树，在频繁调用时开销不可忽略。RAF 节流将执行频率限制为屏幕刷新率（通常 60fps），计算量减半，且保证每次计算的结果都会被渲染。

---

### 问题 3：缓存垃圾桶引用时机错误

**提问**：用户说"垃圾桶放上去没反应了"

**AI 的回答**：在 attachListeners 开头用 querySelector 缓存了垃圾桶引用，但垃圾桶组件只在 isDragging && dragSource === 'canvas' 时才渲染。attachListeners 在 isDragging 变为 true 时调用，此时 React 可能还没完成渲染，querySelector 返回 null。

**修改前**（Canvas.tsx attachListeners）：
```tsx
function attachListeners() {
  const trashZone = document.querySelector('[data-trash-zone]')  // 此时垃圾桶还没渲染，返回 null

  function processFrame() {
    // ...
    if (trashZone) {  // 永远是 null，不执行
      const trashRect = trashZone.getBoundingClientRect()
      // ...
    }
  }
}
```

**修改后**（Canvas.tsx processFrame 内动态查询）：
```tsx
function attachListeners() {
  function processFrame() {
    // ...
    const trashZone = document.querySelector('[data-trash-zone]')  // 每帧查询，有 RAF 节流不会卡
    if (trashZone) {
      const trashRect = trashZone.getBoundingClientRect()
      // ...
    }
  }
}
```

**结果**：✅ 成功。垃圾桶恢复正常，拖拽依然流畅。

**根因分析**：
React 的渲染是异步的。当 Zustand store 的 isDragging 变为 true 时，订阅该状态的 TrashZone 组件会触发重渲染，但渲染不会立即完成——它会等到当前事件处理结束、浏览器空闲时才执行 DOM 更新。attachListeners 是在 store 更新的同一个事件循环中调用的，此时 TrashZone 的 DOM 还不存在，querySelector 返回 null。正确做法是每帧动态查询（在 RAF 节流下开销可忽略），或者用 MutationObserver 监听 DOM 变化。动态查询更简单，且 RAF 限制了频率到 60fps，性能影响微乎其微。

---

## 三、思维链总结

### 用户思路

| 阶段 | 用户在想什么 | 做了什么 | 效果 |
|------|-----------|---------|------|
| 发现问题 | 组件拖拽变卡了 | 告诉 AI "感觉组件拖拽好卡" | AI 开始排查 |
| 第一次反馈 | AI 改了 resize hook 还是卡 | 说"第一还是卡" | AI 转向检查拖拽代码 |
| 第二次反馈 | 改完拖拽后垃圾桶不工作了 | 说"垃圾桶放上去没反应了" | AI 修复缓存时机 |
| 要求总结 | 想记录这个问题 | 说"总结一下" | AI 没触发 skill |
| 纠正流程 | 复盘应该用 skill 框架 | 说"我不是有个skill吗，怎么没触发" | AI 加载 skill 重写 |

### AI 思路

| 阶段 | AI 在想什么 | 做了什么 | 效果 |
|------|-----------|---------|------|
| 收到反馈 | 新加的 resize hook 导致卡顿 | 重写 hook 为纯 DOM | 方向偏了，不是主因 |
| 继续排查 | 可能是拖拽代码本身的问题 | 检查 handleMove，发现无 RAF 节流 | 找到真正根因 |
| 修复 | 加 RAF + 缓存垃圾桶 | 缓存时机错误 | 垃圾桶失效 |
| 再修复 | 垃圾桶是动态渲染的 | 改回每帧查询 | 问题解决 |
| 总结 | 直接写简短总结 | 没加载 problem-retrospective skill | 用户纠正 |

### 思维链图示

```
用户：组件拖拽好卡
  │
  ├─ AI：resize hook 的 setState 导致重渲染 → 改为纯 DOM
  │     → 用户：还是卡                              ← 第一次转折：方向偏了
  │
  ├─ AI：检查 handleMove → 发现无 RAF 节流 → 加 RAF + 缓存 trashZone
  │     → 用户：垃圾桶没反应了                      ← 第二次转折：缓存时机错误
  │
  ├─ AI：trashZone 缓存太早，渲染还没完成 → 改回每帧查询
  │     → 用户：（问题解决）
  │
  └─ 用户：总结一下 → AI 直接写了简短总结
        → 用户：怎么没触发 skill                     ← 第三次转折：流程问题
        → AI：加载 skill 重写
```

**转折点分析**：
1. **方向偏了**：AI 没有 profiling 数据就判断原因，把"新加代码后变卡"等同于"新代码导致卡"。实际上 handleMove 一直有性能问题，只是之前不明显。
2. **缓存时机错误**：AI 为了优化性能缓存了 DOM 引用，但没考虑 React 渲染是异步的——store 更新后 DOM 不会立即变化。
3. **流程问题**：用户说"总结一下"时，AI 没有检查 skill 库，直接给了简短总结。skill 的触发词匹配了但没被加载。

---

## 四、改善建议

### 对 AI 的改善

1. **先看代码再下结论**。用户说"卡"的时候，应该先检查所有相关代码（包括已有的拖拽代码），而不是只看新加的代码。排查顺序：先读代码 → 定位瓶颈 → 再改。

2. **缓存 DOM 引用时必须考虑时机**。如果元素是动态渲染的（条件渲染、异步渲染），不能在创建时缓存。必须在每次使用时查询，或者用 MutationObserver 等机制确保元素存在后再缓存。

3. **用户说"总结"时检查 skill 库**。problem-retrospective 的触发词包含"总结一下"，应该在回复前扫描 skill 列表并加载匹配的 skill。

4. **性能优化的标准检查清单**：
   - pointermove/mousemove/scroll 等高频事件是否用了 RAF 节流
   - getBoundingClientRect 是否被多次调用（layout thrashing）
   - 是否有每帧执行的 DOM 查询（querySelector/getElementById）
   - 是否有每帧触发的 React 状态更新

### 对用户的改善

1. **反馈时尽量描述具体场景**。"组件拖拽好卡"可以更具体："从 Dock 拖组件到画布时卡"或"在画布内移动已有组件时卡"。不同场景的代码路径不同，具体描述能帮 AI 更快定位。

2. **第一次改完没效果时，直接要求看代码**。可以像垃圾桶问题那次一样说"给我看看拖拽相关的代码"，逼 AI 重新审视而不是继续猜。

### 可复用的排查清单：React 应用拖拽卡顿

```
1. 检查 pointermove/mousemove 是否有 RAF 节流
   - 没有 → 加 requestAnimationFrame
   - 有 → 检查 RAF 回调内的计算量

2. 检查 RAF 回调（或直接的事件处理器）内：
   - 有几次 getBoundingClientRect 调用？（>2 次 = 可能有 layout thrashing）
   - 有几次 querySelector 调用？（>0 次 = 考虑缓存或每帧查询但确保 RAF 节流）
   - 有几次 store 更新？（>1 次 = 考虑合并）

3. 检查是否有不必要的 React 重渲染：
   - 高频事件处理器内是否调用了 setState
   - 组件是否用了 React.memo 防止无关状态变化触发重渲染
   - store selector 是否精确（避免订阅整个 store）

4. 检查缓存的 DOM 引用是否有效：
   - 元素是否是条件渲染的？如果是，创建时可能不存在
   - 元素是否在异步操作后才出现？
```

### 是否生成 Skill

不建议生成独立 skill。这个问题的本质是"React 高频事件性能优化"，属于通用前端知识。建议在 `systematic-debugging` skill 中追加"React 拖拽卡顿排查清单"章节，或者在 `canvas-editor` skill 的 pitfall 中补充 RAF 节流的必要性。

---

## 五、解决后最终代码

### useCanvasResize.ts（最终版）

```tsx
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../../store'

const EDGE_THRESHOLD = 8
const AUTO_SCROLL_ZONE = 40
const AUTO_SCROLL_SPEED = 8
const MIN_HEIGHT = 200

export function useCanvasResize(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  scrollRef: React.RefObject<HTMLDivElement | null>,
) {
  const isResizing = useRef(false)
  const dragStart = useRef({ y: 0, h: 0 })
  const lastY = useRef(0)
  const rafId = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Pure DOM — no React state, no re-renders
    function onMouseMove(e: MouseEvent) {
      if (isResizing.current) return
      const rect = canvas!.getBoundingClientRect()
      const y = e.clientY - rect.top
      const near = y >= rect.height - EDGE_THRESHOLD && y <= rect.height + 2
      canvas!.style.cursor = near ? 'row-resize' : ''  // 直接 DOM 操作
    }

    function onMouseLeave() {
      if (!isResizing.current) canvas!.style.cursor = ''
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const rect = canvas!.getBoundingClientRect()
      const y = e.clientY - rect.top
      if (y < rect.height - EDGE_THRESHOLD) return

      e.preventDefault()
      e.stopPropagation()

      canvas!.setPointerCapture(e.pointerId)
      isResizing.current = true
      dragStart.current = { y: e.clientY, h: useCanvasStore.getState().canvasHeight }
      lastY.current = e.clientY
      canvas!.style.cursor = 'row-resize'

      function tick() {
        const scrollEl = scrollRef.current
        if (scrollEl) {
          const dist = window.innerHeight - lastY.current
          if (dist < AUTO_SCROLL_ZONE && dist > 0) {
            scrollEl.scrollTop += AUTO_SCROLL_SPEED * (1 - dist / AUTO_SCROLL_ZONE)
          }
        }
        rafId.current = requestAnimationFrame(tick)
      }
      rafId.current = requestAnimationFrame(tick)

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    }

    function onPointerMove(e: PointerEvent) {
      lastY.current = e.clientY
      const dy = e.clientY - dragStart.current.y
      const newH = Math.max(MIN_HEIGHT, dragStart.current.h + dy)
      useCanvasStore.getState().setCanvasHeight(newH)
    }

    function onPointerUp() {
      isResizing.current = false
      cancelAnimationFrame(rafId.current)
      canvas!.style.cursor = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('pointerdown', onPointerDown)

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [canvasRef, scrollRef])
}
```

### Canvas.tsx handleMove（最终版）

```tsx
function attachListeners() {
  if (attached) return
  attached = true

  let rafId = 0
  let lastEvent: PointerEvent | null = null

  function processFrame() {
    rafId = 0
    const e = lastEvent
    if (!e) return

    const state = useDragStore.getState()
    if (!state.isDragging) return

    const canvasPos = toCanvas(e.clientX, e.clientY)
    const previewX = canvasPos.x - state.offsetX
    const previewY = canvasPos.y - state.offsetY

    state.updateDragPosition(previewX, previewY)

    const excludeId = state.source === 'canvas' ? state.sourceNodeId! : undefined
    const currentRoot = useCanvasStore.getState().rootChildren
    const hitId = hitTestContainer(
      canvasPos.x, canvasPos.y,
      useCanvasStore.getState().nodes,
      state.source === 'canvas' ? currentRoot.filter(id => id !== excludeId) : currentRoot,
    )
    state.setTargetContainer(hitId)

    const scrollEl = scrollRef.current
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect()
      const autoScroll = calculateAutoScroll(e.clientX, e.clientY, rect)
      if (autoScroll.active) {
        scrollEl.scrollLeft += autoScroll.speedX
        scrollEl.scrollTop += autoScroll.speedY
      }
    }

    // 每帧动态查询（有 RAF 节流，60fps，开销可忽略）
    const trashZone = document.querySelector('[data-trash-zone]')
    if (trashZone) {
      const trashRect = trashZone.getBoundingClientRect()
      const over =
        e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
        e.clientY >= trashRect.top && e.clientY <= trashRect.bottom
      state.setOverTrash(over)
    }
  }

  const handleMove = (e: PointerEvent) => {
    lastEvent = e
    if (rafId === 0) {
      rafId = requestAnimationFrame(processFrame)
    }
  }

  window.addEventListener('pointermove', handleMove)
  // ...
}
```

---

## 六、后续迭代（同日）

在解决拖拽卡顿后，继续完善了画布底部边缘拖拽 resize 的交互。过程中又遇到并解决了多个问题。

### 问题 4：画布初始高度被 flex stretch

**现象**：一打开网页什么都没干就能上下滚动，画布高度显示 819px 而不是配置的 800px。

**根因**：`Canvas.tsx` 的滚动容器是 flex 布局，默认 `align-items: stretch`。画布 div 只设了 `minHeight: 800`，没有设 `height`，被 flex 拉伸成了容器内容区高度（视口 - paddingTop 60 - paddingBottom 80 = 819px）。

**修复**：给画布 div 加 `alignSelf: 'flex-start'`，阻止 flex stretch。

```tsx
<div
  style={{
    minHeight: canvasHeight,
    alignSelf: 'flex-start',  // ← 阻止 flex stretch
  }}
/>
```

### 问题 5：边缘拖拽时"自动多一段"

**现象**：按住画布底部边缘拖拽，稍微动一下鼠标，画布就自动多变化一段，不是从当前高度开始变化。

**根因**：画布样式用 `minHeight: canvasHeight`，当画布上有组件时，组件会撑开画布，实际渲染高度远大于 store 里的 `canvasHeight` 值。但 RAF 循环里以 store 值为基准计算，导致"从错误的起点开始"。

**修复**：`pointerdown` 时先用 `getBoundingClientRect().height` 读取实际渲染高度，同步到 store。

```tsx
function onPointerDown(e: PointerEvent) {
  // ...
  const actualHeight = canvas!.getBoundingClientRect().height
  useCanvasStore.getState().setCanvasHeight(actualHeight)
  // ...
}
```

### 问题 6：放大时滚动抖动

**现象**：画布向下延展时，页面自动滚动伴随明显抖动。

**根因**：RAF 循环里同时做两件事——`setCanvasHeight`（触发 React 异步渲染）和 `getBoundingClientRect()`（读当前 DOM），两者不同步。scroll 追不准 canvas bottom 就来回震荡。

**修复**：不用 `getBoundingClientRect` 判断，直接看鼠标位置。鼠标在视口下半部（> 60% 高度）就向下滚动，简单稳定。

```tsx
// 之前（抖）
const canvasBottom = canvas!.getBoundingClientRect().bottom
const gap = window.innerHeight - canvasBottom
if (gap < 100) scrollEl.scrollTop += 8

// 之后（稳）
if (lastY > window.innerHeight * 0.6) {
  scrollEl.scrollTop += 6
}
```

### 问题 7：缩小太敏感，放大不跟手

**现象**：
- 缩小：鼠标稍微往上拖，画布就快速缩小，没有微调空间
- 放大：画布底部跟着鼠标走，但拖远了感觉"控不住"

**解决方案**：两个方向用完全不同的交互模式。

**缩小**（距离驱动速度，自动缩小）：
- 鼠标往上拖 → 画布**自动**以速度缩小
- 距离决定速度，不是位置决定尺寸
- 200px 微调区（前 200px 极慢），4 次方曲线，最大速度 60px/frame
- 下限：有组件时缩到最底部组件底边，无组件时缩到 designHeight

```ts
const speed = Math.pow(distance / 200, 4) * 60
const newH = Math.max(minHeight, currentHeight - speed)
```

**放大**（距离驱动速度，自动增长）：
- 鼠标往下拖 → 画布**自动**以速度增长
- 150px 微调区，4 次方曲线，最大速度 30px/frame（比缩小慢一半，更可控）
- 鼠标在视口下半部时自动向下滚动，保持画布可见

```ts
const speed = Math.pow(distance / 150, 4) * 30
const newH = currentHeight + speed
```

**为什么不对称**：
- 缩小需要克制——用户不想意外裁掉内容，所以微调区长、速度曲线更缓
- 放大需要直觉——用户想看画布长到哪里，但速度太快会失控，所以最大速度减半
- 两个方向不同手感符合心理预期：扩张直接，收缩谨慎

### 问题 8：交互指示器

**需求**：拖拽调整画布高度时，需要一个实时显示当前尺寸的 HUD。

**实现**：
- 位置：固定顶部居中（和垃圾桶同一位置）
- 样式：深色胶囊（`rgba(0,0,0,0.75)`），白色等宽字体
- 动画：复用垃圾桶的 `trash-slide-in` keyframe
- 内容：网页最终尺寸 `designWidth × canvasHeight`（不是渲染尺寸）
- 生命周期：`pointerdown` 创建，`pointermove` 更新文本，`pointerup` 移除
- 纯 DOM 操作（`document.createElement` / `el.remove()`），不走 React state

### 问题 9：选中边框颜色

**需求**：蓝色（`#007AFF`）太扎眼，不符合 Apple 极简风格。

**修改**：全部换成 `#636366`（Apple system gray 4）。

| 场景 | 之前 | 之后 |
|------|------|------|
| 选中边框 | `1px solid #007AFF` | `1px solid #636366` |
| hover 边框 | `rgba(0,122,255,0.3)` | `rgba(99,99,102,0.25)` |
| 拖拽预览 | `rgba(0,122,255,0.6)` 虚线 | `rgba(99,99,102,0.5)` 虚线 |
| 容器高亮 | `#007AFF` + 蓝色内阴影 | `#636366` + 灰色内阴影 |
| CSS 变量 | `--selection-color: #007AFF` | `--selection-color: #636366` |
