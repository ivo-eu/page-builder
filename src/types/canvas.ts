/** 画布配置 */
export interface CanvasConfig {
  designWidth: number
  designHeight: number
  minWidth: number
  autoGrow: boolean
  autoGrowPadding: number
  foldLineVisible: boolean
}

/** 坐标点 */
export interface Point {
  x: number
  y: number
}

/** 矩形区域 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
