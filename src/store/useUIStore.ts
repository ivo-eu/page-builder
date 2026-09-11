import { create } from 'zustand'

interface UIStore {
  showPropertyPanel: boolean
  propertyPanelTarget: string | null
  isFlipping: boolean

  /** 编辑前的快照（props + styles + width + height），用于空输入恢复 */
  editingSnapshot: Record<string, any> | null

  openPropertyPanel: (targetId: string) => void
  closePropertyPanel: () => void
  setFlipping: (flipping: boolean) => void
  setEditingSnapshot: (snapshot: Record<string, any> | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  showPropertyPanel: false,
  propertyPanelTarget: null,
  isFlipping: false,
  editingSnapshot: null,

  openPropertyPanel: (targetId) => {
    set({ showPropertyPanel: true, propertyPanelTarget: targetId, isFlipping: true })
    // Reset flip state after animation
    setTimeout(() => set({ isFlipping: false }), 500)
  },

  closePropertyPanel: () => {
    set({ showPropertyPanel: false, propertyPanelTarget: null, isFlipping: true, editingSnapshot: null })
    setTimeout(() => set({ isFlipping: false }), 500)
  },

  setFlipping: (flipping) => set({ isFlipping: flipping }),

  setEditingSnapshot: (snapshot) => set({ editingSnapshot: snapshot }),
}))
