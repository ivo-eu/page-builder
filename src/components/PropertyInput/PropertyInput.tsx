import React, { useState, useRef, useEffect } from 'react'

// ── 公共样式 ───────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: 160,
  height: 32,
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '0 10px',
  fontSize: 13,
  fontFamily: '"SF Mono", "Fira Code", monospace',
  backgroundColor: 'rgba(255,255,255,0.95)',
  color: '#1d1d1f',
  outline: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)',
  transition: 'box-shadow 0.2s, border-color 0.2s',
}

const inputFocus: React.CSSProperties = {
  borderColor: '#636366',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.2)',
}

// ── NumberInput ────────────────────────────────────────

interface NumberInputProps {
  value: string
  unit?: string
  onCommit: (value: string) => void
  onCancel: () => void
}

export const NumberInput: React.FC<NumberInputProps> = ({ value, unit, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommit(draft)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div style={{ position: 'relative', width: 160 }}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onCommit(draft) }}
        onKeyDown={handleKeyDown}
        style={{
          ...inputBase,
          ...(focused ? inputFocus : {}),
          paddingRight: unit ? 32 : 10,
        }}
      />
      {unit && (
        <span style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 11,
          color: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          fontFamily: '"SF Mono", "Fira Code", monospace',
        }}>
          {unit}
        </span>
      )}
    </div>
  )
}

// ── ColorInput ─────────────────────────────────────────

interface ColorInputProps {
  value: string
  onCommit: (value: string) => void
  onCancel: () => void
}

export const ColorInput: React.FC<ColorInputProps> = ({ value, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value || '#000000')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommit(draft)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  // 尝试从 draft 解析颜色用于预览方块
  const previewColor = /^#[0-9a-fA-F]{3,8}$/.test(draft) ? draft : '#000000'

  return (
    <div style={{ position: 'relative', width: 160 }}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onCommit(draft) }}
        onKeyDown={handleKeyDown}
        style={{
          ...inputBase,
          ...(focused ? inputFocus : {}),
          paddingLeft: 30,
        }}
      />
      <div style={{
        position: 'absolute',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: previewColor,
        border: '1px solid rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ── SelectInput ────────────────────────────────────────

interface SelectInputProps {
  options: { label: string; value: string }[]
  value: string
  onSelect: (value: string) => void
  onCancel: () => void
}

export const SelectInput: React.FC<SelectInputProps> = ({ options, value, onSelect, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  return (
    <div
      ref={containerRef}
      style={{
        width: 160,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.95)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.15)',
        overflow: 'hidden',
      }}
    >
      {options.map(opt => {
        const isSelected = opt.value === value
        return (
          <div
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'rgba(99,99,102,0.08)' : 'transparent',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={e => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: isSelected ? '4px solid #636366' : '1.5px solid rgba(0,0,0,0.25)',
              flexShrink: 0,
              transition: 'border 0.15s',
            }} />
            <span style={{
              fontSize: 13,
              color: '#1d1d1f',
              fontWeight: isSelected ? 600 : 400,
            }}>
              {opt.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
