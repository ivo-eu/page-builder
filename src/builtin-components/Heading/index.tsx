import React from 'react'

interface HeadingProps {
  children?: string
  level?: string | number
  [key: string]: any
}

const sizes: Record<number, { fontSize: number; fontWeight: number }> = {
  1: { fontSize: 32, fontWeight: 700 },
  2: { fontSize: 24, fontWeight: 600 },
  3: { fontSize: 18, fontWeight: 600 },
}

export const BuiltinHeading: React.FC<HeadingProps> = ({ children = '标题', level = 2, ...rest }) => {
  const lv = Number(level) || 2
  const s = sizes[lv] || sizes[2]
  return (
    <h2
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: '#1a1a1a',
        fontFamily: 'inherit',
        lineHeight: 1.3,
        margin: 0,
      }}
      {...rest}
    >
      {children}
    </h2>
  )
}
