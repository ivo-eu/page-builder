import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCanvasStore, useUIStore } from '../../store'
import { propertyDefinitions, type PropertyDefinition } from '../../config/propertyDefinitions'
import { useDockScroll, ITEM_WIDTH, ITEM_HEIGHT, GAP } from '../Dock/useDockScroll'
import { NumberInput, ColorInput, SelectInput } from '../PropertyInput'
import { toast } from '../Toast'

interface PropertyPanelProps {
  width: number
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ width }) => {
  const propertyPanelTarget = useUIStore(s => s.propertyPanelTarget)
  const nodes = useCanvasStore(s => s.nodes)
  const updateNode = useCanvasStore(s => s.updateNode)
  const updateNodeStyles = useCanvasStore(s => s.updateNodeStyles)

  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)

  // 所有 hooks 必须在 early return 之前
  const totalCount = propertyDefinitions.length
  const { trackRef, dockRef, hoveredIndex, tripledIndices } = useDockScroll(totalCount)

  // 获取当前节点（可能为 undefined）
  const node = propertyPanelTarget ? nodes.get(propertyPanelTarget) : undefined

  // ── 点击属性项 ──────────────────────────────────────

  const handleItemClick = useCallback((def: PropertyDefinition, itemEl: HTMLElement) => {
    if (activeKey === def.key) return
    setActiveKey(def.key)
    const rect = itemEl.getBoundingClientRect()
    setPopupPos({
      x: rect.left + rect.width / 2 - 80,
      y: rect.top - 8,
    })
  }, [activeKey])

  // ── 提交修改 ────────────────────────────────────────

  const handleCommit = useCallback((def: PropertyDefinition, rawValue: string) => {
    setActiveKey(null)
    setPopupPos(null)

    if (!node || !propertyPanelTarget) return
    if (rawValue.trim() === '') return

    const result = def.validate(rawValue)
    if (!result.valid) {
      toast.error('输入值不合法', result.error)
      return
    }

    const changes = def.write(node, result.parsed)
    if (changes.nodeChanges) {
      updateNode(propertyPanelTarget, changes.nodeChanges)
    }
    if (changes.styleChanges) {
      updateNodeStyles(propertyPanelTarget, changes.styleChanges as any)
    }
  }, [node, propertyPanelTarget, updateNode, updateNodeStyles])

  // ── 取消 ────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    setActiveKey(null)
    setPopupPos(null)
  }, [])

  // ── 选择器立即生效 ──────────────────────────────────

  const handleSelect = useCallback((def: PropertyDefinition, val: string) => {
    if (!node || !propertyPanelTarget) return
    const result = def.validate(val)
    if (result.valid) {
      const changes = def.write(node, result.parsed)
      if (changes.nodeChanges) updateNode(propertyPanelTarget, changes.nodeChanges)
      if (changes.styleChanges) updateNodeStyles(propertyPanelTarget, changes.styleChanges as any)
    }
    setActiveKey(null)
    setPopupPos(null)
  }, [node, propertyPanelTarget, updateNode, updateNodeStyles])

  // ── Early return（hooks 之后） ──────────────────────

  if (!propertyPanelTarget || !node) return null

  // ── 获取当前值 ──────────────────────────────────────

  const getCurrentValue = (def: PropertyDefinition): string => {
    return def.read(node)
  }

  // ── 渲染弹出框 ──────────────────────────────────────

  const renderPopup = () => {
    if (!activeKey || !popupPos) return null
    const def = propertyDefinitions.find(p => p.key === activeKey)
    if (!def) return null

    const currentValue = getCurrentValue(def)

    const popupStyle: React.CSSProperties = {
      position: 'fixed',
      left: popupPos.x,
      top: popupPos.y,
      zIndex: 10001,
      transform: 'translateY(-100%)',
    }

    const content = (
      <div style={popupStyle} onMouseDown={e => e.stopPropagation()}>
        {def.type === 'number' && (
          <NumberInput
            value={currentValue}
            unit={def.unit}
            onCommit={(val) => handleCommit(def, val)}
            onCancel={handleCancel}
          />
        )}
        {def.type === 'color' && def.key !== 'fontFamily' && (
          <ColorInput
            value={currentValue}
            onCommit={(val) => handleCommit(def, val)}
            onCancel={handleCancel}
          />
        )}
        {def.type === 'select' && def.options && (
          <SelectInput
            options={def.options}
            value={currentValue}
            onSelect={(val) => handleSelect(def, val)}
            onCancel={handleCancel}
          />
        )}
        {def.type === 'color' && def.key === 'fontFamily' && (
          <NumberInput
            value={currentValue}
            onCommit={(val) => handleCommit(def, val)}
            onCancel={handleCancel}
          />
        )}
      </div>
    )

    return createPortal(content, document.body)
  }

  return (
    <>
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
            const def = propertyDefinitions[realIdx]
            return (
              <PropertyItem
                key={`${def.key}-${index}`}
                def={def}
                index={realIdx}
                hoveredIndex={hoveredIndex}
                isActive={activeKey === def.key}
                onClick={handleItemClick}
              />
            )
          })}
        </div>
      </div>

      {renderPopup()}
    </>
  )
}

// ── PropertyItem ───────────────────────────────────────

interface PropertyItemProps {
  def: PropertyDefinition
  index: number
  hoveredIndex: number | null
  isActive: boolean
  onClick: (def: PropertyDefinition, el: HTMLElement) => void
}

const PropertyItem: React.FC<PropertyItemProps> = ({ def, index, hoveredIndex, isActive, onClick }) => {
  const elRef = React.useRef<HTMLDivElement>(null)

  const getScale = () => {
    if (isActive) return 1.25
    if (hoveredIndex === null) return 1
    const distance = Math.abs(index - hoveredIndex)
    if (distance === 0) return 1.25
    if (distance === 1) return 1.1
    return 1
  }

  const scale = getScale()

  return (
    <div
      ref={elRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        borderRadius: 10,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (elRef.current) onClick(def, elRef.current)
      }}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#fff',
        color: '#1d1d1f',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        letterSpacing: 0.5,
      }}>
        {def.icon}
      </span>
      <span style={{
        fontSize: 9,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
        whiteSpace: 'nowrap',
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        {def.label}
      </span>
    </div>
  )
}
