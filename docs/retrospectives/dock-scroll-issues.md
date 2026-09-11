# 底部栏循环滚动问题复盘

> 日期：2026-05-28
> 涉及文件：src/components/Dock/Dock.tsx, src/components/Canvas/useCanvasResize.ts, docs/technical/dock-circular-scroll.md, docs/technical/dock-scroll-problem.md

---

## 概括

底部栏（Dock）需要支持循环横向滚动。从添加组件测试滚动开始，经历了约 25 次问答、5 种不同方案，全部失败。最终将问题文档发给 Gemini Pro（网页端），获得了"三倍内容 + 取模公式 + ref 驱动 RAF"的方案并成功实现。核心教训：复杂交互问题应该先写清楚技术约束再找方案，而不是边写边试。

---

## 一、问题前相关代码

### 1. 初始 Dock（问题前，只有 7 个静态组件）

```tsx
// Dock.tsx — 最初版本
const allItems = registry.getAll()  // 7 个组件
<div style={{
  position: 'fixed', bottom: 12, left: 0, right: 0,
  display: 'flex', justifyContent: 'center',
}}>
  <div className="glass-panel-dark" style={{
    display: 'flex', gap: 2, padding: '0 20px',
    overflowX: 'auto',  // ← 问题：原生 scroll，超出就有滚动条
  }}>
    {allItems.map(item => <DockItem ... />)}
  </div>
</div>
```

### 2. 滚动方案（问题前，有简单的 wheel 横滚）

```tsx
// 之前的 wheel 处理
const handler = (e: WheelEvent) => {
  e.preventDefault()
  el.scrollLeft += e.deltaY  // ← 问题：原生 scroll 范围有限，末尾空白
}
```

### 3. 用户的需求描述

```
"底部栏内组件数量固定，gap 固定，滚动像轮播图那样一格一格进，
 滚轮驱动，丝滑可控，循环无缝衔接，无空白区域"
```

---

## 二、问题与解决过程

### 问题 1：添加组件测试滚动 — Link 拖拽异常

**提问**：用户说"先验证现有代码的功能行不行吧，先多加一些常用的原生组件，我看下横向移动生不生效"

**AI 的回答**：创建了 4 个新组件（Heading、Divider、Card、Link），注册到 register.ts，构建成功。

**修改前**：7 个组件（Button、Text、Input、Image、Container、Modal、Table）

**修改后**：
```tsx
// register.ts 新增
registry.register(HeadingManifest)   // 🔤 标题 300×50
registry.register(DividerManifest)   // ➖ 分割线 400×20
registry.register(CardManifest)      // 🃏 卡片 280×140
registry.register(LinkManifest)      // 🔗 链接 120×30
```

**结果**：✅ 构建成功，11 个组件。

---

### 问题 2：Link 组件拖拽异常

**提问**：用户说"链接在画板上的拖拽有点问题。为什么会拖拽的时候拖的是链接而不是正常的虚线框，你懂我意思吗"

**AI 的回答**：`<a>` 标签有浏览器原生拖拽行为，会和自研 Pointer Events 拖拽冲突。改成 `<span>`。同时给 Image 的 `<img>` 加 `draggable={false}`。

**修改前**：
```tsx
// Link/index.tsx
<a style={{ color: '#4f8cff', textDecoration: 'underline' }}
   href={href} {...rest}>
  {children}
</a>

// Image/index.tsx
<img src={src} alt={alt} style={{ objectFit: 'cover' }} {...rest} />
```

**修改后**：
```tsx
// Link/index.tsx
<span style={{ color: '#4f8cff', textDecoration: 'underline',
              cursor: 'default' }} {...rest}>
  {children}
</span>

// Image/index.tsx
<img src={src} alt={alt} draggable={false}
     style={{ objectFit: 'cover' }} {...rest} />
```

**结果**：✅ 构建成功，链接和图片拖拽正常。

**根因分析**：`<a>` 和 `<img>` 标签有浏览器原生的 drag 行为，会拦截 pointerdown 事件，导致自研的 Pointer Events 拖拽系统无法正常工作。改成无原生拖拽行为的元素（`<span>`）或加 `draggable={false}` 即可。

---

### 问题 3：底部栏被撑大，不滚动

**提问**：用户说"底部栏被撑大了完全没实现左右移动功能，宽度就固定成现在这样，再多几个组件看看移动功能"

**AI 的回答**：给 dock 面板加 `maxWidth` 限制宽度，再加 3 个组件（Paragraph、Switch、Avatar）测试。

**修改前**：
```tsx
<div style={{
  display: 'flex', gap: 2, padding: '0 20px',
  overflowX: 'auto',
}}>
```

**修改后**：
```tsx
const DOCK_MAX_WIDTH = 640
<div style={{
  display: 'flex', gap: 2, padding: '0 20px',
  maxWidth: DOCK_MAX_WIDTH,
  overflowX: 'auto', overflowY: 'hidden',
}}>
```

新增 3 个组件：
```tsx
registry.register(ParagraphManifest)  // 📄 段落 400×80
registry.register(SwitchManifest)     // 🔀 开关 60×30
registry.register(AvatarManifest)     // 👤 头像 50×50
```

**结果**：✅ 构建成功，14 个组件，能横向滚动了。但末尾有空白，不能循环。

**根因分析**：flex 容器没有固定宽度，被内容撑开。加 maxWidth 后 overflow 生效，但原生 scroll 的范围有限，滚到末尾就是空白。

---

### 问题 4：画布 resize 缩小到小于原尺寸

**提问**：用户说"画板的伸缩有点问题，现在为什么会缩小到小于画布原尺寸的高度，最小应该是画布原尺寸"

**AI 的回答**：useCanvasResize.ts 中缩小的下限逻辑有误。有组件时最小高度 = 最底部组件底边，无组件时 = designHeight。应该始终以 designHeight 为最小值。

**修改前**：
```tsx
// useCanvasResize.ts
const minHeight = contentBottom > 0
  ? contentBottom
  : state.config.designHeight
```

**修改后**：
```tsx
const minHeight = Math.max(state.config.designHeight, contentBottom)
```

**结果**：✅ 画布缩小下限始终是 800px（designHeight）。

**根因分析**：原逻辑在有组件时以组件底边为最小值，如果组件位置低于 designHeight 则允许缩小到 designHeight 以下。用户期望无论有没有组件，画布都不能小于原始设计高度。

---

### 问题 5：滚动不丝滑

**提问**：用户说"底部栏左右移动很不丝滑，能修改吗"

**AI 的回答**：把 `scrollLeft += deltaY` 改成 RAF + lerp 平滑滚动。

**修改前**：
```tsx
const handler = (e: WheelEvent) => {
  e.preventDefault()
  el.scrollLeft += e.deltaY  // 直接跳
}
```

**修改后**：
```tsx
let targetX = el.scrollLeft
let rafId = 0
function tick() {
  const current = el!.scrollLeft
  const diff = targetX - current
  if (Math.abs(diff) < 0.5) { el!.scrollLeft = targetX; rafId = 0; return }
  el!.scrollLeft = current + diff * 0.15
  rafId = requestAnimationFrame(tick)
}
const handler = (e: WheelEvent) => {
  e.preventDefault()
  const maxScroll = el!.scrollWidth - el!.clientWidth
  targetX = Math.max(0, Math.min(maxScroll, targetX + e.deltaY))
  if (rafId === 0) rafId = requestAnimationFrame(tick)
}
```

**结果**：✅ 滚动平滑了。

**根因分析**：`scrollLeft += deltaY` 每帧跳一个 delta 值，没有过渡。RAF + lerp 让每帧只移动差距的一小部分（15%），产生减速效果。

---

### 问题 6：速度和等间距布局

**提问**：用户说"第一，速度可以快一点。第二，我希望底部栏内的组件数是固定的，组件之间和底部栏左右内边距都相等。就是正常是空｜组件｜空｜组件｜空｜组件｜空"

**AI 的回答**：lerp 改为 0.25，重新设计布局用 cell 包裹（VISIBLE_COUNT=8, GAP=8, DOCK_WIDTH=456）。

**修改前**：lerp 0.15，无固定布局

**修改后**：
```tsx
const VISIBLE_COUNT = 8
const GAP = 8
const DOCK_WIDTH = VISIBLE_COUNT * ITEM_WIDTH + (VISIBLE_COUNT + 1) * GAP  // 456px
// lerp 0.15 → 0.25
```

**结果**：❌ 间距不一致。cell 内 item 居中导致首尾和中间间距不同。

**根因分析**：cell 包裹方式下，item 在 cell 内居中会引入额外的内部间距（STEP/2），和外部间距叠加导致不等。两个 item 之间的距离 = STEP，但首尾到面板边缘 = STEP/2。

---

### 问题 7：要求循环滚动

**提问**：用户说"滚动的结尾不要有空位置，整个是一个循环状态，滚动到最后一个组件的时候再滚动后面紧接着第一个组件"

**AI 的回答**：三倍内容 + scrollBy smooth + 边界跳转。

**修改后**：
```tsx
const tripledItems = [...allItems, ...allItems, ...allItems]
el.scrollLeft = oneSetWidth  // 中间那份
const handler = (e: WheelEvent) => {
  e.preventDefault()
  el.scrollBy({ left: e.deltaY, behavior: 'smooth' })
}
const onScroll = () => {
  if (el.scrollLeft < oneSetWidth * 0.5) el.scrollLeft += oneSetWidth
  if (el.scrollLeft > oneSetWidth * 2.5) el.scrollLeft -= oneSetWidth
}
```

**结果**：❌ 只有一个方向能循环。

**根因分析**：
1. 右边界阈值 `oneSetWidth * 2.5 = 1980` 超出实际最大 scrollLeft（1920），永远触发不了
2. `scrollBy({ behavior: 'smooth' })` 是异步动画，设置 `scrollLeft` 后动画还在继续跑，覆盖跳转位置

---

### 问题 8：只有一个方向循环

**提问**：用户说"只有一个方向是循环的，为什么"

**AI 的回答**：修复边界逻辑，改成同步 scrollLeft。

**修改前**：
```tsx
if (el.scrollLeft < oneSetWidth * 0.5) el.scrollLeft += oneSetWidth
if (el.scrollLeft > oneSetWidth * 2.5) el.scrollLeft -= oneSetWidth
```

**修改后**：
```tsx
if (el.scrollLeft < oneSetWidth) el.scrollLeft += oneSetWidth
if (el.scrollLeft >= oneSetWidth * 2) el.scrollLeft -= oneSetWidth
```

**结果**：✅ 两个方向都能循环了。但滚动太快（固定步进）。

**根因分析**：边界判断改成 `< oneSetWidth` 和 `>= oneSetWidth * 2`，确保在实际 scroll 范围内。同步 `scrollLeft` 避免异步动画覆盖。

---

### 问题 9：滚动不跟手

**提问**：用户说"这个滚动怎么不跟手啊"

**AI 的回答**：改成 `scrollBy({ behavior: 'smooth' })`。

**修改前**：
```tsx
el.scrollLeft += STEP * direction  // 固定步进，太快
```

**修改后**：
```tsx
el.scrollBy({ left: e.deltaY, behavior: 'smooth' })  // 原生 smooth
```

**结果**：❌ 回到了"只有一个方向循环"的问题（smooth 是异步的）。

---

### 问题 10：讨论方案

**提问**：用户说"只有一个方向是循环的，而且速度非常快。我们先不改改代码，聊一聊。是不是其实沿用最开始的滚动方案，加个三倍循环其实就能解决这个问题"

**AI 的回答**：同意。原方案（deltaY 驱动 + lerp 平滑）+ 三倍内容 + 边界跳转就是正确方向。

---

### 问题 11：方案区别

**提问**：用户说"这个方案和你刚刚给我改的代码方案有什么区别"

**AI 的回答**：区别在于每次 wheel 事件怎么移动。之前用 `STEP * direction`（固定跳一格），应该用 `e.deltaY`（跟随系统速度）然后 round 到步进边界。

---

### 问题 12：按讨论方案实现

**提问**：用户说"那就改一下看看效果"

**AI 的回答**：改成 `targetX += e.deltaY` + round 到 STEP 倍数 + lerp 0.2。

**修改后**：
```tsx
targetX += e.deltaY
targetX = Math.round(targetX / STEP) * STEP
// lerp 0.2
```

**结果**：❌ 不跟手。lerp 0.2 太慢，加上每帧 round 到步进边界，target 跳来跳去但视觉追不上。

---

### 问题 13：改回原生 smooth

**提问**：用户说"这个滚动怎么不跟手啊"

**AI 的回答**：改成 `scrollBy({ behavior: 'smooth' })` + scroll 事件边界跳转。

**修改后**：
```tsx
el.scrollBy({ left: e.deltaY, behavior: 'smooth' })
const onScroll = () => {
  if (el.scrollLeft < oneSetWidth) el.scrollLeft += oneSetWidth
  if (el.scrollLeft >= oneSetWidth * 2) el.scrollLeft -= oneSetWidth
}
```

**结果**：❌ smooth 异步动画覆盖跳转，循环不稳定。

---

### 问题 14：回到 deltaY 同步方案

**提问**：用户说"那就改一下看看效果"（讨论后确认用 deltaY 方案）

**AI 的回答**：改成同步 `scrollLeft += deltaY` + 边界跳转。

**修改后**：
```tsx
el.scrollLeft += e.deltaY
if (el.scrollLeft < oneSetWidth) el.scrollLeft += oneSetWidth
if (el.scrollLeft >= oneSetWidth * 2) el.scrollLeft -= oneSetWidth
```

**结果**：✅ 循环两个方向都能工作。但"又倒回之前的问题"——速度太快、间距问题。

---

### 问题 15：间距问题

**提问**：用户说"底部栏的固定组件我希望是7个，空｜组件｜空｜组件｜空｜组件｜空这种结构，每个空的距离固定且相等，滚动的单位距离应该是空+组件的宽度"

**AI 的回答**：重新设计布局，VISIBLE_COUNT=7, GAP=18, STEP=66, DOCK_WIDTH=480。用 cell 包裹。

**修改后**：
```tsx
const VISIBLE_COUNT = 7
const GAP = 18
const STEP = ITEM_WIDTH + GAP  // 66px
const DOCK_WIDTH = VISIBLE_COUNT * ITEM_WIDTH + (VISIBLE_COUNT + 1) * GAP  // 480px
// cell 包裹
<div style={{ width: STEP, display: 'flex', justifyContent: 'center' }}>
  <DockItem ... />
</div>
```

**结果**：❌ 间距仍然不一致（cell 内居中问题）。

---

### 问题 16：用户换说法描述需求

**提问**：用户说"我上一个需求一个也没实现，我换一种说法你看怎么实现，每次打开页面后底部栏都是空｜组件｜空｜组件｜空｜组件｜空这种结构，我希望每次单位平移都是左边或右边进一，把另一边的挤掉。这样一颗一颗进你能理解吗"

**AI 的回答**：理解了。需要"传送带"模式——每次滚动一个新 item 从一边滑入，一个旧 item 从另一边滑出。需要用窗口式渲染（startIndex + offset）。

---

### 问题 17：缓冲跟得上吗

**提问**：用户说"这样我滚动快了，缓冲跟得上吗"

**AI 的回答**：渲染 3 个缓冲 item（总共 13 个），快速滚动时多个步进合并成一个动画。

---

### 问题 18：纯 DOM 驱动实现

**提问**：用户说"实现看一下"

**AI 的回答**：纯 DOM 驱动，手动创建 item DOM，RAF 控制 translateX。

**修改后**：
```tsx
function createItemEl(item) {
  const cell = document.createElement('div')
  // ... 手动创建 DOM（icon、label、pointerdown 事件）
}
function renderItems() {
  container.innerHTML = ''
  for (let i = -BUFFER; i < VISIBLE_COUNT + BUFFER; i++) {
    container.appendChild(createItemEl(allItems[idx]))
  }
}
```

**结果**：❌ "完全失败，这个实现效果太拉了"（用户反馈）。初始 offset 计算错误，左侧缓冲在可视区内可见，纯 DOM 缺少 React 交互能力。

---

### 问题 19：重写静态版

**提问**：用户说"完全失败，这个实现效果太拉了。我们直接完全重写整个这部分代码，先不管循环和滚动了，我们就固定底部栏内7个组件，整个底部栏内的GAP固定，先不写滚动的部分，多的组件先隐藏"

**AI 的回答**：重写为纯静态 Dock，7 个组件，flex + gap，overflow hidden。

**修改后**：
```tsx
const VISIBLE_COUNT = 7
const visibleItems = allItems.slice(0, VISIBLE_COUNT)
<div style={{
  display: 'flex', gap: GAP, paddingLeft: GAP,
  overflow: 'hidden',
}}>
  {visibleItems.map(item => <DockItem ... />)}
</div>
```

**结果**：❌ 间距不一致。paddingLeft + gap + cell 内居中导致首尾和中间间距不同。

---

### 问题 20：间距不一致

**提问**：用户说"不是，为什么连空｜组件｜空｜组件｜空｜组件｜空这里空的距离都保持不了一致"

**AI 的回答**：多次调整。

**尝试 1**：cell 居中 + flex center → 首尾 9px，中间 18px
**尝试 2**：去掉 paddingLeft，flex center → 首尾 9px，中间 18px
**尝试 3**：flex + gap + paddingLeft，不用 cell → 首尾 18px，中间 18px ✅

**最终解法**：
```tsx
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 452px
<div style={{
  display: 'flex', gap: GAP, paddingLeft: GAP,
  overflow: 'hidden',
}}>
  {items.map(item => <div style={{ width: ITEM_WIDTH }}>...</div>)}
</div>
```

**根因分析**：cell 包裹方式下，item 在 cell 内居中会引入额外的内部间距。直接用 flex gap + paddingLeft 是最干净的方式，面板宽度精确计算保证右边距也等于 GAP。

---

### 问题 21：组件缩小

**提问**：用户说"底部栏内的组件稍微小一点点，放大和正常状态都要，现在放大之后图标有部分会被底部栏顶部截断"

**AI 的回答**：缩小 item 尺寸（44×48），放大后 60px < 64px 面板高度。

**修改前**：
```tsx
const ITEM_WIDTH = 48
const ITEM_HEIGHT = 56
// icon fontSize: 26
```

**修改后**：
```tsx
const ITEM_WIDTH = 44
const ITEM_HEIGHT = 48
// icon fontSize: 22
// DOCK_WIDTH: 480 → 452
```

**结果**：✅ 放大 1.25x = 60px < 64px，不截断。

---

### 问题 22：写问题文档找别的 AI

**提问**：用户说"整理份文档，我要拿去问其他ai要解决方案，要求包括目的、之前的方案和失败原因、目前的相关代码和实现进度"

**AI 的回答**：写了 `docs/technical/dock-scroll-problem.md`。

**结果**：✅ 文档完成，包含目标、5 种失败方案、当前代码、技术约束。

---

### 问题 23：实现 Gemini Pro 的方案

**提问**：用户在 Gemini 网页端（Pro 模型）上提问，粘贴了问题文档，要求给出解决方案。Gemini 给出了详细方案后，用户要求实现。

**Gemini 的分析：之前方案失败的关键点**

Gemini 先分析了为什么之前 5 种方案全部失败：

> **方案 5（纯 DOM 驱动）的方向是最接近完美的**，但失败的根本原因在于你使用了 `innerHTML` 重建 DOM，这直接破坏了 React 的 Fiber 树，导致组件丢失了状态、事件（Hover / 3D）和交互能力。

具体失败原因：

1. **原生 scroll（方案 1）**：`scrollLeft` 范围有限，到末尾就是空白。原生 scroll 本质上是为有限内容设计的，无法实现无限循环。

2. **三倍内容 + 边界跳转（方案 2）**：用 `if (offset > max) snap()` 的边界判断逻辑有两个致命问题：
   - 边界阈值难以精确计算（之前右边界 `oneSetWidth * 2.5 = 1980` 超出实际最大 scrollLeft 1920，永远触发不了）
   - `scrollBy({ behavior: 'smooth' })` 是异步动画，设置 `scrollLeft` 后动画还在继续跑，覆盖跳转位置

3. **React 状态 + useCallback（方案 3/4）**：闭包陷阱。
   > `setStartIndex` → React 重渲染 → `useCallback` 重建 → RAF 循环里 `requestAnimationFrame(animate)` 引用的是旧函数 → 旧函数的闭包是旧值 → 动画卡死。

4. **纯 DOM 驱动（方案 5）**：`innerHTML` 清理重建破坏了 React 组件树，丢失了 hover 放大、3D 翻转、pointerdown 拖拽等所有 React 交互能力。

**Gemini 的方案：为什么能解决这些问题**

Gemini 提出的核心思路：

> **用 React 渲染完整的 DOM 节点以保留所有交互能力，但完全剥离 React 的 State 来处理滚动逻辑，转而使用 `useRef` + `requestAnimationFrame` 直接控制外层容器的位移。**

这个方案通过一个**取模公式**彻底消除了边界跳转：

```tsx
const boundedX = ((currentX.current % W) + W) % W
```

Gemini 解释了为什么这能解决问题：

> 在这个方案中，我们**彻底放弃了针对特定临界点的 `if (offset > max) snap()` 边界跳转逻辑**。无论 `targetX` 被鼠标滚轮累加到了几万还是负几万，`((currentX.current % W) + W) % W` 这个纯数学公式都会在每一帧将其映射回 `0` 到 `W` 之间。DOM 节点的位移永远在渲染周期的同一帧完成，视觉上绝对不存在一跳一跳的断层。

Gemini 总结了 4 个关键优势：

1. **解决循环问题 & 避免异步跳跃**：取模公式在每帧将位置映射回 [0, W)，没有 if/else 边界判断，不存在跳转时机问题。

2. **完美保留 React 交互与放大效果**：所有 `<DockItem />` 完全是普通的 React 节点，`scale(1.25)` 放大和 `transformOrigin: bottom center` 毫不受阻，React 的 Synthetic Events 可以正常映射到真实的 DOM 上。不涉及 `innerHTML` 清理，不影响自研 Pointer Events 拖拽逻辑。

3. **多格连贯滚动，响应极度跟手**：快速滚动多次滚轮时，`targetX` 累加，RAF 的 lerp 算法自动追赶。动画会变长、变快，但最终停靠的位置绝对严丝合缝地对齐到 62px 的网格上。

4. **摆脱闭包陷阱**：整个滚动系统的状态（`targetX`, `currentX`）完全与 React 的 State 隔离。`useEffect` 的依赖项只有常量 `W`。无论内部如何做动画和数据计算，都不会触发 React 的重渲染流程，因此彻底杜绝了 `useCallback` 的旧引用问题。

**Gemini 给出的完整方案代码**：

```tsx
import { useEffect, useRef } from 'react';

const ITEM_WIDTH = 44;
const ITEM_HEIGHT = 48;
const GAP = 18;
const VISIBLE_COUNT = 7;
const STEP = ITEM_WIDTH + GAP; // 62px
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH; // 452px

export const Dock = ({ allItems, showPropertyPanel }) => {
  const containerRef = useRef(null);
  
  // 动画状态保存在 ref 中，避免闭包陷阱和重渲染
  const targetX = useRef(0);
  const currentX = useRef(0);
  const rafId = useRef(null);

  // 渲染三倍数据以保证首尾衔接
  const tripledItems = [...allItems, ...allItems, ...allItems];
  
  // 单组组件的总宽度
  const W = allItems.length * STEP;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. 滚轮事件驱动
    const handleWheel = (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      targetX.current += direction * STEP;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    // 2. RAF 平滑动画循环
    const loop = () => {
      // Lerp 缓动算法
      currentX.current += (targetX.current - currentX.current) * 0.15;

      // 消除微小抖动
      if (Math.abs(targetX.current - currentX.current) < 0.1) {
        currentX.current = Math.round(targetX.current);
      }

      // === 核心魔法：无限边界映射 ===
      const boundedX = ((currentX.current % W) + W) % W;

      // 位移逻辑：
      // -W：初始向左位移一组的宽度，让视野默认落在中间那一组
      // -boundedX：根据滚轮计算出的内部偏移量
      container.style.transform = `translateX(${-W - boundedX}px)`;

      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [W]);

  return (
    <div style={{
      perspective: 1000,
      transformStyle: 'preserve-3d',
      transform: showPropertyPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
      transition: 'transform 0.5s ease'
    }}>
      <div className="glass-panel-dark" style={{
        width: DOCK_WIDTH, height: 64,
        overflow: 'hidden', position: 'relative'
      }}>
        <div ref={containerRef} style={{
          display: 'flex', alignItems: 'center',
          gap: GAP, paddingLeft: GAP,
          width: 'max-content', height: '100%',
          willChange: 'transform'
        }}>
          {tripledItems.map((item, index) => (
            <DockItem key={`${item.name}-${index}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};
```

**AI 的回答**：按 Gemini 方案实现。将 Gemini 的代码适配到现有架构（保留 useDragStore、useUIStore、PropertyPanel 翻转、hover 放大等）。

**结果**：✅ 循环滚动成功。两个方向都循环，动画平滑，无跳转断层。

---

### 问题 24：速度调慢

**提问**：用户说"速度调慢一些"

**AI 的回答**：lerp 0.15 → 0.08。

**结果**：✅ 动画慢了将近一半。

---

### 问题 25：触摸板太快

**提问**：用户说"再慢一些，我在macbook的触摸板上面滑动，轻微的滑动就好快"

**AI 的回答**：累积 deltaY 超过阈值才走一步（THRESHOLD = 80）。

**修改前**：
```tsx
const direction = e.deltaY > 0 ? 1 : -1
targetX.current += direction * STEP  // 每个事件走一步
```

**修改后**：
```tsx
let accumulator = 0
const THRESHOLD = 80
accumulator += e.deltaY
while (accumulator >= THRESHOLD) {
  accumulator -= THRESHOLD
  targetX.current += STEP
}
```

**结果**：✅ 触摸板需要滑够 80px 累积量才触发一步。

**根因分析**：触摸板的 wheel 事件频率很高（一次轻滑触发几十个事件），每个事件的 deltaY 很小（1-4px）。之前每个事件加一整步（62px），累积极快。

---

### 问题 26：去掉 tooltip

**提问**：用户说"底部栏的组件我鼠标放上去会有那种文字说明，你懂我意思吗，我不要那个"

**AI 的回答**：去掉 `title={displayName}`。

**修改前**：
```tsx
<div title={displayName} onPointerDown={...}>
```

**修改后**：
```tsx
<div onPointerDown={...}>
```

**结果**：✅ 不再弹文字提示。

---

### 问题 27：hover 跟随鼠标

**提问**：用户说"还有个问题，如果我是放在一个组件时然后滚动，过程中那个图标会一直保持放大状态，我希望滚动过程中经过我鼠标的图标才放大，能解决吗"

**AI 的回答**：在 RAF 循环里根据鼠标位置 + 轨道偏移量实时计算 hovered index。

**修改前**：DockItem 用 onMouseEnter/onMouseLeave 驱动 hover

**修改后**：
```tsx
const mouseLocalX = useRef(-1)
// mousemove 事件记录鼠标位置
const handleMouseMove = (e: MouseEvent) => {
  const rect = dockEl.getBoundingClientRect()
  mouseLocalX.current = e.clientX - rect.left
}
// RAF 循环里计算
const trackX = mx + W + boundedX - GAP
const idx = Math.floor(trackX / STEP)
const realIdx = ((idx % totalCount) + totalCount) % totalCount
setHoveredIndex(prev => prev === realIdx ? prev : realIdx)
```

**结果**：✅ hover 实时跟随鼠标位置。

**根因分析**：transform 移动 items 时不触发 mouseEnter/mouseLeave（浏览器认为鼠标没动）。需要主动根据鼠标坐标 + 轨道偏移量反算鼠标下面的是哪个 item。

---

## 三、思维链总结

### 用户思路

| 阶段 | 用户在想什么 | 做了什么 | 效果 |
|------|-----------|---------|------|
| 开始 | 加组件测试滚动 | 要求添加常用组件 | Link 拖拽异常 |
| 修 bug | `<a>` 标签有问题 | 告诉 AI | 改成 `<span>` |
| 测试 | 底部栏撑大了 | 要求固定宽度 | 加 maxWidth，能滚但不循环 |
| 画布 | resize 缩太小 | 告诉 AI | 修 minHeight |
| 滚动 | 不丝滑 | 要求修改 | 改成 lerp |
| 布局 | 间距要一致 | 反复描述"空\|组件\|空"结构 | 多次实现不对 |
| 循环 | 要像轮播图 | 描述"一格一格进" | AI 理解但实现不了 |
| 讨论 | 暂停编码讨论方案 | 提出用原方案+三倍循环 | AI 确认可行 |
| 受挫 | 还是不行 | "我上一个需求一个也没实现" | 换说法重新描述 |
| 受挫 | 纯 DOM 也不行 | "完全失败" | 要求重写静态版 |
| 受挫 | 连间距都对不了 | "为什么空的距离保持不了一致" | 多次调整 |
| 决策 | 不让这个 AI 继续试了 | 要求写问题文档找别的 AI | 获得正确方案 |
| 求助 | 把问题文档发给 Gemini Pro | 在 Gemini 网页端提问 | 获得取模方案 |
| 实现 | 取模方案 | 粘贴方案让 AI 实现 | ✅ 成功 |
| 细调 | 速度/触摸板/tooltip/鼠标跟随 | 逐个提细节需求 | 逐步完善 |

### AI 思路

| 阶段 | AI 在想什么 | 做了什么 | 效果 |
|------|-----------|---------|------|
| 加组件 | 简单，加几个就行 | 创建 4 个组件 | 成功 |
| Link bug | `<a>` 有原生拖拽 | 改成 `<span>` | 成功 |
| 撑大 | 加 maxWidth | 加 3 个组件 | 能滚但不循环 |
| 画布 | minHeight 逻辑错 | Math.max 修复 | 成功 |
| 丝滑 | 加 RAF + lerp | 改滚动逻辑 | 成功 |
| 间距 | 用 cell 包裹 | cell 居中 | 不一致 |
| 循环 | 三倍内容 + scrollBy | 边界跳转 | 只有一个方向 |
| 修边界 | 改阈值 + 同步 scrollLeft | 修代码 | 两个方向了但太快 |
| 跟手 | 改回 scrollBy smooth | 异步动画 | 又只有一个方向 |
| 讨论 | 用户提方案 | 确认可行 | — |
| 实现 | deltaY + round + lerp | 改代码 | 不跟手 |
| 再改 | scrollBy smooth | 改代码 | 循环又坏了 |
| 传送带 | 窗口式渲染 | 设计方案 | — |
| 缓冲 | 3 个缓冲 item | 解释 | — |
| 纯 DOM | innerHTML 重建 | 实现 | 效果差 |
| 静态版 | flex + gap | 重写 | 间距不对 |
| 修间距 | 多次调整 | 试各种方案 | 最终对了 |
| 缩小 | item 改 44×48 | 改代码 | 成功 |
| 写文档 | 整理失败方案 | 写问题文档 | 成功 |
| Gemini 分析 | 诊断 5 种方案失败根因 | innerHTML 破坏 Fiber、闭包陷阱、边界阈值错误 | 准确定位问题 |
| Gemini 方案 | 取模公式替代边界跳转 | 三倍内容 + modulo + ref RAF | ✅ 成功 |
| 实现 | 按方案适配到现有架构 | 改代码 | ✅ 成功 |
| 调速度 | lerp 0.08 | 改代码 | 成功 |
| 触摸板 | 累积阈值 80 | 改代码 | 成功 |
| tooltip | 删 title | 改代码 | 成功 |
| hover | RAF 里算鼠标位置 | 改代码 | 成功 |

### 思维链图示

```
用户：加组件测试滚动
  │
  ├─ AI：创建 4 个组件 → Link 拖拽异常
  │     └─ 用户：链接拖的是链接不是虚线框
  │           └─ AI：`<a>` → `<span>` ✅
  │
  ├─ 用户：底部栏撑大了 → AI：加 maxWidth + 3 个组件 ✅
  │
  ├─ 用户：画布缩太小 → AI：Math.max(designHeight, contentBottom) ✅
  │
  ├─ 用户：滚动不丝滑 → AI：RAF + lerp ✅
  │
  ├─ 用户：间距要一致 + 组件数固定
  │     └─ AI：cell 包裹 → ❌ 间距不一致
  │
  ├─ 用户：要循环滚动
  │     ├─ AI：三倍内容 + scrollBy smooth → ❌ 只有一个方向
  │     ├─ AI：改边界 + 同步 scrollLeft → ❌ 太快
  │     ├─ AI：scrollBy smooth → ❌ 循环又坏了
  │     ├─ 用户：先不改代码，聊一聊
  │     │     └─ 用户：沿用原方案+三倍循环？
  │     │           └─ AI：确认可行
  │     ├─ 用户：那就改一下 → AI：deltaY + round → ❌ 不跟手
  │     ├─ AI：scrollBy smooth → ❌ 循环又坏了
  │     └─ 用户：我上一个需求一个也没实现
  │           └─ 用户：换说法——一格一格进，像轮播图
  │                 └─ AI：理解传送带模式，设计方案
  │                       └─ 用户：缓冲跟得上吗 → AI：3 个缓冲
  │                             └─ 用户：实现看一下
  │                                   └─ AI：纯 DOM → ❌ 效果差
  │
  ├─ 用户：完全失败，重写静态版
  │     └─ AI：flex + gap → ❌ 间距不对
  │           └─ 用户：为什么间距保持不了一致
  │                 └─ AI：多次调整 → ✅ 最终对了
  │
  ├─ 用户：组件缩小一点 → AI：44×48 ✅
  │
├─ 用户：写问题文档找别的 AI
│     └─ AI：写 dock-scroll-problem.md ✅
│
├─ 用户：把文档发给 Gemini Pro（网页端）
│     └─ Gemini Pro：三倍内容 + 取模公式 + ref 驱动
│           └─ AI：按方案实现 → ✅ 成功
  │
  └─ 用户：调细节
        ├─ 速度太快 → lerp 0.08 ✅
        ├─ 触摸板太快 → 累积阈值 80 ✅
        ├─ 去掉 tooltip → 删 title ✅
        └─ hover 不跟随 → RAF 算鼠标位置 ✅
```

**关键转折点**：

1. **Link 拖拽异常**（转折 1）：`<a>` 标签的原生拖拽行为和自研 Pointer Events 冲突。这是浏览器机制问题，不是代码 bug。

2. **scrollBy smooth 异步覆盖**（转折 2）：`scrollBy({ behavior: 'smooth' })` 是异步动画，设置 `scrollLeft` 后动画还在继续跑。AI 反复在这个问题上打转——用 smooth 就循环不稳定，用同步就跟手但太快。

3. **用户要求暂停编码讨论**（转折 3）：用户说"我们先不改改代码，聊一聊"，主动暂停实现来理清思路。这是正确的决策——在连续失败后继续编码只会浪费 token。

4. **用户要求写文档找别的 AI**（转折 4）：用户意识到当前上下文可能不够，要求整理问题文档寻求外部帮助。文档发给 Gemini Pro（网页端）后获得了正确方案。

5. **取模公式**（转折 5）：核心突破是 `((currentX % W) + W) % W`，用数学公式替代 if/else 边界判断。不管累加到多大，每帧映射回 [0, W)，不存在跳转时机问题。

---

## 四、改善建议

### 对 AI 的改善

1. **循环滚动是经典问题，不要从零发明方案**。三倍内容 + 取模是前端社区成熟的解决方案，AI 应该直接搜索或引用已有模式，而不是自己从 scrollLeft += deltaY 开始试。

2. **闭包问题应该在设计阶段就发现**。在选择"React 状态 + useCallback + RAF"架构时，就应该预见到 setState 触发重渲染 → 函数重建 → RAF 引用旧函数的问题。

3. **连续失败 3 次后应该停下来**。问题 7-13 反复在 smooth/同步/lerp/round 之间切换，每次都解决一个问题又引入另一个。应该在第 3 次失败后主动建议写文档找外部方案。

4. **scrollBy smooth 的异步特性应该一开始就意识到**。AI 多次使用 `scrollBy({ behavior: 'smooth' })` 然后设置 `scrollLeft`，没有意识到 smooth 动画是异步的，会覆盖手动设置的位置。

5. **间距计算应该用公式验证**。多次间距不一致的原因是凭直觉设置 paddingLeft/cell width，没有用公式验证。

### 对用户的改善

1. **循环滚动的需求一开始就该明确**。用户在加组件时只说"看下横向移动生不生效"，没有提循环需求。如果一开始就说明要循环，AI 可以直接找成熟方案。

2. **"像轮播图"是很精确的描述**。这个比喻帮 AI 理解了期望的交互模式。类似的具象比喻比抽象描述更有效。

3. **及时止损要求写文档**。连续失败后用户没有让 AI 继续试，而是要求写文档找别的 AI。这是正确的决策。

4. **暂停编码讨论方案是好习惯**。用户说"先不改代码，聊一聊"，避免了在错误方向上浪费更多实现时间。

### 可复用的排查清单：循环横向滚动

```
1. 确定方案类型：
   - 原生 scroll（简单但不能循环）
   - 三倍内容 + 取模（推荐，纯数学循环）
   - React 状态驱动（注意闭包陷阱）
   - 纯 DOM 驱动（注意交互能力）

2. 如果选三倍内容方案：
   - 三份 items：[...allItems, ...allItems, ...allItems]
   - 单组宽度 W = totalCount * STEP
   - 取模：boundedX = ((currentX % W) + W) % W
   - 位移：translateX(-W - boundedX)
   - 不要用 if/else 边界跳转
   - 不要用 scrollBy({ behavior: 'smooth' })，用 RAF + lerp

3. 触摸板兼容：
   - 累积 deltaY，超过阈值才触发一步
   - 阈值建议 80-100px

4. hover 效果：
   - 不要依赖 mouseEnter/mouseLeave
   - 在 RAF 里根据鼠标位置 + 轨道偏移量反算 item index

5. 间距一致性：
   - 不要用 cell 包裹 + 居中，用 flex gap + paddingLeft
   - 面板宽度 = (N+1)*GAP + N*ITEM_WIDTH
   - 右边距自动等于 GAP
```

### 是否生成 Skill

**不建议生成独立 skill**。

原因：
- 循环滚动是前端通用知识，不是项目特定流程
- 最终方案的核心代码只有 10 行（取模 + lerp），不需要 skill 级别的文档
- 建议在 `canvas-editor` skill 的 pitfall 中补充"循环滚动用取模公式，不要用边界跳转"

---

## 五、解决后最终代码

### Dock.tsx（最终版，核心部分）

```tsx
const ITEM_WIDTH = 44
const ITEM_HEIGHT = 48
const GAP = 18
const STEP = ITEM_WIDTH + GAP  // 62px
const VISIBLE_COUNT = 7
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 452px

const tripledItems = [...allItems, ...allItems, ...allItems]
const W = totalCount * STEP

// ref 驱动，零 React 状态
const trackRef = useRef<HTMLDivElement>(null)
const dockRef = useRef<HTMLDivElement>(null)
const targetX = useRef(0)
const currentX = useRef(0)
const rafId = useRef(0)
const mouseLocalX = useRef(-1)

useEffect(() => {
  let accumulator = 0
  const THRESHOLD = 80

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

  const handleMouseLeave = () => {
    mouseLocalX.current = -1
    setHoveredIndex(null)
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
  dockEl.addEventListener('mouseleave', handleMouseLeave)
  rafId.current = requestAnimationFrame(loop)
  // ... cleanup
}, [W, totalCount])
```

### DockItem（最终版）

```tsx
const DockItem: React.FC<DockItemProps> = ({ name, icon, displayName, index, hoveredIndex }) => {
  const getScale = () => {
    if (hoveredIndex === null) return 1
    const distance = Math.abs(index - hoveredIndex)
    if (distance === 0) return 1.25
    if (distance === 1) return 1.1
    return 1
  }

  return (
    <div style={{
      width: ITEM_WIDTH, height: ITEM_HEIGHT, borderRadius: 10,
      cursor: 'grab', userSelect: 'none', flexShrink: 0,
      transform: `scale(${getScale()})`,
      transformOrigin: 'bottom center',
      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)',
                      marginTop: 2, whiteSpace: 'nowrap',
                      fontWeight: 500, letterSpacing: 0.3 }}>
        {displayName}
      </span>
    </div>
  )
}
```
