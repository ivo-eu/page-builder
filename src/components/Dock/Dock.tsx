import React from 'react'
import { useUIStore } from '../../store'
import { ComponentListPanel } from './ComponentListPanel'
import { PropertyPanel } from '../PropertyPanel/PropertyPanel'
import { DOCK_WIDTH } from './useDockScroll'

// 错误捕获包装器（调试用，后续移除）
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  componentDidCatch(error: Error) {
    console.error('PropertyPanel error:', error)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: '#ff4d4f', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

export const Dock: React.FC = () => {
  const showPropertyPanel = useUIStore(s => s.showPropertyPanel)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div style={{ perspective: 1000, pointerEvents: 'auto' }}>
        <div
          style={{
            transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
            transformStyle: 'preserve-3d',
            transform: showPropertyPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
          }}
        >
          {/* 正面：组件列表 */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              borderRadius: 20,
              height: 64,
              width: DOCK_WIDTH,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <ComponentListPanel width={DOCK_WIDTH} />
          </div>

          {/* 背面：属性面板 */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateX(180deg)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <PanelErrorBoundary>
              <PropertyPanel width={DOCK_WIDTH} />
            </PanelErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
