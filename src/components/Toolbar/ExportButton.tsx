import React, { useState, useCallback } from 'react'
import { useCanvasStore } from '../../store'
import { generateReactCode } from '../../export'
import { toast } from '../Toast'

export const ExportButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  const handleExport = useCallback(() => {
    const { nodes, rootChildren } = useCanvasStore.getState()
    const generated = generateReactCode(nodes, rootChildren)
    setCode(generated)
    setShowModal(true)
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    setCopied(false)

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('复制成功')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败', '请手动选择并复制代码')
    }
  }, [code])

  return (
    <>
      <button
        type="button"
        title="导出当前页面的 React 代码"
        onClick={handleExport}
        className="glass-panel-dark"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          padding: '8px 18px',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 0.3,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.03)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        导出 React
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div
            className="glass-panel-dark"
            style={{
              width: 680,
              maxHeight: '80vh',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, fontFamily: '"SF Mono", monospace' }}>
                MyPage.tsx
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  title="复制导出的 React 代码"
                  onClick={handleCopy}
                  style={{
                    padding: '5px 14px',
                    backgroundColor: copied ? 'rgba(52,199,89,0.6)' : 'rgba(0,122,255,0.6)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {copied ? '已复制 ✓' : '复制代码'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  aria-label="关闭导出弹窗"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <pre
              style={{
                padding: 18,
                overflow: 'auto',
                fontSize: 12,
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.75)',
                fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
                margin: 0,
              }}
            >
              <code>{code}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  )
}
