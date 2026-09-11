import { BuiltinCard } from './index'
import type { ComponentManifest } from '../../types/component'

export const CardManifest: ComponentManifest = {
  name: 'Card',
  displayName: '卡片',
  category: 'layout',
  icon: '🃏',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 280, height: 140 },
  defaultProps: { title: '卡片标题', body: '卡片描述内容，可以放一段简短的文字。' },
  propSchema: [
    { key: 'title', kind: 'text', default: '卡片标题', label: '标题' },
    { key: 'body', kind: 'text', default: '卡片描述内容', label: '正文' },
  ],
  render: BuiltinCard,
}
