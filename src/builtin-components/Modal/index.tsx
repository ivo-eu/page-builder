import React from 'react'

interface ModalProps {
  title?: string
  children?: React.ReactNode
  [key: string]: any
}

export const BuiltinModal: React.FC<ModalProps> = ({ title = 'Modal', children, ...rest }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        border: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
      {...rest}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8',
          fontWeight: 600,
          fontSize: 16,
          color: '#333',
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, position: 'relative', padding: 16 }}>
        {children}
      </div>
    </div>
  )
}
