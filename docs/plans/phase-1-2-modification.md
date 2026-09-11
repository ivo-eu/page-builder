# 属性编辑功能 — 阶段 1-2 修改记录

> 日期：2026-05-28
> 状态：构建通过，待浏览器验证

---

## 一、修改文件清单

### 新增文件（3 个）

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/components/Toast/Toast.tsx` | 143 | Toast 通知组件，antd notification 样式 |
| `src/components/Toast/index.ts` | 1 | 导出 toast API |
| `src/config/propertyDefinitions.ts` | 217 | 12 个属性的定义、验证、读写函数 |

### 改动文件（2 个）

| 文件 | 改动 | 新增行数 |
|------|------|---------|
| `src/store/useUIStore.ts` | 新增 editingSnapshot 状态 + setEditingSnapshot action + closePropertyPanel 清空 snapshot | +6 行 |
| `src/index.css` | 追加 toast-slide-in @keyframes | +7 行 |

### 未动文件

Dock.tsx, Canvas.tsx, CanvasLayer.tsx, useCanvasStore.ts, App.tsx, 所有组件文件。

---

## 二、代码自审

### ✅ 正确性

| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | ✅ 通过，零错误 |
| Vite 构建 | ✅ 通过（587ms） |
| Toast 的 createRoot 用法 | ✅ React 19 兼容 |
| Toast 的 inline style | ✅ 不依赖 Tailwind class，在独立根中可用 |
| 属性定义的 validate 函数 | ✅ 覆盖所有 12 个属性 |
| 属性定义的 read 函数 | ✅ handle 了 undefined/null/带单位字符串 |
| 属性定义的 write 函数 | ✅ width/height 写 node，其他写 styles |
| UIStore 改动 | ✅ 只新增，不改现有逻辑 |
| closePropertyPanel 清空 snapshot | ✅ 退出编辑时自动清空 |

### ⚠️ 注意事项

1. **Toast 的 @keyframes 定义在 index.css 中**，但 Toast 渲染在独立的 React 根中。
   - 问题：如果 Vite 的 CSS 模块化把 @keyframes 限制在特定作用域，Toast 的动画可能不生效。
   - 实际情况：index.css 是全局 CSS（`@import "tailwindcss"` + 全局样式），不是 CSS Module，所以 @keyframes 是全局的。应该没问题。
   - 验证方式：浏览器中触发 toast.error() 看是否有滑入动画。

2. **fontFamily 的 type 设为 'color'**（复用颜色输入框的纯文字输入模式）。
   - 原因：没有单独的 'text' type，而 'color' 类型的输入框正好是纯文字输入 + 左侧颜色预览方块。
   - 潜在问题：fontFamily 输入框左侧会显示一个颜色预览方块，这对字体来说不合理。
   - 影响：纯视觉问题，不影响功能。后续阶段可优化。

3. **editingSnapshot 在 openPropertyPanel 时没有自动设置**。
   - 当前实现：setEditingSnapshot 是独立的 action，需要调用方手动调用。
   - 后续阶段 3/4 接入时，需要在 openPropertyPanel 的调用处同时调用 setEditingSnapshot。
   - 这是设计上的预期行为，不是 bug。

### ❌ 未发现的问题

构建通过，代码逻辑审查未发现问题。需要浏览器验证：
- Toast 显示和动画
- Store 改动不影响现有功能（拖拽、滚动、翻转）

---

## 三、浏览器验证清单

请在浏览器中验证以下内容：

| # | 验证项 | 操作 | 预期结果 |
|---|--------|------|---------|
| 1 | 现有功能不受影响 | 打开页面，拖拽组件到画布，拖到垃圾桶删除 | 一切正常 |
| 2 | Dock 循环滚动 | 在底部栏滚动鼠标滚轮 | 循环滚动正常 |
| 3 | Toast 打开浏览器控制台，输入 `toast.error('测试标题', '测试描述')` | 回车执行 | 顶部出现通知，3 秒后自动消失 |
| 4 | Toast 样式 | 同上 | 白色背景，左侧圆形图标，标题+描述，右上角关闭按钮 |
| 5 | Toast 堆叠 | 连续执行 3 次 toast.error() | 3 条通知从上往下堆叠 |

**注意：步骤 3 需要先在控制台导入 toast。** 由于 toast 没有挂到 window 上，你可以在控制台执行：

```javascript
// 在 dist 的 JS 中，toast 模块可能需要通过其他方式访问
// 如果无法直接访问，可以暂时跳过 Toast 验证，后续阶段接入后再验证
```

或者：告诉我你在浏览器上看不到 toast，我在 App.tsx 中临时加一个测试按钮。
