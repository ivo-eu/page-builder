import { useState, useRef, useEffect } from 'react'

// ── 共享参数 ───────────────────────────────────────────

export const ITEM_WIDTH = 44
export const ITEM_HEIGHT = 48
export const GAP = 18
export const VISIBLE_COUNT = 7
export const STEP = ITEM_WIDTH + GAP  // 62px
export const DOCK_WIDTH = (VISIBLE_COUNT + 1) * GAP + VISIBLE_COUNT * ITEM_WIDTH  // 452px

// ── Hook ───────────────────────────────────────────────

interface UseDockScrollReturn {
  trackRef: React.RefObject<HTMLDivElement | null>
  dockRef: React.RefObject<HTMLDivElement | null>
  hoveredIndex: number | null
  W: number
  tripledIndices: number[]
}

/**
 * 循环滚动 hook，供 ComponentListPanel 和 PropertyPanel 复用。
 * 封装：RAF + lerp + 取模循环 + wheel 累积阈值 + hover 跟踪。
 */
export function useDockScroll(totalCount: number): UseDockScrollReturn {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const targetX = useRef(0)
  const currentX = useRef(0)
  const rafId = useRef(0)
  const mouseLocalX = useRef(-1)

  const tripledIndices = Array.from({ length: totalCount * 3 }, (_, i) => i % totalCount)
  const W = totalCount * STEP

  useEffect(() => {
    const track = trackRef.current
    const dockEl = dockRef.current
    if (!track || !dockEl) return

    let accumulator = 0
    const THRESHOLD = 80

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      accumulator += e.deltaY
      while (accumulator >= THRESHOLD) {
        accumulator -= THRESHOLD
        targetX.current += STEP
      }
      while (accumulator <= -THRESHOLD) {
        accumulator += THRESHOLD
        targetX.current -= STEP
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = dockEl.getBoundingClientRect()
      mouseLocalX.current = e.clientX - rect.left
    }

    const handleMouseLeave = () => {
      mouseLocalX.current = -1
      setHoveredIndex(null)
    }

    function loop() {
      currentX.current += (targetX.current - currentX.current) * 0.08

      if (Math.abs(targetX.current - currentX.current) < 0.1) {
        currentX.current = targetX.current
      }

      const boundedX = ((currentX.current % W) + W) % W

      if (track) {
        track.style.transform = `translateX(${-W - boundedX}px)`
      }

      // hover 跟踪
      const mx = mouseLocalX.current
      if (mx >= 0) {
        const trackX = mx + W + boundedX - GAP
        const idx = Math.floor(trackX / STEP)
        if (idx >= 0 && idx < totalCount * 3) {
          const realIdx = idx % totalCount
          setHoveredIndex(prev => prev === realIdx ? prev : realIdx)
        } else {
          setHoveredIndex(prev => prev === null ? prev : null)
        }
      }

      rafId.current = requestAnimationFrame(loop)
    }

    dockEl.addEventListener('wheel', handleWheel, { passive: false })
    dockEl.addEventListener('mousemove', handleMouseMove)
    dockEl.addEventListener('mouseleave', handleMouseLeave)
    rafId.current = requestAnimationFrame(loop)

    return () => {
      dockEl.removeEventListener('wheel', handleWheel)
      dockEl.removeEventListener('mousemove', handleMouseMove)
      dockEl.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(rafId.current)
    }
  }, [W, totalCount])

  return { trackRef, dockRef, hoveredIndex, W, tripledIndices }
}
