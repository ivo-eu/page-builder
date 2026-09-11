const SCROLL_ZONE = 40
const MAX_SCROLL_SPEED = 12

export interface AutoScrollState {
  active: boolean
  speedX: number
  speedY: number
}

/**
 * 根据鼠标相对容器边缘的距离计算自动滚动速度
 */
export function calculateAutoScroll(
  mouseX: number,
  mouseY: number,
  containerRect: DOMRect,
): AutoScrollState {
  let speedX = 0
  let speedY = 0

  const distLeft = mouseX - containerRect.left
  const distRight = containerRect.right - mouseX
  const distTop = mouseY - containerRect.top
  const distBottom = containerRect.bottom - mouseY

  if (distLeft < SCROLL_ZONE && distLeft > 0) {
    speedX = -Math.ceil(((SCROLL_ZONE - distLeft) / SCROLL_ZONE) * MAX_SCROLL_SPEED)
  } else if (distRight < SCROLL_ZONE && distRight > 0) {
    speedX = Math.ceil(((SCROLL_ZONE - distRight) / SCROLL_ZONE) * MAX_SCROLL_SPEED)
  }

  if (distTop < SCROLL_ZONE && distTop > 0) {
    speedY = -Math.ceil(((SCROLL_ZONE - distTop) / SCROLL_ZONE) * MAX_SCROLL_SPEED)
  } else if (distBottom < SCROLL_ZONE && distBottom > 0) {
    speedY = Math.ceil(((SCROLL_ZONE - distBottom) / SCROLL_ZONE) * MAX_SCROLL_SPEED)
  }

  return {
    active: speedX !== 0 || speedY !== 0,
    speedX,
    speedY,
  }
}
