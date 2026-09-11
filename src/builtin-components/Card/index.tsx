import React from 'react'

interface CardProps {
  title?: string
  body?: string
  [key: string]: any
}

export const BuiltinCard: React.FC<CardProps> = ({ title = '卡片标题', body = '卡片描述内容，可以放一段简短的文字。', ...rest }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      {...rest}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}
