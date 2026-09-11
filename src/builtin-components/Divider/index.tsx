import React from 'react'

export const BuiltinDivider: React.FC = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <hr
        style={{
          width: '100%',
          border: 'none',
          borderTop: '1px solid #e0e0e0',
          margin: 0,
        }}
      />
    </div>
  )
}
