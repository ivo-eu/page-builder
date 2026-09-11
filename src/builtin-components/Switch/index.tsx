import React from 'react'

interface SwitchProps {
  checked?: boolean
  [key: string]: any
}

export const BuiltinSwitch: React.FC<SwitchProps> = ({ checked = false, ...rest }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...rest}
    >
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          backgroundColor: checked ? '#4f8cff' : '#ccc',
          position: 'relative',
          transition: 'background-color 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#fff',
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  )
}
