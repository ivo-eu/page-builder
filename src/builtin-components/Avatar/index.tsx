import React from 'react'

interface AvatarProps {
  src?: string
  name?: string
  [key: string]: any
}

export const BuiltinAvatar: React.FC<AvatarProps> = ({ src, name = 'U', ...rest }) => {
  const initial = name.charAt(0).toUpperCase()
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
      {src ? (
        <img
          src={src}
          alt={name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: '#666',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
      )}
    </div>
  )
}
