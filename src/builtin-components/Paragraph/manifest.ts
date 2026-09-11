import { BuiltinParagraph } from './index'
import type { ComponentManifest } from '../../types/component'

export const ParagraphManifest: ComponentManifest = {
  name: 'Paragraph',
  displayName: '段落',
  category: 'basic',
  icon: '📄',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 400, height: 80 },
  defaultProps: { children: '段落文本内容，可以输入较长的文字。' },
  propSchema: [
    { key: 'children', kind: 'text', default: '段落文本内容', label: '文本' },
  ],
  render: BuiltinParagraph,
}
