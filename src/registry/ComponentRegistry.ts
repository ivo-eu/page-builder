import type { ComponentManifest, ComponentNode } from '../types/component'

class ComponentRegistry {
  private manifests = new Map<string, ComponentManifest>()

  register(manifest: ComponentManifest) {
    this.manifests.set(manifest.name, manifest)
  }

  get(name: string): ComponentManifest | undefined {
    return this.manifests.get(name)
  }

  getAll(): ComponentManifest[] {
    return Array.from(this.manifests.values())
  }

  getByCategory(category: string): ComponentManifest[] {
    return this.getAll().filter(m => m.category === category)
  }

  getCategories(): string[] {
    const cats = new Set(this.getAll().map(m => m.category))
    return Array.from(cats)
  }

  /** 获取所有非内置组件的 import 信息 */
  getExternalImports(): { package: string; importName: string; importPath: string }[] {
    return this.getAll()
      .filter(m => m.package !== '')
      .map(m => ({ package: m.package, importName: m.importName, importPath: m.importPath }))
  }

  /** 创建组件节点默认数据 */
  createNode(type: string, x: number, y: number): Omit<ComponentNode, 'id'> | null {
    const manifest = this.get(type)
    if (!manifest) return null

    return {
      type,
      parentId: null,
      x,
      y,
      width: manifest.defaultSize.width,
      height: manifest.defaultSize.height,
      props: { ...manifest.defaultProps },
      styles: {},
      children: [],
      isContainer: manifest.isContainer,
      locked: false,
      visible: true,
      eventBindings: [],
    }
  }
}

export const registry = new ComponentRegistry()
