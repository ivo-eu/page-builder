import { useCallback, useRef } from 'react'
import { screenToCanvas } from '../../engine/coordinateTransform'
import { useCanvasStore } from '../../store'

export function useCanvasCoords() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const zoom = useCanvasStore(s => s.zoom)
  const scrollX = useCanvasStore(s => s.scrollX)
  const scrollY = useCanvasStore(s => s.scrollY)

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToCanvas(clientX, clientY, rect, zoom, scrollX, scrollY)
  }, [zoom, scrollX, scrollY])

  return { canvasRef, toCanvas }
}
