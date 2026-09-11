import { BuiltinModal } from './index'
import type { ComponentManifest } from '../../types/component'

export const ModalManifest: ComponentManifest = {
  name: 'Modal',
  displayName: '弹窗',
  category: 'feedback',
  icon: '💬',
  package: '',
  importName: '',
  importPath: '',
  isContainer: true,
  defaultSize: { width: 480, height: 320 },
  defaultProps: { title: 'Modal' },
  propSchema: [
    { key: 'title', kind: 'text', default: 'Modal', label: '标题' },
  ],
  render: BuiltinModal,
}
