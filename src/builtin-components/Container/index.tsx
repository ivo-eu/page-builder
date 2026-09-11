import React from 'react'

interface ContainerProps {
  children?: React.ReactNode
  [key: string]: any
}

export const BuiltinContainer: React.FC<ContainerProps> = ({ children, ...rest }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        border: '2px dashed #d9d9d9',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
