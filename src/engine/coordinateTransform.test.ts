import { describe, expect, it } from 'vitest'

import { canvasToScreen, screenToCanvas } from './coordinateTransform'

function canvasRect(left: number, top: number): DOMRect {
  return { left, top } as DOMRect
}

describe('coordinate transforms', () => {
  it('converts screen coordinates at zoom 1 with canvas offset and scroll', () => {
    const rect = canvasRect(100, 200)

    expect(screenToCanvas(150, 260, rect, 1, 30, 40)).toEqual({
      x: 80,
      y: 100,
    })
  })

  it('converts canvas coordinates with non-zero scroll and zoom', () => {
    const rect = canvasRect(12, 24)

    expect(canvasToScreen(70, 90, rect, 2, 10, 20)).toEqual({
      x: 132,
      y: 164,
    })
  })

  it('round-trips a screen point through canvas coordinates', () => {
    const rect = canvasRect(48, 72)
    const screenPoint = { x: 321, y: 246 }
    const canvasPoint = screenToCanvas(
      screenPoint.x,
      screenPoint.y,
      rect,
      1.5,
      35,
      55,
    )

    expect(
      canvasToScreen(
        canvasPoint.x,
        canvasPoint.y,
        rect,
        1.5,
        35,
        55,
      ),
    ).toEqual(screenPoint)
  })

  it('round-trips a canvas point through screen coordinates', () => {
    const rect = canvasRect(64, 32)
    const canvasPoint = { x: 225, y: 175 }
    const screenPoint = canvasToScreen(
      canvasPoint.x,
      canvasPoint.y,
      rect,
      2.5,
      45,
      25,
    )

    expect(
      screenToCanvas(
        screenPoint.x,
        screenPoint.y,
        rect,
        2.5,
        45,
        25,
      ),
    ).toEqual(canvasPoint)
  })
})
