# 属性编辑功能 — 阶段 1-2 技术方案

> 日期：2026-05-28
> 状态：待审核
> 涉及阶段：阶段 1（独立基础件）+ 阶段 2（Store 扩展）

---

## 一、阶段概述

阶段 1-2 是纯新增代码，不修改任何现有文件，零回归风险。

| 阶段 | 内容 | 文件数 | 风险 |
|------|------|--------|------|
| 1a | Toast 通知组件 | 2 个新文件 | 零 |
| 1b | 属性定义数据 | 1 个新文件 | 零 |
| 2  | Store 扩展 | 1 个改动文件 | 极低 |

---

## 二、阶段 1a：Toast 通知组件

### 2.1 需求

照 antd `notification` 样式实现一个轻量 Toast：
- 支持 4 种类型：success / info / warning / error
- 位置：顶部居中
- 自动消失（3 秒）
- 手动关闭（点击 ×）
- 多条通知可堆叠

### 2.2 antd notification 样式参考

antd 的 notification 样式特征：
- 白色背景，圆角 8px
- 左侧彩色图标（不同类型不同颜色）
- 标题（粗体）+ 描述（普通）
- 右上角关闭按钮
- 阴影：`0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)`
- 入场动画：从右侧滑入 + 淡入
- 宽度：约 320px

### 2.3 新增文件

#### 文件 1：`src/components/Toast/Toast.tsx`

```typescript
// 对外 API（模块级，不需要 React 组件包裹）
export const toast: {
  success: (title: string, description?: string) => void
  info:    (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  error:   (title: string, description?: string) => void
}

// 内部实现
// - 用 ReactDOM.createRoot 创建独立的 React 根节点
// - 挂载到 document.body 上的固定容器
// - toast.success() → 往容器内追加一条通知
// - 3 秒后自动移除
// - 点击 × 手动移除
// - 多条通知从上往下堆叠，间距 8px
```

**实现方案选择：**

对比市面上的 Toast 实现方式：

| 方案 | 优点 | 缺点 | 采用 |
|------|------|------|------|
| React Context + Provider | 标准 React 模式 | 需要在组件树顶层包裹 Provider | ✗ |
| ReactDOM.createRoot 独立根 | 调用简单，不需要 Provider | React 18+ 才有 createRoot | ✅ |
| DOM 直接操作 | 最轻量 | 没有 React 组件能力 | ✗ |

**选择 createRoot 方案**，理由：
- React 19 项目，createRoot 可用
- 调用方式最简单：`toast.error('标题', '描述')`
- 不需要在 App.tsx 包裹 Provider
- 通知是临时 UI，不需要参与 React 状态管理

**样式实现：**

用 inline style 而不是 Tailwind class，因为 Toast 在独立 React 根中渲染，
Tailwind 的 CSS 可能不在作用域内（取决于 Vite 的 CSS 处理方式）。

```typescript
// 每条通知的样式
const notificationStyle: React.CSSProperties = {
  width: 320,
  padding: '12px 16px',
  borderRadius: 8,
  backgroundColor: '#fff',
  boxShadow: '0 6px 16px rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
  display: 'flex',
  gap: 12,
  position: 'relative',
  animation: 'toast-slide-in 0.3s ease-out',
}

// 类型对应的图标颜色
const typeColors = {
  success: '#52c41a',
  info: '#1677ff',
  warning: '#faad14',
  error: '#ff4d4f',
}

// 图标（用 SVG 对勾/感叹号/叉号/圆圈i）
// 或简单用 emoji/文字符号先实现
```

**动画 CSS：**

需要在 index.css 中追加：
```css
@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

#### 文件 2：`src/components/Toast/index.ts`

```typescript
export { toast } from './Toast'
```

### 2.4 影响范围

| 维度 | 影响 |
|------|------|
| 现有文件 | 无（index.css 追加一个 @keyframes，不影响现有样式） |
| 现有功能 | 无 |
| 构建 | 无新依赖 |

### 2.5 可能的 Bug

| Bug | 原因 | 应对 |
|-----|------|------|
| Toast 不显示 | createRoot 挂载时机问题 | 确保容器 DOM 在 toast() 调用前已创建 |
| 动画不生效 | @keyframes 在独立根中可能不生效 | 用 inline style 的 animation，不依赖 class |
| 多条通知重叠 | z-index 不够 | 固定容器 z-index: 10000 |
| 通知消失后 DOM 残留 | 移除逻辑有 bug | setTimeout 后用 unmount() 清理 |

---

## 三、阶段 1b：属性定义数据

### 3.1 需求

定义 12 个可编辑属性的配置信息，供 PropertyPanel 和 PropertyInput 使用。

### 3.2 新增文件

#### 文件：`src/config/propertyDefinitions.ts`

```typescript
export type PropertyType = 'number' | 'color' | 'select'

export interface PropertyDefinition {
  key: string           // 属性标识
  label: string         // 显示名称
  icon: string          // 图标字母（如 'W', 'H', 'BG'）
  type: PropertyType    // 输入类型
  unit?: string         // 单位（如 'px'），仅 number 类型
  // 验证
  validate: (value: string) => { valid: boolean; parsed?: any; error?: string }
  // 读取：从 node 上读取当前值
  read: (node: ComponentNode) => any
  // 写入：将值写入 node
  write: (node: ComponentNode, value: any) => Partial<ComponentNode> | { styles: Partial<CSSProperties> }
  // select 类型的选项
  options?: { label: string; value: string }[]
}
```

**12 个属性定义：**

| key | label | icon | type | unit | 存储位置 | 验证规则 |
|-----|-------|------|------|------|---------|---------|
| width | 宽度 | W | number | px | node.width | > 0 的正整数 |
| height | 高度 | H | number | px | node.height | > 0 的正整数 |
| backgroundColor | 背景色 | BG | color | — | node.styles | #xxx / #xxxxxx / #xxxxxxxx |
| color | 字体颜色 | T | color | — | node.styles | 同上 |
| fontSize | 字号 | A | number | px | node.styles | > 0 的正整数 |
| fontWeight | 字重 | B | select | — | node.styles | 100-900 或 normal/bold |
| borderWidth | 边框宽度 | OW | number | px | node.styles | >= 0 的整数 |
| borderRadius | 圆角 | OR | number | px | node.styles | >= 0 的整数 |
| borderColor | 边框颜色 | BC | color | — | node.styles | hex 格式 |
| borderStyle | 边框样式 | S | select | — | node.styles | solid/dashed/dotted/none |
| opacity | 透明度 | O | number | — | node.styles | 0-1 的小数 |
| fontFamily | 字体 | F | color | — | node.styles | 非空字符串 |

**注意：fontFamily 用 color 类型的输入框（纯文字输入），不是真的颜色。**

**验证函数实现思路：**

```typescript
// number 类型验证
const validateNumber = (min: number, allowFloat: boolean) => (value: string) => {
  if (value === '') return { valid: false, error: '请输入数值' }
  const num = allowFloat ? parseFloat(value) : parseInt(value, 10)
  if (isNaN(num)) return { valid: false, error: '请输入有效数值' }
  if (num < min) return { valid: false, error: `值不能小于 ${min}` }
  if (!allowFloat && num !== parseFloat(value)) return { valid: false, error: '请输入整数' }
  return { valid: true, parsed: num }
}

// color 类型验证
const validateColor = (value: string) => {
  const hex = value.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
    return { valid: false, error: '请输入 hex 颜色值，如 #ff0000 或 #f00' }
  }
  return { valid: true, parsed: hex }
}

// select 类型验证（其实不需要验证，选择器只返回合法值）
const validateSelect = (options: string[]) => (value: string) => {
  if (options.includes(value)) return { valid: true, parsed: value }
  return { valid: false, error: `请选择：${options.join('/')}` }
}
```

**read/write 实现思路：**

```typescript
// width/height：直接读写 node 属性
{
  read: (node) => node.width,
  write: (_node, value) => ({ width: value }),  // 返回 Partial<ComponentNode>
}

// styles 属性：读写 node.styles
{
  read: (node) => node.styles.backgroundColor,
  write: (_node, value) => ({ styles: { backgroundColor: value } }),
}

// 带单位的 styles 属性（fontSize, borderWidth 等）
// 读取时去掉 'px' 后缀，写入时加上
{
  read: (node) => {
    const v = node.styles.fontSize
    return typeof v === 'string' ? parseInt(v, 10) : v
  },
  write: (_node, value) => ({ styles: { fontSize: value + 'px' } }),
}
```

### 3.3 影响范围

| 维度 | 影响 |
|------|------|
| 现有文件 | 无 |
| 现有功能 | 无 |
| 构建 | 无新依赖 |

### 3.4 可能的 Bug

| Bug | 原因 | 应对 |
|-----|------|------|
| fontSize 读取值是 '16px' 而不是 16 | styles 里存的是带单位的字符串 | read 函数做 parseInt 转换 |
| 写入后样式不生效 | styles 的 key 名和 CSS 属性名不一致 | 参考现有 PropertyPanel 的写法确认 key 名 |
| fontWeight 的值类型混乱 | 有时是 number 有时是 string | 统一存为 string（'400', 'bold'） |

---

## 四、阶段 2：Store 扩展

### 4.1 需求

在 useCanvasStore 中新增编辑模式相关的状态和 action。

### 4.2 改动文件

#### 文件：`src/store/useCanvasStore.ts`

**新增状态：**

```typescript
interface CanvasStore {
  // ... 现有状态 ...

  // 新增：编辑模式
  editingNodeId: string | null           // 当前正在编辑的组件 ID
  editingSnapshot: Record<string, any> | null  // 编辑前的 props+styles 快照（用于空输入恢复）
}
```

**新增 action：**

```typescript
interface CanvasStore {
  // ... 现有 action ...

  // 进入编辑模式
  startEditing: (nodeId: string) => void

  // 退出编辑模式
  stopEditing: () => void

  // 修改组件样式（合并到现有 styles）
  updateNodeStyles: (id: string, styles: Partial<CSSProperties>) => void
  // ↑ 这个已存在，不需要新增。确认一下现有实现是否满足需求。
}
```

**startEditing 实现：**

```typescript
startEditing: (nodeId) => {
  const node = get().nodes.get(nodeId)
  if (!node) return
  // 快照当前 props 和 styles，用于空输入恢复
  set({
    editingNodeId: nodeId,
    editingSnapshot: {
      props: { ...node.props },
      styles: { ...node.styles },
      width: node.width,
      height: node.height,
    },
  })
},
```

**stopEditing 实现：**

```typescript
stopEditing: () => {
  set({
    editingNodeId: null,
    editingSnapshot: null,
  })
},
```

### 4.3 与 UIStore 的关系

现有的 `useUIStore` 里已经有：
- `showPropertyPanel: boolean`
- `propertyPanelTarget: string | null`
- `openPropertyPanel(targetId)` / `closePropertyPanel()`

新的 `editingNodeId` 和 `propertyPanelTarget` 功能重叠。

**决策：复用 UIStore 的现有状态，不在 CanvasStore 里重复。**

理由：
- `propertyPanelTarget` 已经在记录"正在编辑哪个组件"
- `showPropertyPanel` 已经在控制翻转
- 新增的 `editingSnapshot` 可以加到 UIStore 里

**最终改动：UIStore 扩展，不改 CanvasStore。**

```typescript
// useUIStore.ts 改动
interface UIStore {
  // 现有
  showPropertyPanel: boolean
  propertyPanelTarget: string | null
  isFlipping: boolean

  // 新增
  editingSnapshot: Record<string, any> | null

  // 现有 action
  openPropertyPanel: (targetId: string) => void
  closePropertyPanel: () => void
  setFlipping: (flipping: boolean) => void

  // 新增 action
  setEditingSnapshot: (snapshot: Record<string, any> | null) => void
}
```

### 4.4 影响范围

| 维度 | 影响 |
|------|------|
| useUIStore | 新增 1 个状态 + 1 个 action，不改现有逻辑 |
| useCanvasStore | 不改动 |
| 依赖 showPropertyPanel 的代码 | 无影响（只加东西不改东西） |

### 4.5 可能的 Bug

| Bug | 原因 | 应对 |
|-----|------|------|
| openPropertyPanel 没有同时设 snapshot | 忘记在 openPropertyPanel 里初始化 snapshot | 在 openPropertyPanel 实现中同时设 snapshot |
| snapshot 过期 | 组件被其他操作修改后 snapshot 是旧值 | snapshot 只在 openPropertyPanel 时取一次，编辑期间不更新 |

---

## 五、文件清单汇总

### 新增文件（3 个）

| 文件路径 | 用途 | 行数估计 |
|---------|------|---------|
| `src/components/Toast/Toast.tsx` | Toast 通知组件 + API | ~120 行 |
| `src/components/Toast/index.ts` | 导出 | ~3 行 |
| `src/config/propertyDefinitions.ts` | 12 个属性的定义、验证、读写 | ~150 行 |

### 改动文件（2 个）

| 文件路径 | 改动内容 | 改动量 |
|---------|---------|--------|
| `src/store/useUIStore.ts` | 新增 editingSnapshot + setEditingSnapshot | ~10 行 |
| `src/index.css` | 追加 toast-slide-in @keyframes | ~5 行 |

### 不动文件

| 文件路径 | 说明 |
|---------|------|
| `src/components/Dock/Dock.tsx` | 阶段 3 再动 |
| `src/components/Canvas/CanvasLayer.tsx` | 阶段 4 再动 |
| `src/store/useCanvasStore.ts` | 不动，用 UIStore |
| `src/App.tsx` | 不动 |

---

## 六、验证方式

| 验证项 | 方法 |
|--------|------|
| Toast 组件正常显示 | 在浏览器控制台调用 toast.error('测试', '描述') |
| Toast 样式和 antd 一致 | 视觉对比 |
| 属性定义数据正确 | 读代码 + TypeScript 类型检查 |
| Store 扩展不破坏现有功能 | npm run build 通过 + 画布拖拽/删除/滚动正常 |
| 输入值验证正确 | 手动测试各种非法输入 |

---

## 七、待确认

1. Toast 的图标用什么？antd 用 SVG 图标（圆形+对勾/感叹号/叉号），我建议第一版用简单的文字符号（✓ ℹ ⚠ ✕），后面再换 SVG。可以吗？

2. fontWeight 的 select 选项，我建议：100/200/300/400/500/600/700/800/900 + normal + bold。要加 bolder/lighter 吗？

3. fontFamily 输入框：用户输入什么就存什么（如 "Arial", "PingFang SC"），不做字体存在性验证。可以吗？
