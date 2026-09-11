import type { ComponentNode } from '../types/component'
import { registry } from '../registry'
import { canvasConfig } from '../config/canvasConfig'

/**
 * 生成 React 源代码（策略一：绝对定位）
 */
export function generateReactCode(
  nodes: Map<string, ComponentNode>,
  rootChildren: string[],
): string {
  const imports = new Set<string>()
  imports.add("import React from 'react';")

  // Collect external imports from registry
  const usedPackages = new Set<string>()
  nodes.forEach((node) => {
    const manifest = registry.get(node.type)
    if (manifest && manifest.package) {
      const key = `${manifest.importName}|${manifest.importPath}`
      if (!usedPackages.has(key)) {
        usedPackages.add(key)
        imports.add(`import ${manifest.importName} from '${manifest.importPath}';`)
      }
    }
  })

  // Calculate canvas height
  let maxHeight = canvasConfig.designHeight
  nodes.forEach((node) => {
    if (node.parentId === null) {
      const bottom = node.y + node.height
      if (bottom > maxHeight) maxHeight = bottom
    }
  })

  const jsx = generateJSX(nodes, rootChildren, 4)

  return `${Array.from(imports).join('\n')}

export default function MyPage() {
  return (
    <div style={{
      position: 'relative',
      width: '${canvasConfig.designWidth}px',
      minHeight: '${maxHeight}px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
${jsx}
    </div>
  );
}
`
}

function generateJSX(
  nodes: Map<string, ComponentNode>,
  childrenIds: string[],
  indent: number,
): string {
  const pad = ' '.repeat(indent)
  const lines: string[] = []

  for (const id of childrenIds) {
    const node = nodes.get(id)
    if (!node || !node.visible) continue

    const manifest = registry.get(node.type)
    if (!manifest) continue

    // Build style object
    const styleObj: Record<string, any> = {
      position: 'absolute',
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
    }
    Object.assign(styleObj, node.styles)

    const styleStr = JSON.stringify(styleObj, null, 0)

    // Build props
    const propsEntries = Object.entries(node.props)
      .filter(([key]) => key !== 'children' || typeof node.props.children !== 'string')
    
    let propsStr = ''
    if (propsEntries.length > 0) {
      propsStr = propsEntries
        .map(([key, val]) => {
          if (typeof val === 'string') return `${key}="${val}"`
          return `${key}={${JSON.stringify(val)}}`
        })
        .join(' ')
      propsStr = ' ' + propsStr
    }

    const childrenText = typeof node.props.children === 'string' ? node.props.children : ''

    // Custom export or default
    if (manifest.renderExport) {
      lines.push(pad + manifest.renderExport(node))
      continue
    }

    // Determine tag name
    let tagName = 'div'
    if (node.type === 'Button') tagName = 'button'
    else if (node.type === 'Text') tagName = 'span'
    else if (node.type === 'Input') {
      lines.push(`${pad}<input style={${styleStr}} placeholder="${node.props.placeholder || ''}" />`)
      continue
    }

    if (node.children.length > 0) {
      const childJSX = generateJSX(nodes, node.children, indent + 2)
      if (childrenText) {
        lines.push(`${pad}<${tagName} style={${styleStr}}${propsStr}>`)
        lines.push(`${pad}  ${childrenText}`)
        lines.push(childJSX)
        lines.push(`${pad}</${tagName}>`)
      } else {
        lines.push(`${pad}<${tagName} style={${styleStr}}${propsStr}>`)
        lines.push(childJSX)
        lines.push(`${pad}</${tagName}>`)
      }
    } else if (childrenText) {
      lines.push(`${pad}<${tagName} style={${styleStr}}${propsStr}>${childrenText}</${tagName}>`)
    } else {
      lines.push(`${pad}<${tagName} style={${styleStr}}${propsStr} />`)
    }
  }

  return lines.join('\n')
}
