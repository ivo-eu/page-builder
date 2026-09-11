import type { ComponentNode } from '../types/component'
import type { CSSProperties } from 'react'

// ── Types ──────────────────────────────────────────────

export type PropertyType = 'number' | 'color' | 'select'

export interface PropertyDefinition {
  key: string
  label: string
  icon: string
  type: PropertyType
  unit?: string
  /** 仅 select 类型 */
  options?: { label: string; value: string }[]
  /** 验证并解析用户输入 */
  validate: (value: string) => { valid: boolean; parsed?: any; error?: string }
  /** 从 node 读取当前值（返回用于显示的字符串） */
  read: (node: ComponentNode) => string
  /** 将解析后的值写入 node，返回需要合并的变更 */
  write: (node: ComponentNode, value: any) => {
    nodeChanges?: Partial<ComponentNode>
    styleChanges?: Partial<CSSProperties>
  }
}

// ── 验证函数 ───────────────────────────────────────────

function validateInteger(min: number, label: string) {
  return (value: string) => {
    if (value.trim() === '') return { valid: false, error: `请输入${label}` }
    const num = parseInt(value, 10)
    if (isNaN(num)) return { valid: false, error: '请输入有效整数' }
    if (num < min) return { valid: false, error: `值不能小于 ${min}` }
    if (String(num) !== value.trim()) return { valid: false, error: '请输入整数' }
    return { valid: true, parsed: num }
  }
}

function validateOpacity(value: string) {
  if (value.trim() === '') return { valid: false, error: '请输入透明度' }
  const num = parseFloat(value)
  if (isNaN(num)) return { valid: false, error: '请输入有效数值' }
  if (num < 0 || num > 1) return { valid: false, error: '值范围 0 ~ 1' }
  return { valid: true, parsed: num }
}

function validateColor(value: string) {
  const hex = value.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
    return { valid: false, error: '格式：#ff0000 或 #f00' }
  }
  return { valid: true, parsed: hex }
}

function validateSelect(options: string[]) {
  return (value: string) => {
    if (options.includes(value)) return { valid: true, parsed: value }
    return { valid: false, error: `请选择：${options.join(' / ')}` }
  }
}

function validateFontFamily(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return { valid: false, error: '请输入字体名称' }
  return { valid: true, parsed: trimmed }
}

// ── 读取辅助 ───────────────────────────────────────────

/** 从 styles 中读取带 px 单位的值，返回纯数字字符串 */
function readPx(styles: CSSProperties, key: keyof CSSProperties): string {
  const val = styles[key]
  if (val === undefined || val === null) return ''
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    const num = parseInt(val, 10)
    return isNaN(num) ? '' : String(num)
  }
  return ''
}

/** 从 styles 中读取颜色值 */
function readColor(styles: CSSProperties, key: keyof CSSProperties): string {
  const val = styles[key]
  if (val === undefined || val === null) return ''
  return String(val)
}

/** 从 styles 中读取普通字符串值 */
function readString(styles: CSSProperties, key: keyof CSSProperties): string {
  const val = styles[key]
  if (val === undefined || val === null) return ''
  return String(val)
}

// ── 12 个属性定义 ──────────────────────────────────────

export const propertyDefinitions: PropertyDefinition[] = [
  // ── 数值型 ──
  {
    key: 'width',
    label: '宽度',
    icon: 'W',
    type: 'number',
    unit: 'px',
    validate: validateInteger(1, '宽度'),
    read: (node) => String(node.width),
    write: (_node, value) => ({ nodeChanges: { width: value } }),
  },
  {
    key: 'height',
    label: '高度',
    icon: 'H',
    type: 'number',
    unit: 'px',
    validate: validateInteger(1, '高度'),
    read: (node) => String(node.height),
    write: (_node, value) => ({ nodeChanges: { height: value } }),
  },
  {
    key: 'fontSize',
    label: '字号',
    icon: 'A',
    type: 'number',
    unit: 'px',
    validate: validateInteger(1, '字号'),
    read: (node) => readPx(node.styles, 'fontSize'),
    write: (_node, value) => ({ styleChanges: { fontSize: value + 'px' } }),
  },
  {
    key: 'borderWidth',
    label: '边框宽度',
    icon: 'OW',
    type: 'number',
    unit: 'px',
    validate: validateInteger(0, '边框宽度'),
    read: (node) => readPx(node.styles, 'borderWidth'),
    write: (_node, value) => ({ styleChanges: { borderWidth: value + 'px' } }),
  },
  {
    key: 'borderRadius',
    label: '圆角',
    icon: 'OR',
    type: 'number',
    unit: 'px',
    validate: validateInteger(0, '圆角'),
    read: (node) => readPx(node.styles, 'borderRadius'),
    write: (_node, value) => ({ styleChanges: { borderRadius: value + 'px' } }),
  },
  {
    key: 'opacity',
    label: '透明度',
    icon: 'O',
    type: 'number',
    validate: validateOpacity,
    read: (node) => {
      const val = node.styles.opacity
      if (val === undefined || val === null) return ''
      return String(val)
    },
    write: (_node, value) => ({ styleChanges: { opacity: value } }),
  },

  // ── 颜色型 ──
  {
    key: 'backgroundColor',
    label: '背景色',
    icon: 'BG',
    type: 'color',
    validate: validateColor,
    read: (node) => readColor(node.styles, 'backgroundColor'),
    write: (_node, value) => ({ styleChanges: { backgroundColor: value } }),
  },
  {
    key: 'color',
    label: '字体颜色',
    icon: 'T',
    type: 'color',
    validate: validateColor,
    read: (node) => readColor(node.styles, 'color'),
    write: (_node, value) => ({ styleChanges: { color: value } }),
  },
  {
    key: 'borderColor',
    label: '边框颜色',
    icon: 'BC',
    type: 'color',
    validate: validateColor,
    read: (node) => readColor(node.styles, 'borderColor'),
    write: (_node, value) => ({ styleChanges: { borderColor: value } }),
  },
  {
    key: 'fontFamily',
    label: '字体',
    icon: 'F',
    type: 'color', // 复用 color 类型的输入框（纯文字输入）
    validate: validateFontFamily,
    read: (node) => readString(node.styles, 'fontFamily'),
    write: (_node, value) => ({ styleChanges: { fontFamily: value } }),
  },

  // ── 选择型 ──
  {
    key: 'fontWeight',
    label: '字重',
    icon: 'B',
    type: 'select',
    options: [
      { label: '100', value: '100' },
      { label: '200', value: '200' },
      { label: '300', value: '300' },
      { label: '400', value: '400' },
      { label: '500', value: '500' },
      { label: '600', value: '600' },
      { label: '700', value: '700' },
      { label: '800', value: '800' },
      { label: '900', value: '900' },
      { label: 'normal', value: 'normal' },
      { label: 'bold', value: 'bold' },
    ],
    validate: validateSelect(['100','200','300','400','500','600','700','800','900','normal','bold']),
    read: (node) => readString(node.styles, 'fontWeight'),
    write: (_node, value) => ({ styleChanges: { fontWeight: value } }),
  },
  {
    key: 'borderStyle',
    label: '边框样式',
    icon: 'S',
    type: 'select',
    options: [
      { label: '实线', value: 'solid' },
      { label: '虚线', value: 'dashed' },
      { label: '点线', value: 'dotted' },
      { label: '无', value: 'none' },
    ],
    validate: validateSelect(['solid', 'dashed', 'dotted', 'none']),
    read: (node) => readString(node.styles, 'borderStyle'),
    write: (_node, value) => ({ styleChanges: { borderStyle: value } }),
  },
]

// ── 辅助函数 ───────────────────────────────────────────

/** 根据 key 查找属性定义 */
export function getPropertyDef(key: string): PropertyDefinition | undefined {
  return propertyDefinitions.find(p => p.key === key)
}
