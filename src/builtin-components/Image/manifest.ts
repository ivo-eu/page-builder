import { BuiltinImage } from './index'
import type { ComponentManifest } from '../../types/component'

export const ImageManifest: ComponentManifest = {
  name: 'Image',
  displayName: '图片',
  category: 'basic',
  icon: '🖼️',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 200, height: 150 },
  defaultProps: { src: 'https://via.placeholder.com/200x150', alt: 'Image' },
  propSchema: [
    { key: 'src', kind: 'text', default: 'https://via.placeholder.com/200x150', label: '图片URL' },
    { key: 'alt', kind: 'text', default: 'Image', label: '替代文本' },
  ],
  render: BuiltinImage,
}
