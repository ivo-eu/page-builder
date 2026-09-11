import React from 'react'

interface InputProps {
  placeholder?: string
  [key: string]: any
}

export const BuiltinInput: React.FC<InputProps> = ({ placeholder = '请输入...', ...rest }) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      style={{
        width: '100%',
        height: '100%',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        padding: '4px 12px',
        fontSize: 14,
        outline: 'none',
        fontFamily: 'inherit',
      }}
      {...rest}
    />
  )
}
