import { create } from 'zustand'
import type { DragSource } from '../types/drag'

interface DragStore {
  isDragging: boolean
  source: DragSource
  componentType: string | null
  sourceNodeId: string | null
  offsetX: number
  offsetY: number
  previewX: number
  previewY: number
  previewWidth: number
  previewHeight: number
  targetContainerId: string | null
  overTrash: boolean

  startDockDrag: (componentType: string, width: number, height: number, offsetX: number, offsetY: number) => void
  startCanvasDrag: (nodeId: string, width: number, height: number, offsetX: number, offsetY: number, initX: number, initY: number) => void
  updateDragPosition: (previewX: number, previewY: number) => void
  setTargetContainer: (containerId: string | null) => void
  setOverTrash: (over: boolean) => void
  endDrag: () => void
}

const initialState = {
  isDragging: false,
  source: 'dock' as DragSource,
  componentType: null as string | null,
  sourceNodeId: null as string | null,
  offsetX: 0,
  offsetY: 0,
  previewX: -9999,
  previewY: -9999,
  previewWidth: 0,
  previewHeight: 0,
  targetContainerId: null as string | null,
  overTrash: false,
}

export const useDragStore = create<DragStore>((set) => ({
  ...initialState,

  startDockDrag: (componentType, width, height, offsetX, offsetY) => {
    set({
      isDragging: true,
      source: 'dock',
      componentType,
      sourceNodeId: null,
      offsetX,
      offsetY,
      previewWidth: width,
      previewHeight: height,
      previewX: -9999,
      previewY: -9999,
      targetContainerId: null,
      overTrash: false,
    })
  },

  startCanvasDrag: (nodeId, width, height, offsetX, offsetY, initX, initY) => {
    set({
      isDragging: true,
      source: 'canvas',
      componentType: null,
      sourceNodeId: nodeId,
      offsetX,
      offsetY,
      previewWidth: width,
      previewHeight: height,
      previewX: initX,
      previewY: initY,
      targetContainerId: null,
      overTrash: false,
    })
  },

  updateDragPosition: (previewX, previewY) => {
    set({ previewX, previewY })
  },

  setTargetContainer: (containerId) => {
    set({ targetContainerId: containerId })
  },

  setOverTrash: (over) => {
    set({ overTrash: over })
  },

  endDrag: () => {
    set(initialState)
  },
}))
