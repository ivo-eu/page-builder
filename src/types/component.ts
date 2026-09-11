import type { CSSProperties } from 'react'

/** 属性编辑器描述 */
export type PropSchema =
  | { key: string; kind: 'text'; default?: string; label?: string }
  | { key: string; kind: 'number'; default?: number; min?: number; max?: number; step?: number; label?: string }
  | { key: string; kind: 'color'; default?: string; label?: string }
  | { key: string; kind: 'select'; options: string[]; default?: string; label?: string }
  | { key: string; kind: 'boolean'; default?: boolean; label?: string }

/** 事件绑定（预留） */
export interface EventBinding {
  sourceId: string
  event: string
  targetId: string
  action: 'show' | 'hide' | 'toggle' | 'setData'
  payload?: any
}

/** 组件节点 */
export interface ComponentNode {
  id: string
  type: string
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  props: Record<string, any>
  styles: CSSProperties
  children: string[]
  isContainer: boolean
  locked: boolean
  visible: boolean
  eventBindings: EventBinding[]
}

/** 组件注册信息 */
export interface ComponentManifest {
  name: string
  displayName: string
  category: string
  icon: string
  package: string
  importName: string
  importPath: string
  isContainer: boolean
  defaultSize: { width: number; height: number }
  defaultProps: Record<string, any>
  propSchema: PropSchema[]
  render: React.ComponentType<any>
  renderExport?: (node: ComponentNode) => string
}
