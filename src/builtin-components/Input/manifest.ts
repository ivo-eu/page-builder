import { BuiltinInput } from './index'
import type { ComponentManifest } from '../../types/component'

export const InputManifest: ComponentManifest = {
  name: 'Input',
  displayName: '输入框',
  category: 'basic',
  icon: '📋',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 240, height: 40 },
  defaultProps: { placeholder: '请输入...' },
  propSchema: [
    { key: 'placeholder', kind: 'text', default: '请输入...', label: '占位文本' },
  ],
  render: BuiltinInput,
}
