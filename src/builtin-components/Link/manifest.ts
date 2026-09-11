import { BuiltinLink } from './index'
import type { ComponentManifest } from '../../types/component'

export const LinkManifest: ComponentManifest = {
  name: 'Link',
  displayName: '链接',
  category: 'basic',
  icon: '🔗',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 120, height: 30 },
  defaultProps: { children: '链接文字', href: '#' },
  propSchema: [
    { key: 'children', kind: 'text', default: '链接文字', label: '文本' },
    { key: 'href', kind: 'text', default: '#', label: '地址' },
  ],
  render: BuiltinLink,
}
