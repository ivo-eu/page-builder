import { BuiltinText } from './index'
import type { ComponentManifest } from '../../types/component'

export const TextManifest: ComponentManifest = {
  name: 'Text',
  displayName: '文本',
  category: 'basic',
  icon: '📝',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 200, height: 30 },
  defaultProps: { children: 'Hello World' },
  propSchema: [
    { key: 'children', kind: 'text', default: 'Hello World', label: '文本' },
  ],
  render: BuiltinText,
}
