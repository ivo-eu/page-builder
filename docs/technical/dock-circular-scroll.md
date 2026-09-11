# 底部栏循环滚动 — 技术方案文档

> 日期：2026-05-28
> 涉及文件：src/components/Dock/Dock.tsx
> 状态：已解决（Gemini Pro 方案）

---

## 一、问题描述

底部栏（Dock）需要支持循环滚动：14 个组件，一次显示 7 个，滚到最后一个后再滚自动接上第一个，无空白区域。

### 布局要求

```
间距固定：空 | 组件 | 空 | 组件 | ... | 组件 | 空
所有空相等（左右边距 = 组件间距 = 18px）
面板宽度固定 452px
每次滚动步进 = 一个组件+一个间距 = 62px
```

### 循环要求

```
正向：最后一个组件之后紧接着第一个组件
反向：第一个组件之前紧接着最后一个组件
无空白区域，无限循环
```

---

## 二、失败的方案（3 个）

### 方案 A：原生 scroll + 边界跳转

**原理**：三倍内容 [A|A|A]，初始 scroll 在中间，边界时静默跳回。

**代码**：
```tsx
const tripledItems = [...allItems, ...allItems, ...allItems]
el.scrollLeft = oneSetWidth  // 中间那份

// 边界跳转
if (el.scrollLeft < threshold) el.scrollLeft += oneSetWidth
if (el.scrollLeft > maxThreshold) el.scrollLeft -= oneSetWidth
```

**为什么失败**：
1. 边界阈值难以精确计算。右边界 `oneSetWidth * 2.5 = 1980` 超出实际最大 scrollLeft（1920），永远触发不了 → 只有一个方向能循环
2. `scrollBy({ behavior: 'smooth' })` 是异步动画，设置 `scrollLeft` 后动画还在继续跑 → 覆盖跳转位置，循环不稳定
3. 改成同步 `scrollLeft += deltaY` 后循环能工作，但：
   - 每 tick 固定跳一格太快
   - 改成 `+= deltaY` 后速度正常但不对齐到步进边界
   - 加 lerp + round 后不跟手（lerp 太慢，round 每帧跳动导致视觉抖动）

**核心矛盾**：if/else 边界跳转和 smooth 动画天然冲突——跳转需要瞬间完成，smooth 需要渐变过渡。

---

### 方案 B：纯 DOM 驱动

**原理**：所有状态存 ref，RAF 循环直接操作 DOM，不触发 React 重渲染。手动创建 item DOM 元素。

**代码**：
```tsx
function createItemEl(item) {
  const cell = document.createElement('div')
  // ... 手动创建 icon、label、pointerdown 事件
  inner.addEventListener('pointerdown', (e) => { ... })
}

function renderItems() {
  container.innerHTML = ''
  for (let i = -BUFFER; i < VISIBLE_COUNT + BUFFER; i++) {
    container.appendChild(createItemEl(allItems[idx]))
  }
}
```

**为什么失败**：
1. `innerHTML = ''` 清理重建破坏了 React Fiber 树 → 丢失所有 React 交互能力（hover 放大、3D 翻转、合成事件）
2. 手动创建的 DOM 缺少 React 的事件委托机制 → pointerdown 事件需要手动绑定，hover 效果需要手动实现
3. 初始 offset 计算错误（左侧缓冲 item 在可视区内可见）
4. 代码量大，维护困难

**核心矛盾**：纯 DOM 操作和 React 组件生态不兼容——React 组件的状态、事件、生命周期全部依赖 Fiber 树，innerHTML 重建直接破坏这棵树。

---

### 方案 C：React 状态 + ref 桥接

**原理**：用 ref 桥接 wheel handler 和 animate 函数，避免 useCallback 闭包断裂。offset 用 ref 驱动动画，startIndex 用 state 驱动重渲染。

**代码**：
```tsx
const animateRef = useRef(null)

// wheel handler 通过 ref 调用，不依赖 useCallback
handler = () => { animateRef.current?.() }

// animate 更新到 ref
useEffect(() => {
  animateRef.current = () => {
    // RAF 循环：offsetRef lerp → setOffsetX
    // 到位 → setStartIndex(prev => prev + 1)
  }
}, [startIndex])
```

**为什么失败**：
1. `setStartIndex` 触发 React 重渲染 → `animate` 重建（新引用）→ 但 RAF 循环里 `requestAnimationFrame(animate)` 引用的是旧函数 → 旧函数的闭包是旧值 → 动画卡死
2. `useEffect` 依赖 `[startIndex]`，每次 startIndex 变化都重新注册整个 effect → 清理旧 RAF → 启动新 RAF → 动画中断再重启，有视觉跳动
3. 每次 startIndex 变化触发 React 重渲染（setState + setOffsetX），在高频滚动时有性能开销

**核心矛盾**：setState 触发的重渲染会重建 useEffect 内的函数，但 RAF 循环持有的是旧引用。即使用 animateRef 桥接，useEffect 的 cleanup + 重建仍然会导致动画中断。

---

## 三、成功方案（Gemini Pro）

### 来源

用户将问题文档发给 Gemini Pro（网页端），Gemini 分析了三种失败方案的根因后给出了以下方案。

### Gemini 的诊断

Gemini 指出之前方案失败的根本原因：

> **方案 B（纯 DOM 驱动）的方向是最接近完美的**，但失败的根本原因在于使用了 `innerHTML` 重建 DOM，这直接破坏了 React 的 Fiber 树，导致组件丢失了状态、事件和交互能力。

> 方案 A 的 `if (offset > max) snap()` 边界跳转逻辑有两个致命问题：边界阈值难以精确计算；`scrollBy({ behavior: 'smooth' })` 是异步动画，会覆盖手动设置的位置。

> 方案 C 的 `setStartIndex` → React 重渲染 → `useCallback` 重建 → RAF 循环引用旧函数 → 闭包断裂。

### 核心思路

> **用 React 渲染完整的 DOM 节点以保留所有交互能力，但完全剥离 React 的 State 来处理滚动逻辑，转而使用 `useRef` + `requestAnimationFrame` 直接控制外层容器的位移。**

关键创新：**用取模公式替代 if/else 边界跳转**。

### 取模公式

```tsx
const W = totalCount * STEP  // 单组宽度

const boundedX = ((currentX.current % W) + W) % W
track.style.transform = `translateX(${-W - boundedX}px)`
```

**为什么这能解决问题**：

1. **不需要边界跳转**：不管 currentX 累加到多大或多小，`((currentX % W) + W) % W` 每帧将其映射回 [0, W)。没有 if/else，没有跳转时机问题。
2. **没有异步冲突**：位移在每帧的 RAF 里同步完成，不存在 smooth 动画覆盖的问题。
3. **没有闭包断裂**：所有状态在 ref 里，不触发 React 重渲染，useEffect 只运行一次。
4. **保留 React 交互**：所有 DockItem 是普通 React 组件，hover 放大、pointerdown 拖拽、3D 翻转全部正常工作。

### 完整实现代码

```tsx
const ITEM_WIDTH = 44
const ITEM_HEIGHT = 48
const GAP = 18
const STEP = ITEM_WIDTH + GAP  // 62px
const VISIBLE_COUNT = 7
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 452px

const tripledItems = [...allItems, ...allItems, ...allItems]
const W = totalCount * STEP

const trackRef = useRef(null)
const dockRef = useRef(null)
const targetX = useRef(0)
const currentX = useRef(0)
const rafId = useRef(0)
const mouseLocalX = useRef(-1)

useEffect(() => {
  const track = trackRef.current
  const dockEl = dockRef.current
  if (!track || !dockEl) return

  let accumulator = 0
  const THRESHOLD = 80  // 触摸板累积阈值

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    accumulator += e.deltaY
    while (accumulator >= THRESHOLD) {
      accumulator -= THRESHOLD
      targetX.current += STEP
    }
    while (accumulator <= -THRESHOLD) {
      accumulator += THRESHOLD
      targetX.current -= STEP
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    const rect = dockEl.getBoundingClientRect()
    mouseLocalX.current = e.clientX - rect.left
  }

  function loop() {
    currentX.current += (targetX.current - currentX.current) * 0.08

    if (Math.abs(targetX.current - currentX.current) < 0.1) {
      currentX.current = targetX.current
    }

    const boundedX = ((currentX.current % W) + W) % W
    if (track) track.style.transform = `translateX(${-W - boundedX}px)`

    // 实时计算 hover
    const mx = mouseLocalX.current
    if (mx >= 0) {
      const trackX = mx + W + boundedX - GAP
      const idx = Math.floor(trackX / STEP)
      const realIdx = ((idx % totalCount) + totalCount) % totalCount
      setHoveredIndex(prev => prev === realIdx ? prev : realIdx)
    }

    rafId.current = requestAnimationFrame(loop)
  }

  dockEl.addEventListener('wheel', handleWheel, { passive: false })
  dockEl.addEventListener('mousemove', handleMouseMove)
  dockEl.addEventListener('mouseleave', () => {
    mouseLocalX.current = -1
    setHoveredIndex(null)
  })
  rafId.current = requestAnimationFrame(loop)

  return () => {
    dockEl.removeEventListener('wheel', handleWheel)
    dockEl.removeEventListener('mousemove', handleMouseMove)
    cancelAnimationFrame(rafId.current)
  }
}, [W, totalCount])
```

---

## 四、方案对比

| 维度 | A：原生 scroll + 边界跳转 | B：纯 DOM 驱动 | C：React 状态 + ref 桥接 | D：Gemini（三倍内容 + 取模） |
|------|------------------------|---------------|------------------------|---------------------------|
| **循环方式** | if/else 边界跳转 | startIndex modulo | startIndex state + modulo | 取模公式映射 |
| **为什么失败** | 边界阈值错误 + smooth 异步冲突 | innerHTML 破坏 React Fiber | setState 闭包断裂 | — |
| **动画驱动** | 原生 scroll / RAF lerp | RAF + DOM transform | RAF + setState | RAF + ref + DOM transform |
| **React 重渲染** | 无 | 无 | 每步进一次 | 无（仅 hoveredIndex） |
| **闭包风险** | 无 | 无 | 有（animateRef 桥接不完全） | 无（全 ref） |
| **交互保留** | 天然支持 | ❌ 丢失 | 天然支持 | 天然支持 |
| **触摸板兼容** | 差 | 需手动处理 | 需手动处理 | ✅ 累积阈值 |
| **hover 跟随** | 原生事件 | 需手动实现 | 原生事件 | ✅ RAF 里计算鼠标位置 |
| **代码量** | 少 | 多 | 多 | 中等 |
| **最终采用** | ❌ | ❌ | ❌ | ✅ |

---

## 五、关键教训

1. **取模 > 边界跳转**：`((x % W) + W) % W` 是前端循环滚动的标准做法，比 if/else 边界判断可靠得多
2. **ref + RAF > React 状态**：高频动画不应该走 setState，会触发重渲染和闭包问题
3. **React 渲染 DOM + ref 驱动位移**：两者结合——React 负责创建有交互能力的 DOM，ref + RAF 负责高频位移更新
4. **不要用 scrollBy smooth**：异步动画和手动 scrollLeft 设置天然冲突
5. **触摸板需要累积阈值**：一次轻滑触发几十个 wheel 事件，每个事件的 deltaY 很小，需要累积到阈值才触发一步
