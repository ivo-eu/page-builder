import { useEffect, useState } from 'react'
import { Canvas } from './components/Canvas/Canvas'
import { Dock } from './components/Dock/Dock'
import { TrashZone } from './components/TrashZone/TrashZone'
import { ExportButton } from './components/Toolbar/ExportButton'
import { registerBuiltinComponents } from './builtin-components'
import { useDragStore, useCanvasStore, useUIStore } from './store'
import { toast } from './components/Toast'

// 暴露到 window 方便控制台测试（后续移除）
;(window as any).toast = toast

// Register all builtin components on app start
registerBuiltinComponents()

function App() {
  const isDragging = useDragStore(s => s.isDragging)
  const rootChildren = useCanvasStore(s => s.rootChildren)
  const showPropertyPanel = useUIStore(s => s.showPropertyPanel)
  const openPropertyPanel = useUIStore(s => s.openPropertyPanel)
  const closePropertyPanel = useUIStore(s => s.closePropertyPanel)

  // Prevent default context menu everywhere
  useEffect(() => {
    const handler = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none'
      document.body.style.webkitUserSelect = 'none'
      document.body.style.cursor = 'grabbing'
    } else {
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging])

  // 测试：自动放一个组件到画布（后续移除）
  const [testNodeId, setTestNodeId] = useState<string | null>(null)
  useEffect(() => {
    if (rootChildren.length === 0) {
      const store = useCanvasStore.getState()
      const id = store.addNode({
        type: 'Heading',
        parentId: null,
        x: 200,
        y: 200,
        width: 300,
        height: 50,
        props: { children: '测试标题', level: 2 },
        styles: {},
        children: [],
        isContainer: false,
        locked: false,
        visible: true,
        eventBindings: [],
      })
      setTestNodeId(id)
    } else {
      setTestNodeId(rootChildren[0])
    }
  }, [rootChildren.length])

  // 测试按钮：点击切换属性面板（后续移除）
  const handleTestFlip = () => {
    if (showPropertyPanel) {
      closePropertyPanel()
    } else if (testNodeId) {
      openPropertyPanel(testNodeId)
    }
  }

  return (
    <>
      <Canvas />
      <TrashZone />
      <Dock />
      <ExportButton />
      {/* 测试按钮（后续移除）— 放在导出按钮下方 */}
      {rootChildren.length > 0 && (
        <button
          onClick={handleTestFlip}
          style={{
            position: 'fixed',
            top: 50,
            right: 16,
            zIndex: 10000,
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.15)',
            backgroundColor: '#fff',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {showPropertyPanel ? '返回组件' : '测试属性面板'}
        </button>
      )}
    </>
  )
}

export default App
