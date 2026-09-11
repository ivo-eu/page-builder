import React from 'react'
import { registry } from '../../registry'
import { useDragStore, useCanvasStore } from '../../store'
import { useDockScroll, ITEM_WIDTH, ITEM_HEIGHT, GAP } from './useDockScroll'

interface ComponentListPanelProps {
  width: number
}

export const ComponentListPanel: React.FC<ComponentListPanelProps> = ({ width }) => {
  const categories = registry.getCategories()
  const allItems = categories.flatMap(cat => registry.getByCategory(cat))
  const totalCount = allItems.length

  const { trackRef, dockRef, hoveredIndex, tripledIndices } = useDockScroll(totalCount)

  return (
    <div
      ref={dockRef}
      className="glass-panel-dark scrollbar-hidden"
      style={{
        borderRadius: 20,
        height: 64,
        width,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: GAP,
          paddingLeft: GAP,
          width: 'max-content',
          height: '100%',
          willChange: 'transform',
        }}
      >
        {tripledIndices.map((realIdx, index) => {
          const item = allItems[realIdx]
          return (
            <DockItem
              key={`${item.name}-${index}`}
              name={item.name}
              icon={item.icon}
              displayName={item.displayName}
              index={realIdx}
              hoveredIndex={hoveredIndex}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── DockItem ───────────────────────────────────────────

interface DockItemProps {
  name: string
  icon: string
  displayName: string
  index: number
  hoveredIndex: number | null
}

const DockItem: React.FC<DockItemProps> = ({ name, icon, displayName, index, hoveredIndex }) => {
  const startDockDrag = useDragStore(s => s.startDockDrag)
  const manifest = registry.get(name)
  const selectNode = useCanvasStore(s => s.selectNode)

  const getScale = () => {
    if (hoveredIndex === null) return 1
    const distance = Math.abs(index - hoveredIndex)
    if (distance === 0) return 1.25
    if (distance === 1) return 1.1
    return 1
  }

  const scale = getScale()

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !manifest) return
    selectNode(null)
    const offsetX = manifest.defaultSize.width / 2
    const offsetY = manifest.defaultSize.height / 2
    startDockDrag(name, manifest.defaultSize.width, manifest.defaultSize.height, offsetX, offsetY)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        borderRadius: 10,
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onPointerDown={handlePointerDown}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 2,
          whiteSpace: 'nowrap',
          fontWeight: 500,
          letterSpacing: 0.3,
        }}
      >
        {displayName}
      </span>
    </div>
  )
}
