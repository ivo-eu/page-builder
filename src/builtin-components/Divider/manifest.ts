import { BuiltinDivider } from './index'
import type { ComponentManifest } from '../../types/component'

export const DividerManifest: ComponentManifest = {
  name: 'Divider',
  displayName: '分割线',
  category: 'basic',
  icon: '➖',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 400, height: 20 },
  defaultProps: {},
  propSchema: [],
  render: BuiltinDivider,
}
