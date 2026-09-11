import { BuiltinHeading } from './index'
import type { ComponentManifest } from '../../types/component'

export const HeadingManifest: ComponentManifest = {
  name: 'Heading',
  displayName: '标题',
  category: 'basic',
  icon: '🔤',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 300, height: 50 },
  defaultProps: { children: '标题', level: 2 },
  propSchema: [
    { key: 'children', kind: 'text', default: '标题', label: '文本' },
    { key: 'level', kind: 'select', default: '2', label: '级别', options: ['1', '2', '3'] },
  ],
  render: BuiltinHeading,
}
