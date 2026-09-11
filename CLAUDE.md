# Page Builder — AI Context File

## 项目概述

拖拽式网页搭建工具。用户从底部栏拖拽组件到画布上，所见即所得，最终导出 React 源码。

设计理念：极简风格，底部栏模仿 macOS Dock，画布模拟真实网页尺寸。

---

## 防幻觉规则

1. 如果你对某个问题的答案不确定，或者信息不在提供的上下文、代码库或知识范围内，**必须明确回复"不确定"或"我不知道"**，不要编造任何看起来合理的答案。**同时给出验证方案**（"我可以查 X 文件"或"你可以执行 Y 命令来确认"），不要说完"不知道"就结束。
2. 永远不要虚构 API、函数、配置参数、版本号或命令，除非你能在项目中实际找到它们。
3. 所有回答必须严格基于：当前项目的实际文件内容、用户在本轮对话中明确提供的信息、你已知的可验证的公开文档（并注明出处）。
4. 如果某个技术细节在上述来源中找不到，请申明你无法确认，不要推测。
5. 当回答涉及代码修改、命令执行或外部依赖时，**必须先读取相关文件确认内容，再指向项目中的具体文件（如路径+行数）或命令来源**。不能凭记忆引用代码。
6. 不要声称某个配置或代码"应该可以工作"或"通常没问题"，除非你能在项目里找到确切依据。
7. 修改建议必须是可操作、可验证的，并附带风险说明。
8. 在给出任何代码或命令之前，先复述你对需求的理解，并让用户确认。
9. 如果某个回答依赖未提供的环境信息（如操作系统版本、数据库型号），主动提问澄清，而不是假设一个常见值。
10. 工具调用（读文件、执行命令）失败时必须如实报告，不能用假设内容填补空白。
11. 当代码实际内容与用户描述矛盾时，以代码为准，同时指出差异让用户决定。
12. 区分"通用技术知识"和"项目特定细节"。前者可以基于训练数据回答，后者（项目中的函数名、参数、配置值）必须在代码中验证后才能断言。

---

## ⚠️ 未来功能 — 当前不做但架构必须兼容

### 1. 缩放（Zoom）

- 坐标转换公式已预留 zoom 参数：`canvasX = (clientX - rect.left) / zoom + scrollLeft`
- zoom 默认值为 1，不影响当前逻辑
- 实现时只需：画布 CSS 加 `transform: scale(zoom); transform-origin: top left`
- `getBoundingClientRect()` 在 scale 下返回缩放后的值，公式已处理（除以 zoom）
- 数据结构中存的坐标始终是画布坐标系，与 zoom 无关

### 2. 组件调整大小（Resize）

- 数据结构已有 width/height，天然兼容
- 实现时：选中组件时渲染四角小方块手柄，pointermove 中根据拖拽方向计算新 width/height
- 需约束 min-width/min-height

### 3. 撤销/重做（Undo/Redo）

- **关键约束：所有状态变更必须走 Zustand action 函数，禁止直接 mutate state**
- 未来引入 `zustand-temporal` middleware 即可零成本接入
- 如果有直接 mutate 的地方，undo/redo 会失效且难以调试

### 4. 事件绑定系统

- ComponentNode 中已预留 `eventBindings: EventBinding[]`，第一版为空数组
- 事件绑定和静态布局完全解耦
- 未来实现时需要：事件/动作状态机，支持 show/hide/toggle/setData 等动作
- 典型场景：点击表格某行 → 弹出 Modal

### 5. 多设备尺寸

- canvasConfig 中存储 designWidth/designHeight（默认 1280×800，16:10）
- designHeight 是**初始默认高度，不是固定值**，画布用 minHeight 而非 height
- autoGrow 开启后，组件靠近底部时自动增长（+200px），画布高度只增不减
- 折叠线始终固定在 designHeight 位置，标记首屏边界
- 所有布局计算引用 canvasConfig，不写死数字
- 未来切换设备只需改 config

### 6. 宽度扩展 / 大屏适配

- 方案：自动缩放适配 + 手动 1:1 切换
- 如果 designWidth > 可视区域宽度：zoom = 可视区域宽度 / designWidth
- 画布用 `transform: scale(zoom)` 缩小，视觉完整展示
- 用户可切换到 1:1 视图（水平滚动条）
- 和 zoom 功能是同一个机制

### 7. 第三方组件导入（antd）

- 三步走战略：①内置组件 ②Figma MCP导入 ③antd导入
- 主架构：组件注册表（ComponentRegistry），render 字段渲染组件
- antd 阶段引入 styled-components 做样式隔离包裹
- 注册时声明 package/importName/importPath，导出时自动生成 import 语句
- 布局精确性：用 ResizeObserver 测量实际渲染尺寸，同步回数据结构
- **架构关键：styled-components 是可选层，不是必须层。内置组件不依赖它**

### 8. Figma MCP 导入

- 解析 Figma 数据 → 生成 ComponentManifest → 注册进 ComponentRegistry
- 不涉及数据接口和交互 API，相对简单

### 9. 移动端长按支持

- 当前：桌面端右键编辑组件属性
- 架构：事件处理统一抽成 `useComponentInteraction` hook
- 未来在 hook 内部加 touch 事件判断（长按 500ms 触发）
- 右键在移动端不存在，长按是唯一替代

### 10. 嵌套组件深入

- 数据结构已支持树形嵌套（parentId + children）
- 容器组件（Container, Modal）的 isContainer = true
- hitTest 碰撞检测已实现递归查找最上层容器
- 当前 MVP：Container 可拖入画布，但暂不支持拖入 Container 内部
- 未来：拖拽时 hitTest 检测到容器 → 容器高亮 → 放置后成为子组件 → 坐标转为相对坐标

### 11. JSON 导入（外部页面搭建器兼容）

- 当前状态：仅架构预留，不实现
- 用户意图：未来可能从其他页面搭建器（Figma、Gutenberg、Retool 等）导入 JSON 直接转为画布组件
- 预留内容：`src/types/import.ts` 定义了 ImportSource、ImportAdapter、ImportResult 接口
- 实现时需要：针对每种 JSON 格式写一个 Adapter（detect + transform），注册到适配器列表
- 适配层原理：外部 JSON → Adapter 解析 → ComponentNode[] → 画布渲染
- 用户尚未确定具体兼容哪种 JSON 格式，确定后写对应 Adapter

---

## ⚠️ 关键架构约束

### 坐标系统

- 全局只有一套坐标转换函数（engine/coordinateTransform.ts）
- 屏幕坐标 → 画布坐标：`canvasX = (clientX - rect.left) / zoom + scrollLeft`
- 组件数据中存的 x/y 是相对于 parentId 的画布坐标系值
- 计算组件在画布上的绝对坐标需要递归向上累加父容器坐标
- **禁止在组件内散落坐标计算逻辑**

### 状态管理

- 所有状态变更走 Zustand action（为 undo/redo 预留）
- CanvasStore：组件树、选中、缩放
- DragStore：拖拽状态
- UIStore：面板开关、工具栏状态
- **禁止直接修改 store 中的 Map/Object，必须通过 set() 返回新引用**

### 拖拽系统

- 基于 Pointer Events（不用 HTML5 Drag API）
- 拖拽过程中画布上显示放置预览框（虚线），不是跟随鼠标的组件
- 用户看到预览框在哪，松开后组件就在哪（方案三）
- offset 在 pointerdown 时计算一次，全程不变

### 组件注册

- 内置组件在应用启动时注册到全局 ComponentRegistry 单例
- 第三方组件用同一套注册表，render 内部可选择 styled-components 包裹
- 注册信息包含：name, package, importName, importPath, isContainer, defaultSize, defaultProps, propSchema, render

### 代码导出

- 策略一：绝对定位导出（高保真，1:1 映射）
- 导出容器 `position: relative; width: {designWidth}px`
- 每个组件 `position: absolute; left/top/width/height`
- 全用 inline style，不用 className（避免冲突）
- 第三方组件从注册表提取 import 语句
- **⚠️ 等比例缩放待验证**：fontSize、borderWidth 等属性在画布上通过 scale(zoom) 视觉缩放，导出时直接使用设计坐标值。需要在实现导出功能时验证：当 zoom ≠ 1 时，输入的 fontSize 和 borderWidth 在导出后的网页上是否表现一致。属性面板输入的值 = 设计坐标值 = 导出 CSS 值，不做额外换算。

### 样式隔离

- 构建器 UI：Tailwind CSS
- 内置组件：CSS Modules 或 Tailwind
- 第三方组件：styled-components 包裹（antd 阶段引入）
- 画布和底部栏用 z-index 分层（画布 1，底部栏 9999）

---

## ⚠️ 已知风险

| 风险 | 应对 |
|------|------|
| Pointer Events 在 iframe 内行为异常 | 画布不使用 iframe |
| 拖拽性能（大量组件时 pointermove 频率高） | 用 requestAnimationFrame 节流 |
| getBoundingClientRect 在 transform: scale 下返回缩放值 | 坐标公式已处理（除以 zoom） |
| 垃圾桶缩小动画 transform-origin 偏出 | fallback 到快速透明（opacity → 0） |
| antd 样式污染画布 UI | styled-components 作用域隔离 |
| 导出代码 className 冲突 | 全用 inline style |
