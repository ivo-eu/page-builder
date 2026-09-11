import React from 'react'

interface ImageProps {
  src?: string
  alt?: string
  [key: string]: any
}

export const BuiltinImage: React.FC<ImageProps> = ({
  src = 'https://via.placeholder.com/200x150',
  alt = 'Image',
  ...rest
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        {...rest}
      />
    </div>
  )
}
