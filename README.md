# Page Builder

拖拽式网页搭建工具。用户从底部栏拖拽组件到画布上，所见即所得，最终导出 React 源码。

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand

## 命令

```
npm run dev      # 启动开发服务器
npm run build    # 类型检查 + 构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

## 项目结构

```
src/
├── App.tsx                        # 根组件
├── index.css                      # 全局样式、CSS 变量
├── registry/                      # 组件注册表
├── store/                         # Zustand 状态管理
├── engine/                        # 坐标转换引擎
├── config/                        # 画布配置
├── types/                         # TypeScript 类型定义
├── builtin-components/            # 14 个内置组件
└── components/
    ├── Canvas/                    # 画布（主编辑区）
    ├── Dock/                      # 底部栏（组件选择 + 属性编辑）
    ├── TrashZone/                 # 垃圾桶
    ├── PropertyPanel/             # 属性面板
    └── Toolbar/                   # 工具栏
```

## 设计理念

- 极简风格，底部栏模仿 macOS Dock
- 画布模拟真实网页尺寸（designWidth: 1280px）
- 所见即所得，组件属性修改立即生效

## ⚠️ 待验证事项（导出阶段）

### 等比例缩放

画布（designWidth 1280px）和实际网页是等比例关系。以下属性在导出时需要验证等比缩放是否正确：

- **fontSize**：画布上的字号是否和导出后的真实网页一致
- **borderWidth**：画布上的边框粗细是否和导出后一致
- **width / height**：组件尺寸是否和导出后一致

当前设计：属性面板输入的值 = 设计坐标值 = 导出时的 CSS 值。画布显示层通过 `transform: scale(zoom)` 做视觉缩放，属性面板和导出层不参与换算。

需要在实现导出功能时验证：当画布缩放比例不为 1 时，输入的 fontSize 和 borderWidth 在导出后的网页上是否表现一致。

## Symphony 测试通道

此分支也验证从重建的 WSL 通道创建 GitLab MR。
