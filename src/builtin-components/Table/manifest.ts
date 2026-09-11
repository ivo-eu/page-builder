import { BuiltinTable } from './index'
import type { ComponentManifest } from '../../types/component'

export const TableManifest: ComponentManifest = {
  name: 'Table',
  displayName: '表格',
  category: 'data',
  icon: '📊',
  package: '',
  importName: '',
  importPath: '',
  isContainer: false,
  defaultSize: { width: 500, height: 200 },
  defaultProps: { columns: 3, rows: 4 },
  propSchema: [
    { key: 'columns', kind: 'number', default: 3, min: 1, max: 10, step: 1, label: '列数' },
    { key: 'rows', kind: 'number', default: 4, min: 1, max: 20, step: 1, label: '行数' },
  ],
  render: BuiltinTable,
}
