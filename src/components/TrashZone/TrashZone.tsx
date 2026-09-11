import React, { useEffect, useRef, useState } from 'react'
import { useDragStore } from '../../store'

function TrashIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="-2 -2 28 28"
      width="22"
      height="22"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />

      {open ? (
        <g transform="rotate(15 21 6)">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </g>
      ) : (
        <g>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </g>
      )}
    </svg>
  )
}

export const TrashZone: React.FC = () => {
  const isDragging = useDragStore(s => s.isDragging)
  const dragSource = useDragStore(s => s.source)
  const overTrash = useDragStore(s => s.overTrash)
  const [visible, setVisible] = useState(false)
  const [shaking, setShaking] = useState(false)
  const slideInDone = useRef(false)
  const shakeStartRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shakeEndRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shouldShow = isDragging && dragSource === 'canvas'
  const open = overTrash

  // Show/hide trash zone
  useEffect(() => {
    if (shouldShow) {
      setVisible(true)
      slideInDone.current = false
    } else {
      const timer = setTimeout(() => {
        setVisible(false)
        slideInDone.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [shouldShow])

  // Shake: debounce — only latest hover triggers, after scale-up finishes
  useEffect(() => {
    // Clear previous timers
    if (shakeStartRef.current) clearTimeout(shakeStartRef.current)
    if (shakeEndRef.current) clearTimeout(shakeEndRef.current)
    setShaking(false)

    if (open) {
      // Wait for scale transition (200ms), then shake
      shakeStartRef.current = setTimeout(() => {
        setShaking(true)
        shakeEndRef.current = setTimeout(() => setShaking(false), 200)
      }, 200)
    }

    return () => {
      if (shakeStartRef.current) clearTimeout(shakeStartRef.current)
      if (shakeEndRef.current) clearTimeout(shakeEndRef.current)
    }
  }, [open])

  // Mark slide-in as done after animation
  useEffect(() => {
    if (shouldShow && !slideInDone.current) {
      const timer = setTimeout(() => {
        slideInDone.current = true
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [shouldShow])

  if (!visible) return null

  return (
    <div
      data-trash-zone
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10001,
        pointerEvents: shouldShow ? 'auto' : 'none',
      }}
    >
      {/* Outer: shake animation (state-driven, no remount) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: shaking ? 'trash-shake 0.3s ease-in-out' : 'none',
        }}
      >
        {/* Inner: scale + visual styles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            fontSize: 26,
            cursor: 'default',
            transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
            transform: shouldShow
              ? open
                ? 'scale(1.25)'
                : 'scale(1)'
              : 'scale(0.8)',
            color: '#9ca3af',
            backgroundColor: '#ffffff',
            boxShadow: open
              ? '0 8px 30px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)'
              : '0 4px 12px rgba(0, 0, 0, 0.06)',
            animation: shouldShow && !slideInDone.current
              ? 'trash-slide-in 0.35s ease-out'
              : 'none',
          }}
        >
          <TrashIcon open={open} />
        </div>
      </div>
    </div>
  )
}
