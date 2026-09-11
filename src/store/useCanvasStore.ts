import type React from 'react'
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { ComponentNode } from '../types/component'
import type { CanvasConfig } from '../types/canvas'
import { canvasConfig } from '../config/canvasConfig'
import { getAbsolutePosition } from '../engine/coordinateTransform'

interface CanvasStore {
  nodes: Map<string, ComponentNode>
  rootChildren: string[]
  selectedId: string | null
  hoveredId: string | null
  canvasHeight: number
  zoom: number
  scrollX: number
  scrollY: number
  config: CanvasConfig

  // Shrink animation state
  shrinkingNodeId: string | null
  shrinkOrigin: { x: number; y: number } | null

  // Actions (all state changes go through here for future undo/redo)
  addNode: (nodeData: Omit<ComponentNode, 'id'>) => string
  removeNode: (id: string) => void
  updateNode: (id: string, changes: Partial<ComponentNode>) => void
  updateNodeStyles: (id: string, styles: Partial<CSSStyleDeclaration>) => void
  moveNode: (id: string, newParentId: string | null, newX: number, newY: number) => void
  selectNode: (id: string | null) => void
  setHoveredId: (id: string | null) => void
  setCanvasHeight: (height: number) => void
  setZoom: (zoom: number) => void
  setScroll: (x: number, y: number) => void
  getNode: (id: string) => ComponentNode | undefined
  getAbsolutePos: (id: string) => { x: number; y: number }
  checkAutoGrow: (componentBottom: number) => void
  startShrink: (nodeId: string, originX: number, originY: number) => void
  clearShrink: () => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: new Map(),
  rootChildren: [],
  selectedId: null,
  hoveredId: null,
  canvasHeight: canvasConfig.designHeight,
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  config: canvasConfig,
  shrinkingNodeId: null,
  shrinkOrigin: null,

  addNode: (nodeData, parentId = null) => {
    const id = nanoid(10)
    const node: ComponentNode = { ...nodeData, id, parentId }

    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.set(id, node)

      if (parentId) {
        const parent = newNodes.get(parentId)
        if (parent) {
          newNodes.set(parentId, {
            ...parent,
            children: [...parent.children, id],
          })
        }
        return { nodes: newNodes }
      }

      return {
        nodes: newNodes,
        rootChildren: [...state.rootChildren, id],
      }
    })

    return id
  },

  removeNode: (id) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const newNodes = new Map(state.nodes)

      // Recursively remove children
      const removeRecursive = (nodeId: string) => {
        const n = newNodes.get(nodeId)
        if (!n) return
        n.children.forEach(removeRecursive)
        newNodes.delete(nodeId)
      }
      removeRecursive(id)

      // Remove from parent's children or rootChildren
      if (node.parentId) {
        const parent = newNodes.get(node.parentId)
        if (parent) {
          newNodes.set(node.parentId, {
            ...parent,
            children: parent.children.filter(cid => cid !== id),
          })
        }
      }

      return {
        nodes: newNodes,
        rootChildren: state.rootChildren.filter(cid => cid !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    })
  },

  updateNode: (id, changes) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state
      const newNodes = new Map(state.nodes)
      newNodes.set(id, { ...node, ...changes })
      return { nodes: newNodes }
    })
  },

  updateNodeStyles: (id, styles) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state
      const newNodes = new Map(state.nodes)
      newNodes.set(id, {
        ...node,
        styles: { ...node.styles, ...styles } as React.CSSProperties,
      })
      return { nodes: newNodes }
    })
  },

  moveNode: (id, newParentId, newX, newY) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const newNodes = new Map(state.nodes)

      // Remove from old parent
      if (node.parentId) {
        const oldParent = newNodes.get(node.parentId)
        if (oldParent) {
          newNodes.set(node.parentId, {
            ...oldParent,
            children: oldParent.children.filter(cid => cid !== id),
          })
        }
      }

      // Add to new parent
      if (newParentId) {
        const newParent = newNodes.get(newParentId)
        if (newParent) {
          newNodes.set(newParentId, {
            ...newParent,
            children: [...newParent.children, id],
          })
        }
      }

      // Update node
      newNodes.set(id, {
        ...node,
        parentId: newParentId,
        x: newX,
        y: newY,
      })

      return {
        nodes: newNodes,
        rootChildren: node.parentId === null && newParentId !== null
          ? state.rootChildren.filter(cid => cid !== id)
          : node.parentId !== null && newParentId === null
            ? [...state.rootChildren, id]
            : state.rootChildren,
      }
    })
  },

  selectNode: (id) => set({ selectedId: id }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setCanvasHeight: (height) => set({ canvasHeight: height }),
  setZoom: (zoom) => set({ zoom }),
  setScroll: (x, y) => set({ scrollX: x, scrollY: y }),
  getNode: (id) => get().nodes.get(id),

  getAbsolutePos: (id) => {
    return getAbsolutePosition(id, get().nodes)
  },

  checkAutoGrow: (componentBottom) => {
    const state = get()
    if (!state.config.autoGrow) return
    const threshold = state.canvasHeight - 100
    if (componentBottom > threshold) {
      const newHeight = componentBottom + state.config.autoGrowPadding
      set({ canvasHeight: Math.max(newHeight, state.canvasHeight) })
    }
  },

  startShrink: (nodeId, originX, originY) => {
    set({ shrinkingNodeId: nodeId, shrinkOrigin: { x: originX, y: originY } })
  },

  clearShrink: () => {
    set({ shrinkingNodeId: null, shrinkOrigin: null })
  },
}))
