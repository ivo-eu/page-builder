# Page Builder 技术方案文档

> 版本：v0.1 | 日期：2026-05-21
> 目标：拖拽式网页搭建工具，导出 React 源码

---

## 1. 技术栈

| 层面 | 选型 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 导出目标是 React 代码，用 React 做构建器最自然 |
| 构建 | Vite | 快速 HMR，开发体验好 |
| 状态管理 | Zustand | 轻量，原生支持 middleware，未来加 temporal 做撤销重做零阻力 |
| 样式 | Tailwind CSS | 构建器 UI 自身样式，快速开发 |
| 拖拽 | Pointer Events（原生） | 自由度最高，支持所有自定义动画效果 |
| 第三方组件样式隔离 | styled-components（antd 阶段引入） | CSS 作用域隔离，可选层不强制 |
| 代码导出 | 自实现 AST 拼接 | 控制力强，可精确生成目标代码 |

---

## 2. 目录结构

```
src/
├── components/                  # 构建器自身的 UI 组件
│   ├── Canvas/                  # 画布
│   │   ├── Canvas.tsx           # 画布主容器
│   │   ├── CanvasLayer.tsx      # 组件渲染层（递归渲染树）
│   │   ├── DragPreview.tsx      # 拖拽放置预览（虚线框）
│   │   └── useCanvasCoords.ts   # 坐标转换工具 hook
│   ├── Dock/                    # 底部栏
│   │   ├── Dock.tsx             # 苹果风格底部栏容器
│   │   ├── DockItem.tsx         # 底部栏组件项
│   │   └── useDockScroll.ts     # 中键滚动左右移动
│   ├── PropertyPanel/           # 属性编辑面板
│   │   ├── PropertyPanel.tsx    # 冒泡式属性面板
│   │   ├── editors/             # 各类型属性编辑器
│   │   │   ├── NumberEditor.tsx # 数字（宽高、z-index、圆角）
│   │   │   ├── ColorEditor.tsx  # 颜色取色器
│   │   │   ├── TextEditor.tsx   # 文本输入
│   │   │   └── SelectEditor.tsx # 枚举下拉
│   │   └── usePropertyPanel.ts  # 面板触发与定位逻辑
│   ├── TrashZone/               # 垃圾桶删除区
│   │   ├── TrashZone.tsx        # 垃圾桶容器 + 滑入动画
│   │   └── useTrashDrag.ts      # 拖拽进入判定 + 删除动画
│   └── Toolbar/                 # 顶部工具栏（极简，后续扩展）
│       └── Toolbar.tsx
├── builtin-components/          # 内置可拖拽组件
│   ├── Button/
│   │   ├── Button.tsx           # 渲染实现
│   │   └── manifest.ts          # 组件注册信息
│   ├── Text/
│   ├── Input/
│   ├── Image/
│   ├── Container/               # 可嵌套容器
│   ├── Modal/                   # 弹窗容器
│   └── Table/
├── registry/                    # 组件注册表
│   ├── ComponentRegistry.ts     # 注册表核心类
│   ├── types.ts                 # 注册信息类型定义
│   └── index.ts                 # 全局单例
├── store/                       # Zustand 状态管理
│   ├── useCanvasStore.ts        # 画布状态（组件树、选中、缩放）
│   ├── useDragStore.ts          # 拖拽状态（拖拽中、偏移量、预览位置）
│   └── useUIStore.ts            # UI 状态（面板开关、工具栏状态）
├── engine/                      # 核心引擎
│   ├── dragEngine.ts            # 拖拽引擎（Pointer Events 驱动）
│   ├── hitTest.ts               # 碰撞检测（判断鼠标在哪个容器内）
│   ├── autoScroll.ts            # 画布边缘自动滚动
│   └── coordinateTransform.ts   # 坐标系转换（屏幕 ↔ 画布）
├── export/                      # 代码导出
│   ├── generateReact.ts         # React 代码生成主逻辑
│   ├── generateImports.ts       # import 语句生成
│   ├── generateJSX.ts           # JSX 树生成
│   ├── generateStyles.ts        # 样式生成
│   └── template.ts              # 导出代码模板
├── config/                      # 全局配置
│   └── canvasConfig.ts          # 画布尺寸、缩放等配置
├── types/                       # 全局类型定义
│   ├── component.ts             # ComponentNode 类型
│   ├── canvas.ts                # 画布相关类型
│   └── events.ts                # 事件绑定类型（预留）
├── App.tsx
└── main.tsx
```

---

## 3. 核心数据结构

### 3.1 组件节点（ComponentNode）

```ts
interface ComponentNode {
  id: string                         // 唯一 ID（nanoid）
  type: string                       // 组件类型，对应注册表 name
  parentId: string | null            // 父容器 ID，null = 根层级
  x: number                          // 相对于 parentId 的 X 坐标（画布坐标系）
  y: number                          // 相对于 parentId 的 Y 坐标（画布坐标系）
  width: number                      // 组件宽度（px）
  height: number                     // 组件高度（px）
  props: Record<string, any>         // 组件属性（文本内容、图片 src 等）
  styles: CSSProperties              // 自定义 CSS 样式
  children: string[]                 // 子组件 ID 列表（仅 isContainer 类型有值）
  locked: boolean                    // 是否锁定（不可移动）
  visible: boolean                   // 是否可见
  eventBindings: EventBinding[]      // 事件绑定（预留，第一版为空数组）
}
```

### 3.2 画布状态（CanvasState）

```ts
interface CanvasState {
  nodes: Map<string, ComponentNode>  // 所有组件节点
  rootChildren: string[]             // 根层级子组件 ID 列表（渲染顺序 = z-index 顺序）
  selectedId: string | null          // 当前选中组件 ID
  hoveredId: string | null           // 当前 hover 组件 ID
  zoom: number                       // 缩放比例，默认 1
  scrollX: number                    // 画布水平滚动量
  scrollY: number                    // 画布垂直滚动量
}
```

### 3.3 拖拽状态（DragState）

```ts
interface DragState {
  isDragging: boolean
  source: 'dock' | 'canvas'         // 从底部栏拖入 or 画布内移动
  componentType: string | null       // dock 拖入时：组件类型
  sourceNodeId: string | null        // canvas 拖拽时：源节点 ID
  offsetX: number                    // 鼠标相对于组件左上角的偏移 X
  offsetY: number                    // 鼠标相对于组件左上角的偏移 Y
  previewX: number                   // 预览框在画布坐标系中的 X
  previewY: number                   // 预览框在画布坐标系中的 Y
  previewWidth: number               // 预览框宽度
  previewHeight: number              // 预览框高度
  targetContainerId: string | null   // 当前悬停的目标容器 ID
  overTrash: boolean                 // 是否悬停在垃圾桶上
}
```

### 3.4 组件注册信息（ComponentManifest）

```ts
interface ComponentManifest {
  name: string                       // 组件名（唯一标识）
  displayName: string                // 底部栏显示名
  category: string                   // 分类（'basic' | 'layout' | 'feedback' | ...）
  icon: string                       // 底部栏图标（SVG 或 emoji）
  package: string                    // npm 包名（内置为 ''，antd 为 'antd'）
  importName: string                 // import 名（如 '{ Button }'）
  importPath: string                 // import 路径（如 'antd'）
  isContainer: boolean               // 是否可接收子组件
  defaultSize: { width: number; height: number }
  defaultProps: Record<string, any>
  propSchema: PropSchema[]           // 可编辑属性描述
  render: React.ComponentType<any>   // 画布内渲染组件
  renderExport?: (node: ComponentNode) => string  // 自定义导出代码片段
}
```

### 3.5 属性描述（PropSchema）

```ts
type PropSchema =
  | { key: string; kind: 'text'; default?: string; label?: string }
  | { key: string; kind: 'number'; default?: number; min?: number; max?: number; step?: number; label?: string }
  | { key: string; kind: 'color'; default?: string; label?: string }
  | { key: string; kind: 'select'; options: string[]; default?: string; label?: string }
  | { key: string; kind: 'boolean'; default?: boolean; label?: string }
```

### 3.6 事件绑定（预留）

```ts
interface EventBinding {
  sourceId: string                   // 触发源组件 ID
  event: string                      // 事件名（'onClick' | 'onRowClick' | ...）
  targetId: string                   // 目标组件 ID
  action: 'show' | 'hide' | 'toggle' | 'setData'
  payload?: any                      // 动作参数
}
```

### 3.7 画布配置

```ts
interface CanvasConfig {
  designWidth: number                // 设计宽度，默认 1440
  designHeight: number               // 设计初始高度，默认 900
  minWidth: number                   // 最小宽度约束，默认 320
  autoGrow: boolean                  // 高度是否自动增长，默认 true
  autoGrowPadding: number            // 自动增长时底部留白，默认 200
  foldLineVisible: boolean           // 是否显示首屏折叠线，默认 true
}
```

---

## 4. 核心系统设计

### 4.1 坐标系转换

所有坐标统一经过转换函数，全局只有一套：

```ts
// engine/coordinateTransform.ts

/** 屏幕坐标 → 画布坐标 */
function screenToCanvas(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,     // 画布容器 getBoundingClientRect()
  zoom: number,
  scrollLeft: number,
  scrollTop: number
): { x: number; y: number } {
  return {
    x: (clientX - canvasRect.left) / zoom + scrollLeft,
    y: (clientY - canvasRect.top) / zoom + scrollTop,
  }
}

/** 画布坐标 → 屏幕坐标 */
function canvasToScreen(
  canvasX: number,
  canvasY: number,
  canvasRect: DOMRect,
  zoom: number,
  scrollLeft: number,
  scrollTop: number
): { x: number; y: number } {
  return {
    x: (canvasX - scrollLeft) * zoom + canvasRect.left,
    y: (canvasY - scrollTop) * zoom + canvasRect.top,
  }
}
```

组件在数据结构中存储的 x/y 始终是画布坐标系下的值，与 zoom 无关。

---

### 4.2 拖拽系统

基于 Pointer Events 实现，统一处理 dock → canvas 和 canvas 内移动两种场景。

#### 拖拽生命周期

```
pointerdown（按下）
  ├── 来源判断：dock 组件 or 画布上已有组件
  ├── 计算 offset = { x: mouseX - componentLeft, y: mouseY - componentTop }
  ├── 如果来自 dock：创建新组件节点，写入 store（尚未挂载到树）
  ├── 如果来自画布：记录 sourceNodeId
  └── 设置 isDragging = true

pointermove（移动）
  ├── 计算画布坐标：canvasPos = screenToCanvas(clientX, clientY, ...)
  ├── 计算预览位置：previewX = canvasPos.x - offsetX, previewY = canvasPos.y - offsetY
  ├── 更新 DragState（previewX, previewY）
  ├── hitTest：检测鼠标是否悬停在某个容器内
  │   ├── 命中容器 → targetContainerId = 容器ID，容器显示高亮边框
  │   └── 未命中 → targetContainerId = null，放在根层级
  ├── 检测是否进入垃圾桶区域 → overTrash
  │   ├── 进入 → 触发垃圾桶开盖动画 + 组件缩小动画
  │   └── 离出 → 反向动画
  └── autoScroll：鼠标接近画布边缘时自动滚动

pointerup（松开）
  ├── 如果 overTrash → 删除组件（如果是 canvas 移动）或丢弃（dock 拖入）
  ├── 否则 → 将组件挂载到目标位置
  │   ├── targetContainerId 存在 → 挂载为该容器的 child，坐标转换为相对于容器
  │   └── targetContainerId 为 null → 挂载到 rootChildren
  ├── 如果是新组件（从 dock 拖入）→ 组件正式出现在画布上
  ├── 如果是移动（从 canvas 拖拽）→ 更新组件坐标
  └── 清空 DragState，isDragging = false
```

#### 放置预览机制（方案三）

拖拽过程中，画布上不跟随鼠标渲染组件，而是显示一个**放置预览框**：

- 虚线边框 + 半透明背景
- 位置 = 松开鼠标后组件的真实位置
- 进入容器高亮区域时，预览框变为实线 + 容器背景色
- 在垃圾桶区域内时，预览框消失

用户看到预览框在哪，组件就在哪 → 所见即所得。

---

### 4.3 碰撞检测（HitTest）

```ts
// engine/hitTest.ts

/**
 * 检测画布坐标点落在哪个容器内
 * 优先返回最上层（z-index 最高）的容器
 */
function hitTest(
  canvasX: number,
  canvasY: number,
  nodes: Map<string, ComponentNode>,
  rootChildren: string[],
  excludeId?: string              // 排除正在拖拽的组件自身
): string | null {
  // 从后往前遍历（越后面 z-index 越高）
  for (let i = rootChildren.length - 1; i >= 0; i--) {
    const node = nodes.get(rootChildren[i])!
    if (node.id === excludeId) continue
    if (!node.isContainer) continue

    if (
      canvasX >= node.x &&
      canvasX <= node.x + node.width &&
      canvasY >= node.y &&
      canvasY <= node.y + node.height
    ) {
      // 递归检测子容器
      const childHit = hitTest(
        canvasX - node.x,
        canvasY - node.y,
        nodes,
        node.children,
        excludeId
      )
      return childHit || node.id
    }
  }
  return null
}
```

---

### 4.4 画布自动增长

```ts
// 画布高度自动增长逻辑

function checkAutoGrow(
  componentBottom: number,       // 新组件的底部 Y 坐标
  currentCanvasHeight: number,
  config: CanvasConfig
): number {
  if (!config.autoGrow) return currentCanvasHeight
  const threshold = currentCanvasHeight - 100   // 距底部 100px 时触发
  if (componentBottom > threshold) {
    return componentBottom + config.autoGrowPadding
  }
  return currentCanvasHeight
}
```

首屏折叠线固定在 designHeight（900px）位置，用虚线标注。

---

### 4.5 垃圾桶删除动画

两个并行模块：

**模块 1 — 垃圾桶容器：**

```tsx
// TrashZone/TrashZone.tsx

// 状态机：hidden → sliding_in → visible → hovered → sliding_out → hidden
// isDragging 变为 true 时，从顶部滑入（translateY: -100% → 0）
// overTrash 为 true 时：放大 1.2 倍 + SVG 切换为开盖状态
// isDragging 变为 false 时，滑出隐藏

// 检测逻辑：pointermove 中判断鼠标是否进入垃圾桶 rect
```

**模块 2 — 组件缩小动画：**

```ts
// 当 overTrash 为 true 时，对拖拽中的组件施加动画：

// transform-origin 设为鼠标光标相对于组件的位置
const originX = mouseX - componentRect.left
const originY = mouseY - componentRect.top
element.style.transformOrigin = `${originX}px ${originY}px`
element.style.transform = 'scale(0)'
element.style.opacity = '0'
element.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in'

// 如果鼠标在组件边缘导致 origin 偏出，fallback：
// 只做 opacity → 0（0.15s），模拟快速消失
```

pointerup 时如果 overTrash 为 true → 从 store 删除节点。
如果鼠标移出垃圾桶 → 组件恢复 scale(1) + opacity(1)。

---

### 4.6 属性编辑面板

**触发方式：**
- 桌面端：右键点击组件
- 移动端（预留）：长按组件

**触发流程：**

```
右键 / 长按
  → 阻止默认右键菜单
  → 组件播放震动动画（CSS animation: 2deg 来回快速旋转，0.3s）
  → 底部栏 CSS 3D transform 翻转（rotateX 180deg），背面渲染属性面板
  → 根据选中组件的 propSchema 渲染对应编辑器
```

**属性编辑器类型映射：**

| PropSchema.kind | 编辑器 | 交互 |
|----------------|--------|------|
| text | TextEditor | 输入框 |
| number | NumberEditor | 拖拽滑块 + 数字输入 |
| color | ColorEditor | 取色器弹窗 |
| select | SelectEditor | 下拉选择 |
| boolean | BooleanEditor | 开关 toggle |

**样式属性编辑（固定区域）：**

除了组件自身的 props，所有组件都共享一组 CSS 属性编辑：

  width, height, backgroundColor, color, fontSize,
  borderRadius, borderWidth, borderColor, zIndex,
  opacity, padding, margin

这些直接修改 ComponentNode.styles。

---

### 4.7 组件注册表

```ts
// registry/ComponentRegistry.ts

class ComponentRegistry {
  private manifests = new Map<string, ComponentManifest>()

  register(manifest: ComponentManifest) {
    this.manifests.set(manifest.name, manifest)
  }

  get(name: string): ComponentManifest | undefined {
    return this.manifests.get(name)
  }

  getAll(): ComponentManifest[] {
    return Array.from(this.manifests.values())
  }

  getByCategory(category: string): ComponentManifest[] {
    return this.getAll().filter(m => m.category === category)
  }

  /** 获取所有非内置组件的 import 信息，用于导出 */
  getExternalImports(): { package: string; importName: string }[] {
    return this.getAll()
      .filter(m => m.package !== '')
      .map(m => ({ package: m.package, importName: m.importName }))
  }
}

// 全局单例
export const registry = new ComponentRegistry()
```

内置组件在应用启动时注册：
```ts
// builtin-components/Button/manifest.ts
registry.register({
  name: 'Button',
  displayName: '按钮',
  category: 'basic',
  icon: '🔘',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 120, height: 40 },
  defaultProps: { children: 'Button' },
  propSchema: [
    { key: 'children', kind: 'text', default: 'Button', label: '文本' },
  ],
  render: BuiltinButton,
})
```

第三方组件（antd）未来注册示例：
```ts
registry.register({
  name: 'antd.Button',
  displayName: 'Button (Ant Design)',
  category: 'antd',
  icon: '🐜',
  package: 'antd',
  importName: '{ Button }',
  importPath: 'antd',
  isContainer: false,
  defaultSize: { width: 120, height: 32 },
  defaultProps: { children: 'Button', type: 'primary' },
  propSchema: [
    { key: 'children', kind: 'text', default: 'Button', label: '文本' },
    { key: 'type', kind: 'select', options: ['primary', 'default', 'dashed', 'link', 'text'], default: 'primary' },
    { key: 'size', kind: 'select', options: ['small', 'middle', 'large'], default: 'middle' },
  ],
  render: (props) => <StyledWrapper><antd.Button {...props} /></StyledWrapper>,
})
```

---

### 4.8 代码导出

导出的 React 代码格式（策略一：绝对定位）：

```tsx
import React from 'react';
// 第三方组件 import（自动从注册表提取）
// import { Button } from 'antd';

export default function MyPage() {
  return (
    <div style={{
      position: 'relative',
      width: '1440px',
      minHeight: '900px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
    }}>
      {/* 每个组件递归生成 */}
      <button style={{
        position: 'absolute',
        left: 100,
        top: 200,
        width: 120,
        height: 40,
      }}>
        Click me
      </button>

      {/* 容器组件包含子组件 */}
      <div style={{
        position: 'absolute',
        left: 300,
        top: 150,
        width: 400,
        height: 300,
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <p style={{ position: 'absolute', left: 20, top: 20 }}>
          Hello World
        </p>
        <button style={{ position: 'absolute', left: 20, top: 60 }}>
          Confirm
        </button>
      </div>
    </div>
  );
}
```

**导出流程：**

```
1. 遍历组件树（深度优先）
2. 对每个节点：
   a. 根据 type 查注册表获取 import 信息
   b. 生成 style 对象（position: absolute + x, y, width, height + 自定义 styles）
   c. 生成 props 对象（排除内部字段）
   d. 如果有 children → 递归生成子 JSX
   e. 根据注册表 renderExport 或默认逻辑拼接 JSX 字符串
3. 收集所有非内置组件的 import 语句，去重后放到文件顶部
4. 用模板拼接完整文件
```

---

### 4.9 底部栏（Dock）

**苹果风格底部栏设计：**

```
┌──────────────────────────────────────────────────────────┐
│                    [  画  布  区  域  ]                    │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   ☁️    📝    🖼️    📋    🔘    📦    📊   (可滚动)     │  ← 半透明底部栏
└──────────────────────────────────────────────────────────┘
```

- 背景：毛玻璃效果（backdrop-filter: blur(20px) + 半透明背景色）
- 位置：固定在底部，高度 72px
- 组件图标水平排列，鼠标中键滚动可左右平移
- hover 组件时轻微放大（scale 1.1）+ 上浮（translateY -4px）
- 按下开始拖拽时，图标缩小回原位

**鼠标中键滚动：**

```ts
// Dock/useDockScroll.ts
function useDockScroll(ref: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const el = ref.current
    el?.addEventListener('wheel', (e) => {
      e.preventDefault()
      el.scrollLeft += e.deltaY   // 纵向滚轮 → 横向滚动
    }, { passive: false })
  }, [])
}
```

---

### 4.10 Zustand Store 结构

```ts
// store/useCanvasStore.ts

interface CanvasStore {
  // 状态
  nodes: Map<string, ComponentNode>
  rootChildren: string[]
  selectedId: string | null
  canvasHeight: number
  zoom: number
  scrollX: number
  scrollY: number

  // 所有变更走 action（为未来撤销重做预留）
  addNode: (node: ComponentNode, parentId: string | null) => void
  removeNode: (id: string) => void
  updateNode: (id: string, changes: Partial<ComponentNode>) => void
  moveNode: (id: string, newParentId: string | null, newX: number, newY: number) => void
  selectNode: (id: string | null) => void
  setZoom: (zoom: number) => void
  setScroll: (x: number, y: number) => void
  setCanvasHeight: (height: number) => void

  // 树操作辅助
  getParent: (id: string) => ComponentNode | null
  getAbsolutePosition: (id: string) => { x: number; y: number }  // 递归计算画布绝对坐标
  getSiblings: (id: string) => ComponentNode[]
}
```

```ts
// store/useDragStore.ts

interface DragStore extends DragState {
  startDockDrag: (componentType: string, offsetX: number, offsetY: number) => void
  startCanvasDrag: (nodeId: string, offsetX: number, offsetY: number) => void
  updateDragPosition: (previewX: number, previewY: number) => void
  setTargetContainer: (containerId: string | null) => void
  setOverTrash: (over: boolean) => void
  endDrag: () => void
}
```

---

## 5. 关键交互流程

### 5.1 从底部栏拖入组件

```
用户按下底部栏组件图标
  → pointerdown 记录 offset
  → 鼠标旁出现组件完整样子（不是缩小图标，是真实大小）
  → pointermove
      → 计算画布坐标和预览位置
      → 画布上显示虚线预览框
      → hitTest 检测是否进入容器
      → 检测是否进入垃圾桶
  → pointerup
      → 如果在垃圾桶上 → 丢弃
      → 否则 → addNode 到 store → 组件出现在画布上
```

### 5.2 画布内移动组件

```
用户按下画布上已有组件
  → pointerdown
      → 记录 offset（鼠标相对于组件左上角）
      → 选中组件
  → 组件微微移动（位移量 = 鼠标移动量）
  → pointermove
      → 同上（预览框 + hitTest + 垃圾桶检测）
  → pointerup
      → moveNode 更新坐标
      → 如果在容器内 → 更新 parentId
      → 如果在垃圾桶上 → removeNode
```

### 5.3 编辑组件属性

```
右键点击组件
  → selectNode
  → 组件震动动画（0.3s）
  → 底部栏翻转 → 属性面板
  → 用户编辑属性 → updateNode 实时更新
  → 右键空白处或点击画布 → 关闭面板，底部栏翻回
```

---

## 6. 未来扩展兼容性清单

| 功能 | 当前预留 | 未来接入点 |
|------|---------|-----------|
| 缩放 | 坐标转换公式已含 zoom，zoom 默认 1 | 画布加 `transform: scale(zoom)`，修改 zoom 值即可 |
| 调整大小 | 数据结构有 width/height | 选中时渲染四角手柄，pointermove 更新尺寸 |
| 撤销重做 | 所有变更走 Zustand action | 引入 zustand-temporal middleware |
| 事件绑定 | eventBindings 预留空数组 | 实现 EventBinding 数据结构 + 事件引擎 |
| 多设备尺寸 | canvasConfig 存 designWidth/Height | UI 上加设备切换，切换 canvasConfig |
| 第三方组件 | 注册表 + render 字段 | 注册 antd 组件，styled-components 包裹 |
| Figma MCP | 注册表标准化 | MCP 解析 figma 数据 → 生成 manifest → 注册 |
| 移动端长按 | 事件处理 hook 统一 | useComponentInteraction 内加 touch 判断 |
| 宽度扩展 | 自动缩放方案已设计 | canvasConfig 改 designWidth + 自动 zoom 计算 |
| 嵌套 | 数据结构为树形 | 容器 hitTest 已实现，UI 层渲染递归即可 |

---

## 7. 第一版实现范围（MVP）

**做：**
- [x] 项目初始化（React + TS + Vite + Tailwind + Zustand）
- [x] 画布（1440×900，固定宽度，高度自增长，首屏虚线）
- [x] 底部栏（苹果风格，毛玻璃，中键滚动）
- [x] 内置组件 5 个：Button, Text, Input, Image, Container
- [x] 拖拽放置（dock → canvas，预览框方案）
- [x] 画布内移动组件
- [x] 垃圾桶删除（滑入 + 开盖 + 缩小动画）
- [x] 属性编辑（右键触发，底部栏翻转，基础编辑器）
- [x] React 代码导出（绝对定位，一键复制）

**不做但架构兼容：**
- 缩放、调整大小、撤销重做
- 嵌套放置（Container 可拖入但暂不支持拖入 Container 内）
- 第三方组件导入
- 事件绑定
- 移动端适配

---

## 8. 风险与注意事项

| 风险 | 应对 |
|------|------|
| Pointer Events 在 iframe 内行为异常 | 画布不使用 iframe，直接在主文档渲染 |
| 拖拽性能（大量组件时 pointermove 频率高） | pointermove 内用 requestAnimationFrame 节流 |
| 组件样式污染画布 UI | 内置组件样式用 CSS Modules 隔离 |
| getBoundingClientRect 在 transform: scale 下返回缩放值 | 坐标转换公式已处理（除以 zoom） |
| 底部栏和画布的 z-index 层叠 | 底部栏 z-index: 9999，画布 z-index: 1 |
| 导出代码中 className 可能冲突 | 导出时不用 className，全用 inline style |
