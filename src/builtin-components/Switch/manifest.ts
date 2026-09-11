import { BuiltinSwitch } from './index'
import type { ComponentManifest } from '../../types/component'

export const SwitchManifest: ComponentManifest = {
  name: 'Switch',
  displayName: '开关',
  category: 'basic',
  icon: '🔀',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 60, height: 30 },
  defaultProps: { checked: false },
  propSchema: [
    { key: 'checked', kind: 'boolean', default: false, label: '开启' },
  ],
  render: BuiltinSwitch,
}
