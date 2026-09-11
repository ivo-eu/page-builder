import type { Point } from '../types/canvas'

/** 屏幕坐标 → 画布坐标 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  zoom: number,
  scrollLeft: number,
  scrollTop: number,
): Point {
  return {
    x: (clientX - canvasRect.left) / zoom + scrollLeft,
    y: (clientY - canvasRect.top) / zoom + scrollTop,
  }
}

/** 画布坐标 → 屏幕坐标 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  canvasRect: DOMRect,
  zoom: number,
  scrollLeft: number,
  scrollTop: number,
): Point {
  return {
    x: (canvasX - scrollLeft) * zoom + canvasRect.left,
    y: (canvasY - scrollTop) * zoom + canvasRect.top,
  }
}

/** 计算组件在画布上的绝对坐标（递归累加父容器坐标） */
export function getAbsolutePosition(
  nodeId: string,
  nodes: Map<string, any>,
): Point {
  const node = nodes.get(nodeId)
  if (!node) return { x: 0, y: 0 }

  let x = node.x
  let y = node.y
  let current = node

  while (current.parentId) {
    const parent = nodes.get(current.parentId)
    if (!parent) break
    x += parent.x
    y += parent.y
    current = parent
  }

  return { x, y }
}
