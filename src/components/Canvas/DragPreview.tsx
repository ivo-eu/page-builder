import React from 'react'
import { useDragStore } from '../../store'

export const DragPreview: React.FC = () => {
  const isDragging = useDragStore(s => s.isDragging)
  const previewX = useDragStore(s => s.previewX)
  const previewY = useDragStore(s => s.previewY)
  const previewWidth = useDragStore(s => s.previewWidth)
  const previewHeight = useDragStore(s => s.previewHeight)
  const targetContainerId = useDragStore(s => s.targetContainerId)
  const overTrash = useDragStore(s => s.overTrash)

  // Don't render if not dragging, or preview is off-screen (dock drag before entering canvas)
  if (!isDragging || overTrash || previewX < -1000 || previewY < -1000) return null

  const isInsideContainer = targetContainerId !== null

  return (
    <div
      style={{
        position: 'absolute',
        left: previewX,
        top: previewY,
        width: previewWidth,
        height: previewHeight,
        border: isInsideContainer ? '1.5px solid #636366' : '1.5px dashed rgba(99,99,102,0.5)',
        borderRadius: 6,
        backgroundColor: isInsideContainer
          ? 'rgba(99, 99, 102, 0.06)'
          : 'rgba(99, 99, 102, 0.03)',
        pointerEvents: 'none',
        zIndex: 10000,
        transition: 'left 0.02s linear, top 0.02s linear',
      }}
    />
  )
}
