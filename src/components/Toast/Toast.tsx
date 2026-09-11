import { createRoot, type Root } from 'react-dom/client'

// ── Types ──────────────────────────────────────────────

type NotificationType = 'success' | 'info' | 'warning' | 'error'

interface NotificationItem {
  id: number
  type: NotificationType
  title: string
  description?: string
}

// ── State ──────────────────────────────────────────────

let nextId = 0
let containerEl: HTMLDivElement | null = null
let root: Root | null = null
let items: NotificationItem[] = []

// ── Container Setup ────────────────────────────────────

function ensureContainer() {
  if (containerEl) return
  containerEl = document.createElement('div')
  containerEl.id = 'hermes-toast-container'
  Object.assign(containerEl.style, {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10000',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
  })
  document.body.appendChild(containerEl)
  root = createRoot(containerEl)
  renderAll()
}

// ── Render ─────────────────────────────────────────────

function renderAll() {
  if (!root) return
  root.render(<ToastContainer items={items} onClose={removeItem} />)
}

function removeItem(id: number) {
  items = items.filter(i => i.id !== id)
  renderAll()
}

function addItem(type: NotificationType, title: string, description?: string) {
  ensureContainer()
  const id = ++nextId
  items = [...items, { id, type, title, description }]
  renderAll()
  setTimeout(() => removeItem(id), 3000)
}

// ── React Components ───────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { color: string; icon: string }> = {
  success: { color: '#52c41a', icon: '✓' },
  info:    { color: '#1677ff', icon: 'ℹ' },
  warning: { color: '#faad14', icon: '⚠' },
  error:   { color: '#ff4d4f', icon: '✕' },
}

function ToastContainer({ items, onClose }: { items: NotificationItem[]; onClose: (id: number) => void }) {
  if (items.length === 0) return null
  return (
    <>
      {items.map(item => (
        <ToastItem key={item.id} item={item} onClose={onClose} />
      ))}
    </>
  )
}

function ToastItem({ item, onClose }: { item: NotificationItem; onClose: (id: number) => void }) {
  const config = TYPE_CONFIG[item.type]

  const containerStyle: React.CSSProperties = {
    width: 320,
    padding: '12px 16px',
    borderRadius: 8,
    backgroundColor: '#fff',
    boxShadow: '0 6px 16px rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
    display: 'flex',
    gap: 12,
    position: 'relative',
    pointerEvents: 'auto',
    animation: 'toast-slide-in 0.3s ease-out',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }

  const iconStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: config.color,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(0,0,0,0.88)',
    lineHeight: 1.4,
    margin: 0,
  }

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'rgba(0,0,0,0.65)',
    lineHeight: 1.4,
    margin: 0,
    marginTop: item.description ? 4 : 0,
  }

  const closeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10,
    right: 12,
    background: 'none',
    border: 'none',
    color: 'rgba(0,0,0,0.45)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  }

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>{config.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={titleStyle}>{item.title}</p>
        {item.description && <p style={descStyle}>{item.description}</p>}
      </div>
      <button style={closeStyle} onClick={() => onClose(item.id)}>✕</button>
    </div>
  )
}

// ── Public API ─────────────────────────────────────────

export const toast = {
  success: (title: string, description?: string) => addItem('success', title, description),
  info:    (title: string, description?: string) => addItem('info', title, description),
  warning: (title: string, description?: string) => addItem('warning', title, description),
  error:   (title: string, description?: string) => addItem('error', title, description),
}
