import React from 'react'
import { useCanvasStore, useDragStore } from '../../store'
import { registry } from '../../registry'

interface CanvasLayerProps {
  childrenIds: string[]
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ childrenIds }) => {
  const nodes = useCanvasStore(s => s.nodes)
  const selectedId = useCanvasStore(s => s.selectedId)
  const hoveredId = useCanvasStore(s => s.hoveredId)
  const shrinkingNodeId = useCanvasStore(s => s.shrinkingNodeId)
  const shrinkOrigin = useCanvasStore(s => s.shrinkOrigin)
  const isDragging = useDragStore(s => s.isDragging)
  const targetContainerId = useDragStore(s => s.targetContainerId)
  const setHoveredId = useCanvasStore(s => s.setHoveredId)

  return (
    <>
      {childrenIds.map(id => {
        const node = nodes.get(id)
        if (!node || !node.visible) return null

        const manifest = registry.get(node.type)
        if (!manifest) return null

        const Component = manifest.render
        const isSelected = selectedId === id
        const isHovered = hoveredId === id
        const isDropTarget = isDragging && targetContainerId === id
        const isShrinking = shrinkingNodeId === id

        return (
          <div
            key={id}
            data-component-id={id}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              outline: isShrinking
                ? 'none'
                : isSelected
                  ? '1px solid #636366'
                  : isHovered
                    ? '1px solid rgba(99,99,102,0.25)'
                    : 'none',
              outlineOffset: 1,
              cursor: isDragging ? 'default' : 'move',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              opacity: node.locked ? 0.5 : 1,
              ...(isShrinking && shrinkOrigin
                ? {
                    transformOrigin: `${shrinkOrigin.x}px ${shrinkOrigin.y}px`,
                    transform: 'scale(0)',
                    opacity: 0,
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in',
                  }
                : {}),
              ...(isDropTarget
                ? {
                    boxShadow: '0 0 0 1px #636366, inset 0 0 20px rgba(99,99,102,0.06)',
                  }
                : {}),
            }}
            onMouseEnter={() => {
              if (!isDragging) setHoveredId(id)
            }}
            onMouseLeave={() => {
              if (!isDragging) setHoveredId(null)
            }}
          >
            <Component {...node.props} />
            {node.isContainer && node.children.length > 0 && (
              <CanvasLayer childrenIds={node.children} />
            )}
          </div>
        )
      })}
    </>
  )
}
