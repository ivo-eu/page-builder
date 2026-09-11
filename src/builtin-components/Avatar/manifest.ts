import { BuiltinAvatar } from './index'
import type { ComponentManifest } from '../../types/component'

export const AvatarManifest: ComponentManifest = {
  name: 'Avatar',
  displayName: '头像',
  category: 'basic',
  icon: '👤',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 50, height: 50 },
  defaultProps: { name: 'U' },
  propSchema: [
    { key: 'name', kind: 'text', default: 'U', label: '名字' },
    { key: 'src', kind: 'text', default: '', label: '图片URL' },
  ],
  render: BuiltinAvatar,
}
