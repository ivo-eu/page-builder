# 属性编辑功能 — 阶段 3 技术方案

> 日期：2026-05-28
> 状态：待审核
> 涉及阶段：阶段 3（Dock 重构为多面板 + PropertyPanel）

---

## 一、阶段概述

阶段 3 是核心改动。将 Dock 从"正面+背面 CSS 3D 翻转"重构为"容器+面板插槽"架构。

| 子阶段 | 内容 | 风险 |
|--------|------|------|
| 3a | 抽取 ComponentListPanel（正面内容独立） | ★★☆ 中 |
| 3b | Dock 改为容器 + 面板切换动画 | ★★☆ 中 |
| 3c | PropertyPanel 面板（属性滚动列表） | ★☆☆ 低 |
| 3d | PropertyInput 组件（输入框 + 选择器） | ★☆☆ 低 |

---

## 二、架构变更

### 现有架构（CSS 3D 正反面）

```
Dock.tsx
  └ perspective 容器
    └ 翻转容器 (rotateX)
      ├ 正面：面板(overflow) → track(translateX) → DockItems
      └ 背面：PropertyPanel (absolute, rotateX(180deg))
```

问题：正面和背面耦合在同一个组件里，RAF 循环、refs、状态混在一起。

### 新架构（容器+面板插槽）

```
Dock.tsx（容器）
  ├ 外框定位（fixed, bottom, center, z-index）
  ├ 面板切换动画控制（scaleX 过渡）
  └ 面板插槽：
      activePanel === 'components' → ComponentListPanel
      activePanel === 'properties' → PropertyPanel
```

每个面板完全独立：
- ComponentListPanel 自带 RAF 循环、trackRef、hover 状态
- PropertyPanel 自带属性列表（可以有独立滚动，也可以后续再加）
- 面板之间零耦合

---

## 三、子阶段 3a：抽取 ComponentListPanel

### 3.1 目的

把 Dock.tsx 正面的内容（滚动列表 + RAF 循环 + hover 放大 + 拖拽）原封不动搬到独立组件。

### 3.2 新增文件

#### `src/components/Dock/ComponentListPanel.tsx`

从 Dock.tsx 中提取以下内容：

```typescript
// 以下全部搬到 ComponentListPanel.tsx：
const ITEM_WIDTH = 44
const ITEM_HEIGHT = 48
const GAP = 18
const VISIBLE_COUNT = 7
const STEP = ITEM_WIDTH + GAP
const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH

// 状态
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

// Refs
const trackRef, dockRef, targetX, currentX, rafId, mouseLocalX

// useEffect（RAF 循环 + wheel + mousemove + mouseleave）
// tripledItems, W 计算
// DockItem 组件（含 getScale, handlePointerDown）
```

**关键：不改任何逻辑，只是搬迁。**

### 3.3 ComponentListPanel 的 props

```typescript
interface ComponentListPanelProps {
  width: number   // 面板宽度，由 Dock 容器传入（DOCK_WIDTH）
}
```

面板需要知道自己的宽度来设置 overflow 容器的尺寸。

### 3.4 改动文件

#### `src/components/Dock/Dock.tsx`

移除正面内容相关的所有代码（状态、refs、useEffect、DockItem），
改为渲染 `<ComponentListPanel width={DOCK_WIDTH} />`。

### 3.5 验证

**这是关键检查点。** 搬迁后：
- 正面组件列表的循环滚动必须正常
- hover 放大效果必须正常
- 拖拽组件到画布必须正常

如果这里出问题，停下来修，不继续。

---

## 四、子阶段 3b：Dock 容器 + 面板切换动画

### 4.1 Dock 容器结构

```typescript
// Dock.tsx
const activePanel = showPropertyPanel ? 'properties' : 'components'

return (
  <div style={{ position: 'fixed', bottom: 12, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
    <div style={{ perspective: 1000, pointerEvents: 'auto' }}>
      <div style={{
        // 翻转动画
        transformStyle: 'preserve-3d',
        transform: showPropertyPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
        transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
      }}>
        {/* 正面 */}
        <div style={{ backfaceVisibility: 'hidden', borderRadius: 20, height: 64, width: DOCK_WIDTH, overflow: 'hidden', position: 'relative' }}>
          <ComponentListPanel width={DOCK_WIDTH} />
        </div>
        {/* 背面 */}
        <div style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <PropertyPanel width={DOCK_WIDTH} />
        </div>
      </div>
    </div>
  </div>
)
```

**关键决策：保留 CSS 3D rotateX 翻转，而不是改用 scaleX。**

理由：
- 现有的 rotateX 翻转动画已经可用
- 正面和背面的 DOM 结构不变（backfaceVisibility + rotateX(180deg)）
- 只是把正面内容从内联搬到 ComponentListPanel，背面内容从旧 PropertyPanel 换成新 PropertyPanel
- 风险最小

### 4.2 翻转触发条件

复用现有的 `useUIStore.showPropertyPanel`：
- `openPropertyPanel(targetId)` → showPropertyPanel = true → 翻到背面
- `closePropertyPanel()` → showPropertyPanel = false → 翻回正面

### 4.3 影响范围

| 维度 | 影响 |
|------|------|
| Dock.tsx | 重写为容器，正面内容移走 |
| ComponentListPanel | 新文件，从 Dock 搬出 |
| 翻转动画机制 | 保留现有 CSS 3D，不改 |
| useUIStore | 不改（阶段 2 已扩展） |

---

## 五、子阶段 3c：PropertyPanel 面板

### 5.1 需求

属性面板在翻转背面显示，内容为 12 个属性的图标列表。
每个属性项的布局和 DockItem 完全一样（44×48px 图标区 + 文字标签）。
支持循环滚动（复用 ComponentListPanel 的滚动参数）。

### 5.2 改动文件

#### `src/components/PropertyPanel/PropertyPanel.tsx`（重写）

现有的 PropertyPanel.tsx 是一个简单的水平 flex 布局，直接展示属性编辑器。
需要完全重写为和 ComponentListPanel 结构一致的滚动列表。

```typescript
interface PropertyPanelProps {
  width: number
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ width }) => {
  const propertyPanelTarget = useUIStore(s => s.propertyPanelTarget)
  const nodes = useCanvasStore(s => s.nodes)

  if (!propertyPanelTarget) return null
  const node = nodes.get(propertyPanelTarget)
  if (!node) return null

  // 12 个属性定义
  const properties = propertyDefinitions

  // 循环滚动（和 ComponentListPanel 相同的参数和逻辑）
  const tripledItems = [...properties, ...properties, ...properties]
  const totalCount = properties.length
  const W = totalCount * STEP

  // RAF 循环、wheel、hover（复用 ComponentListPanel 的代码模式）
  // ...

  return (
    <div ref={dockRef} className="glass-panel-dark scrollbar-hidden" style={{ borderRadius: 20, height: 64, width, overflow: 'hidden', position: 'relative' }}>
      <div ref={trackRef} style={{ display: 'flex', alignItems: 'center', gap: GAP, paddingLeft: GAP, width: 'max-content', height: '100%', willChange: 'transform' }}>
        {tripledItems.map((prop, index) => (
          <PropertyItem key={`${prop.key}-${index}`} ... />
        ))}
      </div>
      {/* 输入框/选择器弹出层 */}
      {activeProperty && <PropertyInputPopup ... />}
    </div>
  )
}
```

### 5.3 PropertyItem 组件

和 DockItem 结构完全一样，但：
- 图标区显示属性定义的 icon 字母（如 'W', 'H', 'BG'）
- 标签显示属性定义的 label（如 '宽度', '背景色'）
- 点击不是触发拖拽，而是打开输入框

```typescript
const PropertyItem: React.FC<{
  def: PropertyDefinition
  index: number
  hoveredIndex: number | null
  isActive: boolean  // 是否正在编辑（保持 scale 1.25）
  onClick: () => void
}> = ({ def, index, hoveredIndex, isActive, onClick }) => {
  const getScale = () => {
    if (isActive) return 1.25  // 选中态 = hover 态
    if (hoveredIndex === null) return 1
    const distance = Math.abs(index - hoveredIndex)
    if (distance === 0) return 1.25
    if (distance === 1) return 1.1
    return 1
  }

  const scale = getScale()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: ITEM_WIDTH, height: ITEM_HEIGHT, borderRadius: 10,
      cursor: 'pointer', userSelect: 'none', flexShrink: 0,
      transform: `scale(${scale})`,
      transformOrigin: 'bottom center',
      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }} onClick={onClick}>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>{def.icon}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, whiteSpace: 'nowrap', fontWeight: 500 }}>{def.label}</span>
    </div>
  )
}
```

### 5.4 循环滚动复用

PropertyPanel 和 ComponentListPanel 的滚动逻辑完全一样（RAF + lerp + 取模 + wheel 累积阈值 + hover 计算）。

两种选择：
- A. 复制代码（两个文件各一份）
- B. 抽成自定义 hook（useDockScroll）

**选择 B：抽成 hook。** 理由：
- 滚动逻辑有 80+ 行，复制维护成本高
- 参数完全一致（ITEM_WIDTH, GAP, STEP 等）
- hook 只需传入 totalCount 和 containerRef

```typescript
// src/components/Dock/useDockScroll.ts
export function useDockScroll(totalCount: number, containerRef: RefObject<HTMLDivElement>) {
  // 返回 { trackRef, hoveredIndex, W, tripledItems 等 }
}
```

### 5.5 输入框弹出层

当用户点击某个 PropertyItem 时，在该 item 上方弹出输入框。

```typescript
// PropertyInputPopup 的定位
// 位置 = 被点击 item 在 track 中的位置 → 转换为相对面板的位置
// 弹出框在 item 正上方，水平居中

const [activeProperty, setActiveProperty] = useState<string | null>(null)
const [inputPosition, setInputPosition] = useState<{ x: number; y: number } | null>(null)

// 点击 PropertyItem 时
const handlePropertyClick = (propKey: string, itemRect: DOMRect) => {
  setActiveProperty(propKey)
  // 计算弹出框位置（相对于 dock 面板）
  setInputPosition({
    x: itemRect.left + itemRect.width / 2 - 80,  // 160px 宽度的一半
    y: itemRect.top - dockRect.top - 8  // item 上方 8px
  })
}
```

弹出框渲染在面板的 overflow: hidden 容器之外（用 portal 或 absolute 定位到 fixed 容器）。

**问题：面板有 overflow: hidden，弹出框会被裁剪。**

解决方案：弹出框不放在面板内部，而是放在 Dock 的最外层 fixed 容器中，用绝对定位。

```typescript
// Dock.tsx 容器中
<div style={{ position: 'fixed', bottom: 12, ... }}>
  {/* 面板 */}
  <div style={{ perspective: 1000, ... }}>...</div>
  {/* 弹出框（在面板外部，不被 overflow: hidden 裁剪） */}
  {activeProperty && inputPosition && (
    <PropertyInputPopup position={inputPosition} ... />
  )}
</div>
```

---

## 六、子阶段 3d：PropertyInput 组件

### 6.1 需求

3 种输入组件：
- NumberInput：数值型，右侧显示 px 单位
- ColorInput：颜色型，左侧颜色方块 + 文字输入
- SelectInput：选择型，弹出竖排单选列表

### 6.2 新增文件

#### `src/components/PropertyInput/NumberInput.tsx`

```typescript
// 160px 宽输入框，右侧 "px" 标记
// 3D 立体阴影
// 聚焦时加深阴影 + 高亮边框
// 值变化时不立即提交，点外部才提交
// 空输入 → 恢复原值
// 输入 0 → 值为 0
```

#### `src/components/PropertyInput/ColorInput.tsx`

```typescript
// 160px 宽输入框，左侧颜色方块
// 文字输入 hex 值
// 同样的 3D 立体阴影
// 提交逻辑同 NumberInput
```

#### `src/components/PropertyInput/SelectInput.tsx`

```typescript
// 弹出面板，竖排选项
// 每行：左侧圆形单选框 + 右侧文字
// 选中后立即生效（不需要点外部）
// 3D 立体阴影
```

#### `src/components/PropertyInput/index.ts`

### 6.3 输入框公共样式

```typescript
const inputBaseStyle: React.CSSProperties = {
  width: 160,
  height: 32,
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '0 10px',
  fontSize: 13,
  fontFamily: '"SF Mono", "Fira Code", monospace',
  backgroundColor: 'rgba(255,255,255,0.95)',
  color: '#1d1d1f',
  outline: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)',
  transition: 'box-shadow 0.2s, border-color 0.2s',
}

const inputFocusStyle: React.CSSProperties = {
  borderColor: '#636366',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.2)',
}
```

### 6.4 提交流程

```
用户点击 PropertyItem
  → 弹出输入框，显示当前值
  → 用户修改值
  → 点击输入框外部（或按 Enter）
    → 验证输入值
    → 合法 → updateNode/updateNodeStyles → 画布立即更新
    → 不合法 → toast.error(错误信息) → 值不变
  → 输入框关闭
```

### 6.5 数据写入

```typescript
const handleCommit = (propDef: PropertyDefinition, rawValue: string) => {
  const result = propDef.validate(rawValue)
  if (!result.valid) {
    toast.error('输入值不合法', result.error)
    return
  }
  const changes = propDef.write(node, result.parsed)
  if (changes.nodeChanges) {
    useCanvasStore.getState().updateNode(nodeId, changes.nodeChanges)
  }
  if (changes.styleChanges) {
    useCanvasStore.getState().updateNodeStyles(nodeId, changes.styleChanges)
  }
}
```

---

## 七、文件清单汇总

### 新增文件（5 个）

| 文件 | 用途 |
|------|------|
| `src/components/Dock/ComponentListPanel.tsx` | 从 Dock 提取的组件列表面板 |
| `src/components/Dock/useDockScroll.ts` | 循环滚动自定义 hook |
| `src/components/PropertyInput/NumberInput.tsx` | 数值输入框 |
| `src/components/PropertyInput/ColorInput.tsx` | 颜色输入框 |
| `src/components/PropertyInput/SelectInput.tsx` | 选择器 |
| `src/components/PropertyInput/index.ts` | 导出 |

### 改动文件（2 个）

| 文件 | 改动 |
|------|------|
| `src/components/Dock/Dock.tsx` | 重构为容器，移除正面内容 |
| `src/components/PropertyPanel/PropertyPanel.tsx` | 重写为滚动属性列表 |

### 不动文件

App.tsx, Canvas.tsx, CanvasLayer.tsx, useCanvasStore.ts, useUIStore.ts, index.css, 所有 builtin-components。

---

## 八、可能的 Bug

| Bug | 原因 | 应对 |
|-----|------|------|
| 正面滚动失效 | 搬迁时遗漏了某个 ref 或依赖 | 3a 做完必须验证 |
| RAF 循环泄漏 | 切换面板时旧面板的 RAF 没取消 | useEffect cleanup 中 cancelAnimationFrame |
| hover 计算错误 | tripledItems.length 变了（12 个属性 vs 14 个组件） | 用 totalCount 而不是 tripledItems.length |
| 弹出框被 overflow: hidden 裁剪 | 输入框放在面板内部 | 弹出框放在 fixed 容器层，不在面板内 |
| 弹出框定位偏移 | 滚动后 item 位置变化 | 弹出时重新计算位置，或用 getBoundingClientRect |
| 翻转动画和面板内容不同步 | 面板在翻转开始时就切换了 | 面板在翻转过程中保持不变，翻转完成后再切换内容 |
| 点输入框外部触发了退出编辑 | 全局 click 和输入框 blur 冲突 | 输入框的外部点击用 mousedown + stopPropagation |

---

## 九、待确认

1. **PropertyPanel 是否也用循环滚动？** 12 个属性，452px 面板能显示 7 个，需要滚动才能看完。我建议用循环滚动（和组件列表一样的体验）。可以吗？

2. **PropertyItem 的图标用什么颜色？** 当前 DockItem 的图标是 emoji（彩色），属性图标是字母。我建议字母用白色（rgba(255,255,255,0.85)），和暗色面板形成对比。可以吗？

3. **弹出框关闭时机：** 点击输入框外部关闭输入框，还是点击其他 PropertyItem 时切换到新输入框？我建议：点击其他 PropertyItem 切换，点击面板/画布外部关闭。可以吗？
