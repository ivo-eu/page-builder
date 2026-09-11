import { BuiltinButton } from './index'
import type { ComponentManifest } from '../../types/component'

export const ButtonManifest: ComponentManifest = {
  name: 'Button',
  displayName: '按钮',
  category: 'basic',
  icon: '🔘',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 120, height: 40 },
  defaultProps: { children: 'Button' },
  propSchema: [
    { key: 'children', kind: 'text', default: 'Button', label: '文本' },
  ],
  render: BuiltinButton,
}
