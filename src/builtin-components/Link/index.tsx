import React from 'react'

interface LinkProps {
  children?: string
  [key: string]: any
}

export const BuiltinLink: React.FC<LinkProps> = ({ children = '链接文字', ...rest }) => {
  return (
    <span
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        fontSize: 14,
        color: '#4f8cff',
        textDecoration: 'underline',
        fontFamily: 'inherit',
        cursor: 'default',
      }}
      {...rest}
    >
      {children}
    </span>
  )
}
