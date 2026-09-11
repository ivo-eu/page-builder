import React from 'react'

interface ButtonProps {
  children?: string
  [key: string]: any
}

export const BuiltinButton: React.FC<ButtonProps> = ({ children = 'Button', ...rest }) => {
  return (
    <button
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: 6,
        backgroundColor: '#4f8cff',
        color: '#fff',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
