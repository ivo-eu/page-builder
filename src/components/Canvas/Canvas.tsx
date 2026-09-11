import React, { useCallback, useEffect, useRef } from 'react'
import { useCanvasStore, useDragStore, useUIStore } from '../../store'
import { registry } from '../../registry'
import { hitTestContainer } from '../../engine/hitTest'
import { calculateAutoScroll } from '../../engine/autoScroll'
import { CanvasLayer } from './CanvasLayer'
import { DragPreview } from './DragPreview'
import { useCanvasResize } from './useCanvasResize'

export const Canvas: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const nodes = useCanvasStore(s => s.nodes)
  const rootChildren = useCanvasStore(s => s.rootChildren)
  const canvasHeight = useCanvasStore(s => s.canvasHeight)
  const zoom = useCanvasStore(s => s.zoom)
  const config = useCanvasStore(s => s.config)
  const selectNode = useCanvasStore(s => s.selectNode)
  const getNode = useCanvasStore(s => s.getNode)

  const closePropertyPanel = useUIStore(s => s.closePropertyPanel)

  useCanvasResize(canvasRef, scrollRef)

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current
      if (!el) return { x: 0, y: 0 }
      const rect = el.getBoundingClientRect()
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      }
    },
    [zoom],
  )

  const getAbsPos = useCallback(
    (nodeId: string) => {
      let x = 0
      let y = 0
      let current = nodes.get(nodeId)
      while (current) {
        x += current.x
        y += current.y
        if (!current.parentId) break
        current = nodes.get(current.parentId)
      }
      return { x, y }
    },
    [nodes],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return

      // Near bottom edge → skip component drag (handled by resize hook)
      const el = canvasRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        if (e.clientY - rect.top >= rect.height - 8) return
      }

      const canvasPos = toCanvas(e.clientX, e.clientY)
      const target = e.target as HTMLElement
      const componentEl = target.closest('[data-component-id]')
      const componentId = componentEl?.getAttribute('data-component-id')

      if (componentId) {
        const node = getNode(componentId)
        if (!node || node.locked) return

        selectNode(componentId)
        closePropertyPanel()

        const absPos = getAbsPos(componentId)
        const offX = canvasPos.x - absPos.x
        const offY = canvasPos.y - absPos.y

        const { startCanvasDrag } = useDragStore.getState()
        startCanvasDrag(componentId, node.width, node.height, offX, offY, absPos.x, absPos.y)
      } else {
        selectNode(null)
        closePropertyPanel()
      }
    },
    [toCanvas, selectNode, closePropertyPanel, getNode, getAbsPos],
  )

  useEffect(() => {
    const unsub = useDragStore.subscribe((state, prevState) => {
      if (state.isDragging && !prevState.isDragging) {
        attachListeners()
      }
    })

    let attached = false

    function attachListeners() {
      if (attached) return
      attached = true

      // Cache DOM references
      let rafId = 0
      let lastEvent: PointerEvent | null = null

      function processFrame() {
        rafId = 0
        const e = lastEvent
        if (!e) return

        const state = useDragStore.getState()
        if (!state.isDragging) return

        const canvasPos = toCanvas(e.clientX, e.clientY)
        const previewX = canvasPos.x - state.offsetX
        const previewY = canvasPos.y - state.offsetY

        state.updateDragPosition(previewX, previewY)

        const excludeId = state.source === 'canvas' ? state.sourceNodeId! : undefined
        const currentRoot = useCanvasStore.getState().rootChildren
        const hitId = hitTestContainer(
          canvasPos.x,
          canvasPos.y,
          useCanvasStore.getState().nodes,
          state.source === 'canvas'
            ? currentRoot.filter(id => id !== excludeId)
            : currentRoot,
        )
        state.setTargetContainer(hitId)

        const scrollEl = scrollRef.current
        if (scrollEl) {
          const rect = scrollEl.getBoundingClientRect()
          const autoScroll = calculateAutoScroll(e.clientX, e.clientY, rect)
          if (autoScroll.active) {
            scrollEl.scrollLeft += autoScroll.speedX
            scrollEl.scrollTop += autoScroll.speedY
          }
        }

        // Query trash zone each frame (it appears/disappears dynamically)
        const trashZone = document.querySelector('[data-trash-zone]')
        if (trashZone) {
          const trashRect = trashZone.getBoundingClientRect()
          const over =
            e.clientX >= trashRect.left &&
            e.clientX <= trashRect.right &&
            e.clientY >= trashRect.top &&
            e.clientY <= trashRect.bottom
          state.setOverTrash(over)
        }
      }

      const handleMove = (e: PointerEvent) => {
        lastEvent = e
        if (rafId === 0) {
          rafId = requestAnimationFrame(processFrame)
        }
      }

      const handleUp = (e: PointerEvent) => {
        attached = false
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)

        const state = useDragStore.getState()
        if (!state.isDragging) return

        if (state.overTrash) {
          if (state.source === 'canvas' && state.sourceNodeId) {
            // Calculate shrink origin: mouse position relative to the component
            const canvasPos = toCanvas(e.clientX, e.clientY)
            const absPos = useCanvasStore.getState().getAbsolutePos(state.sourceNodeId)
            const originX = canvasPos.x - absPos.x
            const originY = canvasPos.y - absPos.y

            // Start shrink animation
            useCanvasStore.getState().startShrink(state.sourceNodeId, originX, originY)
            state.endDrag()

            // Remove after animation completes
            setTimeout(() => {
              const cs = useCanvasStore.getState()
              cs.removeNode(state.sourceNodeId!)
              cs.clearShrink()
            }, 280)
          } else {
            state.endDrag()
          }
          return
        }

        const canvasPos = toCanvas(e.clientX, e.clientY)
        let finalX = canvasPos.x - state.offsetX
        let finalY = canvasPos.y - state.offsetY
        const targetContainerId = state.targetContainerId

        finalX = Math.max(0, finalX)
        finalY = Math.max(0, finalY)

        const canvasState = useCanvasStore.getState()

        if (state.source === 'dock' && state.componentType) {
          const manifest = registry.get(state.componentType)
          if (manifest) {
            let x = finalX
            let y = finalY
            if (targetContainerId) {
              const absPos = canvasState.getAbsolutePos(targetContainerId)
              x = finalX - absPos.x
              y = finalY - absPos.y
            }
            canvasState.addNode({
              type: state.componentType,
              parentId: targetContainerId ?? null,
              x,
              y,
              width: manifest.defaultSize.width,
              height: manifest.defaultSize.height,
              props: { ...manifest.defaultProps },
              styles: {},
              children: [],
              isContainer: manifest.isContainer,
              locked: false,
              visible: true,
              eventBindings: [],
            })
          }
        } else if (state.source === 'canvas' && state.sourceNodeId) {
          let x = finalX
          let y = finalY
          if (targetContainerId) {
            const absPos = canvasState.getAbsolutePos(targetContainerId)
            x = finalX - absPos.x
            y = finalY - absPos.y
          }
          canvasState.moveNode(state.sourceNodeId, targetContainerId, x, y)
        }

        state.endDrag()
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    }

    if (useDragStore.getState().isDragging) {
      attachListeners()
    }

    return () => { unsub() }
  }, [toCanvas])

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 60,
        paddingBottom: 80,
        position: 'relative',
        zIndex: 1,
      }}
      className="scrollbar-hidden"
    >
      <div
        ref={canvasRef}
        data-canvas
        style={{
          position: 'relative',
          width: config.designWidth,
          minHeight: canvasHeight,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          flexShrink: 0,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          alignSelf: 'flex-start',
        }}
        onPointerDown={handlePointerDown}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Fold line */}
        {config.foldLineVisible && canvasHeight > config.designHeight && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: config.designHeight,
              width: '100%',
              borderTop: '1px dashed rgba(0, 0, 0, 0.12)',
              zIndex: 9998,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: -10,
                fontSize: 9,
                fontWeight: 500,
                color: 'rgba(0,0,0,0.3)',
                fontFamily: '"SF Mono", monospace',
                letterSpacing: 0.5,
              }}
            >
              FOLD · 900px
            </span>
          </div>
        )}

        {/* Component tree */}
        <CanvasLayer childrenIds={rootChildren} />

        {/* Drag preview */}
        <DragPreview />
      </div>
    </div>
  )
}
