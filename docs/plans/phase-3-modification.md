# 属性编辑功能 — 阶段 3 修改记录

> 日期：2026-05-28
> 状态：构建通过，待浏览器验证

---

## 一、修改文件清单

### 新增文件（5 个）

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/components/Dock/useDockScroll.ts` | 107 | 循环滚动 hook，ComponentListPanel 和 PropertyPanel 复用 |
| `src/components/Dock/ComponentListPanel.tsx` | 108 | 从 Dock 提取的组件列表面板（正面内容） |
| `src/components/PropertyInput/PropertyInput.tsx` | 212 | 三种输入框：NumberInput / ColorInput / SelectInput |
| `src/components/PropertyInput/index.ts` | 1 | 导出 |

### 改动文件（2 个）

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/components/Dock/Dock.tsx` | 完全重写（249行→68行） | 从"正面+背面+RAF+DockItem"重构为纯容器 |
| `src/components/PropertyPanel/PropertyPanel.tsx` | 完全重写（202行→203行） | 从"水平flex编辑器"改为"循环滚动属性列表+弹出输入框" |

### 未动文件

App.tsx, Canvas.tsx, CanvasLayer.tsx, useCanvasStore.ts, useUIStore.ts, index.css, 所有 builtin-components, Toast, propertyDefinitions。

---

## 二、架构变更

### 旧架构
```
Dock.tsx（249行，所有逻辑混在一起）
  └ perspective + rotateX 翻转
    ├ 正面：RAF + track + hover + DockItem（内联）
    └ 背面：PropertyPanel（水平 flex，内联编辑器）
```

### 新架构
```
Dock.tsx（68行，纯容器）
  └ perspective + rotateX 翻转（保留）
    ├ 正面：ComponentListPanel（独立组件）
    └ 背面：PropertyPanel（独立组件，循环滚动 + 弹出输入框）

useDockScroll.ts（共享 hook）
  ├ ComponentListPanel 使用
  └ PropertyPanel 使用
```

---

## 三、代码自审

### ✅ 正确性

| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | ✅ 通过 |
| Vite 构建 | ✅ 通过（506ms） |
| useDockScroll 逻辑 | ✅ 和原 Dock.tsx 的 RAF 循环完全一致 |
| ComponentListPanel 逻辑 | ✅ 和原 Dock 正面完全一致 |
| Dock 容器结构 | ✅ 保留了 perspective + rotateX + backfaceVisibility |
| PropertyPanel 循环滚动 | ✅ 复用 useDockScroll |
| 输入框弹出定位 | ✅ getBoundingClientRect + portal 到 body |
| 数据写入路径 | ✅ width/height → updateNode, styles → updateNodeStyles |
| 空输入处理 | ✅ 空输入时不提交（恢复原值） |
| 非法输入处理 | ✅ toast.error 显示错误信息 |
| select 类型 | ✅ 选中后立即生效 |
| 一次一个输入框 | ✅ 点其他 PropertyItem 时切换 |

### ⚠️ 注意事项

1. **CSSProperties vs CSSStyleDeclaration 类型不兼容**
   - 问题：updateNodeStyles 的参数类型是 `Partial<CSSStyleDeclaration>`，但 propertyDefinitions 的 write 返回 `Partial<CSSProperties>`。两者的 `animation` 属性类型不同。
   - 处理：用 `as any` 强制转换。
   - 根本原因：store 的 updateNodeStyles 应该用 `Partial<CSSProperties>` 而不是 `Partial<CSSStyleDeclaration>`。后续可修复 store 的类型定义。

2. **fontFamily 复用 NumberInput 而不是 ColorInput**
   - 在 PropertyPanel 的 renderPopup 中，fontFamily（type='color' 但 key='fontFamily'）用 NumberInput 渲染（纯文字输入，没有颜色预览方块）。
   - 这比用 ColorInput（带颜色方块）更合理。

3. **select 类型的弹出框定位**
   - SelectInput 的弹出框在 PropertyItem 上方（transform: translateY(-100%)）。
   - 如果 item 在面板最左侧，弹出框可能超出屏幕左边缘。
   - 暂不做边界检测，后续优化。

4. **编辑模式的触发还未接入**
   - 阶段 3 只做了面板和输入框的 UI。
   - 右键/长按触发编辑（openPropertyPanel）在阶段 4 做。
   - 目前需要手动调用 `useUIStore.getState().openPropertyPanel('节点ID')` 来测试。

### ❌ 需要浏览器验证的内容

1. **正面组件列表的滚动是否正常**（最关键）
   - 拖拽组件到画布
   - 循环滚动
   - hover 放大

2. **翻转动画是否正常**
   - 触发 openPropertyPanel 后是否翻转到背面
   - 背面的属性列表是否显示

3. **属性面板的滚动**
   - 12 个属性是否循环滚动
   - hover 放大效果

4. **输入框弹出**
   - 点击属性项后输入框是否在正确位置弹出
   - 数值型输入框是否有 px 单位
   - 颜色型输入框是否有颜色预览方块
   - 选择器是否正确显示选项

---

## 四、测试方法

由于阶段 4（右键/长按触发）还没做，需要在浏览器控制台手动触发翻转：

```javascript
// 在控制台执行
// 先在画布上放一个组件，记下它的 ID（可以从 DOM 的 data-component-id 属性获取）
useUIStore.getState().openPropertyPanel('你的组件ID')
```

或者临时在 App.tsx 加一个测试按钮：

```tsx
import { useUIStore } from './store'

// 在 return 中加：
<button onClick={() => useUIStore.getState().openPropertyPanel('xxx')}>
  测试属性面板
</button>
```

验证完告诉我结果。
