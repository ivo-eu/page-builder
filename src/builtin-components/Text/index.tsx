import React from 'react'

interface TextProps {
  children?: string
  [key: string]: any
}

export const BuiltinText: React.FC<TextProps> = ({ children = 'Text', ...rest }) => {
  return (
    <span
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        fontSize: 16,
        color: '#333',
        fontFamily: 'inherit',
        lineHeight: 1.5,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}
