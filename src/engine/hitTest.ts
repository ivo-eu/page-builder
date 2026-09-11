import type { ComponentNode } from '../types/component'

/**
 * 检测画布坐标点落在哪个容器内
 * 优先返回最上层（children 数组中靠后）的容器
 */
export function hitTestContainer(
  canvasX: number,
  canvasY: number,
  nodes: Map<string, ComponentNode>,
  childrenIds: string[],
  excludeId?: string,
): string | null {
  // 从后往前遍历（越后面 z-index 越高）
  for (let i = childrenIds.length - 1; i >= 0; i--) {
    const node = nodes.get(childrenIds[i])
    if (!node || node.id === excludeId || !node.visible) continue

    if (
      node.isContainer &&
      canvasX >= node.x &&
      canvasX <= node.x + node.width &&
      canvasY >= node.y &&
      canvasY <= node.y + node.height
    ) {
      // 递归检测子容器
      const childHit = hitTestContainer(
        canvasX - node.x,
        canvasY - node.y,
        nodes,
        node.children,
        excludeId,
      )
      return childHit || node.id
    }
  }
  return null
}

/**
 * 检测画布坐标点落在哪个组件上（非容器也可命中）
 */
export function hitTestComponent(
  canvasX: number,
  canvasY: number,
  nodes: Map<string, ComponentNode>,
  childrenIds: string[],
  excludeId?: string,
): string | null {
  for (let i = childrenIds.length - 1; i >= 0; i--) {
    const node = nodes.get(childrenIds[i])
    if (!node || node.id === excludeId || !node.visible) continue

    if (
      canvasX >= node.x &&
      canvasX <= node.x + node.width &&
      canvasY >= node.y &&
      canvasY <= node.y + node.height
    ) {
      // 先递归检测子组件
      const childHit = hitTestComponent(
        canvasX - node.x,
        canvasY - node.y,
        nodes,
        node.children,
        excludeId,
      )
      return childHit || node.id
    }
  }
  return null
}
