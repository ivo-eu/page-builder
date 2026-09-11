import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../../store'

const EDGE_THRESHOLD = 8

/**
 * Bottom-edge drag to resize canvas height.
 * Pure DOM — no React state, no re-renders.
 *
 * Enlarging: canvas bottom follows mouse (direct).
 * Shrinking: auto-shrink at speed proportional to drag distance.
 */
export function useCanvasResize(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  scrollRef: React.RefObject<HTMLDivElement | null>,
) {
  const isResizing = useRef(false)
  const rafId = useRef(0)
  const indicatorRef = useRef<HTMLDivElement | null>(null)

  function showIndicator(width: number, height: number) {
    if (!indicatorRef.current) {
      const el = document.createElement('div')
      el.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10001;
        pointer-events: none;
        animation: trash-slide-in 0.25s ease-out;
      `
      const inner = document.createElement('div')
      inner.style.cssText = `
        padding: 6px 14px;
        border-radius: 20px;
        background: rgba(0,0,0,0.75);
        color: #fff;
        font-size: 12px;
        font-family: "SF Mono", monospace;
        font-weight: 500;
        letter-spacing: 0.5;
        white-space: nowrap;
      `
      el.appendChild(inner)
      document.body.appendChild(el)
      indicatorRef.current = el
    }
    const inner = indicatorRef.current.firstChild as HTMLDivElement
    inner.textContent = `${width} × ${height}`
  }

  function hideIndicator() {
    if (indicatorRef.current) {
      indicatorRef.current.remove()
      indicatorRef.current = null
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onMouseMove(e: MouseEvent) {
      if (isResizing.current) return
      const rect = canvas!.getBoundingClientRect()
      const y = e.clientY - rect.top
      const near = y >= rect.height - EDGE_THRESHOLD && y <= rect.height + 2
      canvas!.style.cursor = near ? 'row-resize' : ''
    }

    function onMouseLeave() {
      if (!isResizing.current) canvas!.style.cursor = ''
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const rect = canvas!.getBoundingClientRect()
      const y = e.clientY - rect.top
      if (y < rect.height - EDGE_THRESHOLD) return

      e.preventDefault()
      e.stopPropagation()

      canvas!.setPointerCapture(e.pointerId)
      isResizing.current = true
      canvas!.style.cursor = 'row-resize'

      // Sync store height to actual rendered height (minHeight may have been exceeded by content)
      const actualHeight = canvas!.getBoundingClientRect().height
      useCanvasStore.getState().setCanvasHeight(actualHeight)

      startY = e.clientY
      lastY = e.clientY
      startMode = 'none'

      const state = useCanvasStore.getState()
      showIndicator(state.config.designWidth, Math.round(state.canvasHeight))

      // Main RAF loop: handles auto-grow, auto-shrink and auto-scroll
      function tick() {
        const state = useCanvasStore.getState()
        const scrollEl = scrollRef.current

        if (startMode === 'grow') {
          // Auto-grow: speed based on distance from start
          const distance = lastY - startY
          const absDist = Math.abs(distance)
          const speed = Math.pow(absDist / 150, 4) * 30
          const newH = state.canvasHeight + speed
          state.setCanvasHeight(newH)
          showIndicator(state.config.designWidth, Math.round(newH))

          // Auto-scroll: keep up with growing canvas
          if (scrollEl && lastY > window.innerHeight * 0.6) {
            scrollEl.scrollTop += 6
          }
        }

        if (startMode === 'shrink') {
          // Find lowest component bottom edge
          let contentBottom = 0
          state.nodes.forEach((node) => {
            if (!node.visible) return
            const absPos = state.getAbsolutePos(node.id)
            const bottom = absPos.y + node.height
            if (bottom > contentBottom) contentBottom = bottom
          })

          const minHeight = Math.max(state.config.designHeight, contentBottom)

          const distance = lastY - startY
          const absDist = Math.abs(distance)
          const speed = Math.pow(absDist / 200, 4) * 60
          const newH = Math.max(minHeight, state.canvasHeight - speed)
          state.setCanvasHeight(newH)
          showIndicator(state.config.designWidth, Math.round(newH))
        }

        // Auto-scroll when at viewport bottom
        if (scrollEl && lastY >= window.innerHeight - 2) {
          scrollEl.scrollTop += 12
        }

        rafId.current = requestAnimationFrame(tick)
      }
      rafId.current = requestAnimationFrame(tick)

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    }

    let lastY = 0
    let startY = 0
    let startMode: 'none' | 'grow' | 'shrink' = 'none'

    function onPointerMove(e: PointerEvent) {
      lastY = e.clientY
      const dy = e.clientY - startY

      if (dy >= 0) {
        startMode = 'grow'
      } else {
        startMode = 'shrink'
      }
    }

    function onPointerUp() {
      isResizing.current = false
      startMode = 'none'
      cancelAnimationFrame(rafId.current)
      canvas!.style.cursor = ''
      hideIndicator()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('pointerdown', onPointerDown)

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      cancelAnimationFrame(rafId.current)
      hideIndicator()
    }
  }, [canvasRef, scrollRef])
}
