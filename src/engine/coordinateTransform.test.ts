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

  const fractionalCases = [
    {
      name: 'zoom 0.75 with fractional offsets and scroll',
      rect: canvasRect(13.25, 27.5),
      zoom: 0.75,
      scrollLeft: 18.5,
      scrollTop: 42.25,
      screenPoint: { x: 241.375, y: 198.625 },
      canvasPoint: { x: 156.875, y: 134.375 },
    },
    {
      name: 'zoom 1.25 with fractional offsets and scroll',
      rect: canvasRect(86.75, 14.125),
      zoom: 1.25,
      scrollLeft: 63.5,
      scrollTop: 9.75,
      screenPoint: { x: 412.625, y: 287.375 },
      canvasPoint: { x: 324.2, y: 228.35 },
    },
  ]

  const expectPointWithinTolerance = (
    actual: { x: number; y: number },
    expected: { x: number; y: number },
    label: string,
  ) => {
    expect(Math.abs(actual.x - expected.x), `${label} (x)`).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(actual.y - expected.y), `${label} (y)`).toBeLessThanOrEqual(1e-9)
  }

  it.each(fractionalCases)('$name: screen -> canvas -> screen', testCase => {
    const canvasPoint = screenToCanvas(
      testCase.screenPoint.x,
      testCase.screenPoint.y,
      testCase.rect,
      testCase.zoom,
      testCase.scrollLeft,
      testCase.scrollTop,
    )
    const screenPoint = canvasToScreen(
      canvasPoint.x,
      canvasPoint.y,
      testCase.rect,
      testCase.zoom,
      testCase.scrollLeft,
      testCase.scrollTop,
    )

    expectPointWithinTolerance(screenPoint, testCase.screenPoint, testCase.name)
  })

  it.each(fractionalCases)('$name: canvas -> screen -> canvas', testCase => {
    const screenPoint = canvasToScreen(
      testCase.canvasPoint.x,
      testCase.canvasPoint.y,
      testCase.rect,
      testCase.zoom,
      testCase.scrollLeft,
      testCase.scrollTop,
    )
    const canvasPoint = screenToCanvas(
      screenPoint.x,
      screenPoint.y,
      testCase.rect,
      testCase.zoom,
      testCase.scrollLeft,
      testCase.scrollTop,
    )

    expectPointWithinTolerance(canvasPoint, testCase.canvasPoint, testCase.name)
  })
})
