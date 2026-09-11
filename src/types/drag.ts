/** 拖拽来源 */
export type DragSource = 'dock' | 'canvas'

/** 拖拽状态 */
export interface DragState {
  isDragging: boolean
  source: DragSource
  componentType: string | null
  sourceNodeId: string | null
  offsetX: number
  offsetY: number
  previewX: number
  previewY: number
  previewWidth: number
  previewHeight: number
  targetContainerId: string | null
  overTrash: boolean
}
