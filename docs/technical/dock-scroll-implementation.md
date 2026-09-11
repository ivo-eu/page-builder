# 底部栏循环横向滚动 — 技术文档

> 日期：2026-05-28
> 状态：已实现，运行中
> 涉及文件：src/components/Dock/Dock.tsx

---

## 一、功能概述

底部栏（Dock）是一个固定在页面底部的组件选择栏，用户可以从中拖拽组件到画布上。

### 核心特性

| 特性 | 说明 |
|------|------|
| 循环滚动 | 滚到最后一个组件后自动接上第一个，无限循环 |
| 滚轮驱动 | 鼠标滚轮 / 触摸板控制，不是拖拽或点击箭头 |
| 步进滚动 | 每次滚动一个组件+一个间距的距离（62px） |
| 平滑动画 | RAF + lerp 缓动，跟随手但有惯性 |
| 触摸板兼容 | 累积阈值模式，轻滑不会触发过快 |
| macOS 放大效果 | hover 组件 scale(1.25)，相邻 scale(1.1) |
| 实时 hover 跟踪 | 滚动过程中 hover 效果跟随鼠标位置 |
| 3D 翻转 | 选中组件时 Dock 翻转显示 PropertyPanel |

---

## 二、布局规格

### 尺寸参数

| 参数 | 值 | 说明 |
|------|-----|------|
| ITEM_WIDTH | 44px | 组件图标宽度 |
| ITEM_HEIGHT | 48px | 组件图标高度 |
| GAP | 18px | 组件间距（所有间距相等） |
| STEP | 62px | 一次滚动距离 = ITEM_WIDTH + GAP |
| VISIBLE_COUNT | 7 | 同时可见的组件数 |
| DOCK_WIDTH | 452px | 面板固定宽度 |

### 面板宽度计算

```
DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH
           = 8 * 18 + 7 * 44
           = 144 + 308
           = 452px
```

### 间距验证

```
左边距：paddingLeft = GAP = 18px ✓
组件间距：flex gap = GAP = 18px ✓
右边距：DOCK_WIDTH - paddingLeft - 7*ITEM_WIDTH - 6*GAP
      = 452 - 18 - 308 - 108 = 18px ✓
```

---

## 三、架构设计

### 整体结构

```
最外层（fixed 定位，居中）
  └ perspective 容器（3D 翻转）
    └ 翻转容器（rotateX 0° / 180°）
      ├ 正面：Dock 面板（overflow: hidden）
      │   └ 运动轨道（flex 容器，translateX 驱动）
      │     └ DockItem × 42（三倍内容：14 × 3）
      └ 背面：PropertyPanel（position: absolute, rotateX 180°）
```

### 数据流

```
registry.getCategories() → getByCategory() → allItems (14 个)
  ↓ ×3
tripledItems = [...allItems, ...allItems, ...allItems]  (42 个)
  ↓
RAF 循环（每帧）：
  targetX ← wheel 事件累加
  currentX lerp 趋向 targetX
  boundedX = ((currentX % W) + W) % W
  track.style.transform = translateX(-W - boundedX)
  hoveredIndex = 根据鼠标位置 + boundedX 计算
  ↓
DockItem 根据 hoveredIndex 计算 scale
```

### 状态管理

| 状态 | 存储方式 | 说明 |
|------|---------|------|
| targetX | useRef | 滚轮目标位置，可累加到任意大/小 |
| currentX | useRef | 当前动画位置，lerp 趋向 targetX |
| rafId | useRef | RAF 帧 ID |
| mouseLocalX | useRef | 鼠标相对 dock 面板的 x 坐标 |
| hoveredIndex | useState | 当前 hover 的 item index（唯一触发 React 更新的状态） |
| accumulator | 局部变量 | wheel 事件累积量 |

**关键设计**：除了 hoveredIndex 外，所有滚动状态都在 ref 里，不触发 React 重渲染。hoveredIndex 只在真正变化时才 setState。

---

## 四、循环滚动算法

### 核心公式

```typescript
const W = totalCount * STEP  // 单组宽度 = 14 × 62 = 868px

// 每帧执行
const boundedX = ((currentX % W) + W) % W
track.style.transform = `translateX(${-W - boundedX}px)`
```

### 原理

1. **三倍内容**：items 渲染三份 [A|A|A]，轨道总长 = 3W
2. **初始视野**：translateX(-W) 让视野落在中间那份（第二份）
3. **取模映射**：不管 currentX 累加到多大或多小，`((currentX % W) + W) % W` 将其映射到 [0, W)
4. **位移合成**：-W（中间那份起点）- boundedX（内部偏移）

### 循环示例

```
初始状态：
  轨道：[item0..item13 | item0..item13 | item0..item13]
  translateX = -W - 0 = -868
  视野落在第二份的 item0

向右滚动 3 步（targetX += 3×62 = 186）：
  boundedX = 186
  translateX = -868 - 186 = -1054
  视野落在第二份的 item3

继续滚动到 boundedX 接近 W（868）：
  boundedX = 868 → 取模 → 0
  translateX = -868 - 0 = -868
  视野回到第二份的 item0（和初始状态相同）
  用户看到的是 item0，视觉上无缝衔接

反向滚动（targetX 减小到负数）：
  currentX = -100
  boundedX = ((-100 % 868) + 868) % 868 = (-100 + 868) % 868 = 768
  translateX = -868 - 768 = -1636
  视野落在第三份的某个位置
  取模保证不会超出 [0, W) 范围
```

### 为什么不需要边界跳转

传统方案用 if/else 判断 scrollLeft 是否接近边界，然后手动跳转。问题：
- 边界阈值难以精确计算
- 跳转时和异步动画冲突
- 两个方向的边界逻辑容易不对称

取模方案用纯数学映射，没有 if/else，没有跳转时机问题。不管 currentX 是 10000 还是 -10000，boundedX 都在 [0, W) 内。

---

## 五、动画系统

### RAF + Lerp 缓动

```typescript
function loop() {
  // lerp：每帧移动差距的 8%
  currentX.current += (targetX.current - currentX.current) * 0.08

  // 极接近目标时直接对齐（消除无限小数抖动）
  if (Math.abs(targetX.current - currentX.current) < 0.1) {
    currentX.current = targetX.current
  }

  // 取模 + 位移
  const boundedX = ((currentX.current % W) + W) % W
  if (track) track.style.transform = `translateX(${-W - boundedX}px)`

  // hover 计算（见下文）
  // ...

  rafId.current = requestAnimationFrame(loop)
}
```

### Lerp 参数

| 参数 | 值 | 效果 |
|------|-----|------|
| lerp 因子 | 0.08 | 每帧移动差距的 8%，动画偏慢但丝滑 |
| snap 阈值 | 0.1px | 差距 < 0.1px 时直接对齐，消除抖动 |

调整建议：
- 更快：0.12-0.15
- 更慢：0.04-0.06
- 当前 0.08 适合触摸板

---

## 六、滚轮处理

### 累积阈值模式

```typescript
let accumulator = 0
const THRESHOLD = 80  // 触摸板需要滑够 80px 才走一步

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  accumulator += e.deltaY

  while (accumulator >= THRESHOLD) {
    accumulator -= THRESHOLD
    targetX.current += STEP  // 正向一步
  }
  while (accumulator <= -THRESHOLD) {
    accumulator += THRESHOLD
    targetX.current -= STEP  // 反向一步
  }
}
```

### 为什么需要累积阈值

| 输入设备 | deltaY 范围 | 频率 | 每步需要的事件数 |
|---------|-----------|------|---------------|
| 普通鼠标滚轮 | ±100-150 | 低 | 1-2 个 |
| 触摸板轻滑 | ±1-4 | 极高（60-120Hz） | 20-80 个 |
| 触摸板快滑 | ±10-30 | 高 | 3-8 个 |

如果没有阈值，触摸板轻滑的每个事件（deltaY=2）都会触发一步（62px），一次轻滑就触发几十步。

阈值 80 意味着：
- 鼠标滚轮：一次滚轮事件（deltaY≈100）触发 1 步
- 触摸板轻滑：需要累积 80px 的 deltaY 才触发 1 步
- 触摸板快滑：几帧就触发 1 步

---

## 七、Hover 跟踪

### 问题

DockItem 的 hover 效果（scale 放大）依赖鼠标位置。但滚动时 items 通过 transform 移动，浏览器不触发 mouseEnter/mouseLeave 事件（鼠标没动，是内容在动）。

### 解决方案

在 RAF 循环里根据鼠标位置 + 轨道偏移量反算鼠标下面的是哪个 item。

```typescript
// 记录鼠标位置（mouseMove 事件）
const handleMouseMove = (e: MouseEvent) => {
  const rect = dockEl.getBoundingClientRect()
  mouseLocalX.current = e.clientX - rect.left
}

// RAF 循环里计算
const mx = mouseLocalX.current
if (mx >= 0) {
  // 鼠标在 track 坐标系中的位置
  const trackX = mx + W + boundedX - GAP
  // 对应第几个 item cell
  const idx = Math.floor(trackX / STEP)
  // 循环映射到实际 index
  const realIdx = ((idx % totalCount) + totalCount) % totalCount
  // 只在变化时 setState
  setHoveredIndex(prev => prev === realIdx ? prev : realIdx)
}
```

### 坐标转换

```
鼠标在 dock 面板上的位置：mx（相对于面板左边缘）
track 的 translateX 偏移：-W - boundedX
鼠标在 track 坐标系中的位置：mx + W + boundedX
减去 paddingLeft(GAP)：mx + W + boundedX - GAP
除以 STEP 得到 item 索引：floor(trackX / STEP)
取模映射到实际 item：idx % totalCount
```

### 放大效果

```typescript
const getScale = () => {
  if (hoveredIndex === null) return 1
  const distance = Math.abs(index - hoveredIndex)
  if (distance === 0) return 1.25   // hover 的：放大 25%
  if (distance === 1) return 1.1    // 相邻的：放大 10%
  return 1                          // 其他：正常
}
```

面板高度 64px，item 高度 48px，放大 1.25x = 60px < 64px，不溢出。

---

## 八、3D 翻转

```tsx
<div style={{
  perspective: 1000,
  transformStyle: 'preserve-3d',
  transform: showPropertyPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
  transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
}}>
  {/* 正面：Dock 面板 */}
  <div style={{ backfaceVisibility: 'hidden' }}>...</div>

  {/* 背面：PropertyPanel */}
  <div style={{
    backfaceVisibility: 'hidden',
    transform: 'rotateX(180deg)',
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  }}>
    <PropertyPanel />
  </div>
</div>
```

- `showPropertyPanel` 为 true 时整个容器翻转 180°
- 正面和背面都设 `backfaceVisibility: 'hidden'`，翻转时隐藏对应面
- 缓动曲线：`cubic-bezier(0.25, 1, 0.5, 1)`，快速启动柔和收尾

---

## 九、组件注册

```typescript
// registry 读取
const categories = registry.getCategories()
const allItems = categories.flatMap(cat => registry.getByCategory(cat))
// 当前 14 个组件，三倍渲染 42 个

// 组件列表（按 category 排列）
basic:    Button, Text, Input, Image, Heading, Divider, Link, Paragraph, Switch, Avatar  (10)
layout:   Container, Card  (2)
data:     Table  (1)
feedback: Modal  (1)
```

---

## 十、性能考虑

| 维度 | 优化 |
|------|------|
| React 重渲染 | 仅 hoveredIndex 变化时触发，其他状态全 ref |
| DOM 操作 | 仅 track.style.transform，GPU 加速（will-change: transform） |
| 事件监听 | wheel/mousemove 在 dock 面板上，不影响全局 |
| RAF 循环 | 永久运行（组件挂载到卸载），每帧开销极低 |
| DOM 节点 | 42 个 DockItem（轻量 div + span），可忽略 |

---

## 十一、配置参数速查

```typescript
// 在 Dock.tsx 顶部修改
const ITEM_WIDTH = 44      // 组件宽度
const ITEM_HEIGHT = 48     // 组件高度
const GAP = 18             // 间距（所有间距相等）
const VISIBLE_COUNT = 7    // 可见组件数
const STEP = ITEM_WIDTH + GAP  // 步进距离（自动计算）
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 面板宽度（自动计算）

// 在 useEffect 内修改
const THRESHOLD = 80       // 滚轮累积阈值（越大需要滑越多才触发一步）
const LERP = 0.08          // 缓动因子（越大越快，越小越慢）
const SNAP = 0.1           // 对齐阈值（px，差距小于此值直接对齐）
```
