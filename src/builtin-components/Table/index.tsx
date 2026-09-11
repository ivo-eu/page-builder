import React from 'react'

interface TableProps {
  columns?: number
  rows?: number
  [key: string]: any
}

export const BuiltinTable: React.FC<TableProps> = ({ columns = 3, rows = 4, ...rest }) => {
  const cols = Array.from({ length: columns }, (_, i) => `Column ${i + 1}`)
  const rowData = Array.from({ length: rows }, (_, i) => i)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid #e8e8e8',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          fontFamily: 'inherit',
        }}
        {...rest}
      >
        <thead>
          <tr style={{ backgroundColor: '#fafafa' }}>
            {cols.map((col, i) => (
              <th
                key={i}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #e8e8e8',
                  fontWeight: 600,
                  color: '#666',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowData.map((row) => (
            <tr key={row}>
              {cols.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    color: '#333',
                  }}
                >
                  Data {row + 1}-{ci + 1}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
