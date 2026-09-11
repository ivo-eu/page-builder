import React from 'react'

interface ParagraphProps {
  children?: string
  [key: string]: any
}

export const BuiltinParagraph: React.FC<ParagraphProps> = ({ children = '段落文本内容，可以输入较长的文字。', ...rest }) => {
  return (
    <p
      style={{
        width: '100%',
        height: '100%',
        fontSize: 14,
        color: '#444',
        lineHeight: 1.6,
        fontFamily: 'inherit',
        margin: 0,
      }}
      {...rest}
    >
      {children}
    </p>
  )
}
