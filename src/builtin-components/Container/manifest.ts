import { BuiltinContainer } from './index'
import type { ComponentManifest } from '../../types/component'

export const ContainerManifest: ComponentManifest = {
  name: 'Container',
  displayName: '容器',
  category: 'layout',
  icon: '📦',
  package: '',
  importName: '',
  importPath: '',
  isContainer: true,
  defaultSize: { width: 400, height: 300 },
  defaultProps: {},
  propSchema: [],
  render: BuiltinContainer,
}
