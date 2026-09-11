/** JSON 导入适配器接口（架构预留，第一版不实现） */

/** 外部 JSON 导入源 */
export interface ImportSource {
  /** 来源类型标识 */
  format: string  // 'figma' | 'gutenberg' | 'retool' | 'custom' | ...
  /** 原始 JSON 数据 */
  raw: any
}

/** 导入适配器：将外部 JSON 转为我们的 ComponentNode */
export interface ImportAdapter {
  /** 适配器名称 */
  name: string
  /** 支持的格式 */
  format: string
  /** 检测 JSON 是否属于此适配器 */
  detect: (raw: any) => boolean
  /** 转换为 ComponentNode 数组 */
  transform: (raw: any) => ImportResult
}

/** 导入结果 */
export interface ImportResult {
  /** 转换成功的组件节点（需要手动添加 id） */
  nodes: Array<{
    type: string
    parentId: string | null
    x: number
    y: number
    width: number
    height: number
    props: Record<string, any>
    styles: Record<string, any>
    children: string[]
    isContainer: boolean
  }>
  /** 未能识别的组件（日志/提示用） */
  unrecognized: Array<{
    sourceType: string
    reason: string
  }>
  /** 转换警告 */
  warnings: string[]
}
