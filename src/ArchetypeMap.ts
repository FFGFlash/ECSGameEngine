import Archetype from './Archetype'
import type { ComponentName } from './World'

export default class ArchetypeMap {
  private static componentMap = new Map<ComponentName, number>()
  private static getComponentId(name: ComponentName) {
    if (!this.componentMap.has(name)) this.componentMap.set(name, this.componentMap.size)
    return this.componentMap.get(name)!
  }

  private map = new Map<string, Archetype>()

  private normalizeKey(keys: readonly ComponentName[]) {
    return keys
      .map(k => ArchetypeMap.getComponentId(k))
      .sort((a, b) => a - b)
      .join('|')
  }

  get<Names extends readonly ComponentName[]>(keys: Names) {
    return this.map.get(this.normalizeKey(keys)) as Archetype<Names> | undefined
  }

  set<Names extends readonly ComponentName[]>(keys: Names, archetype: Archetype<Names>) {
    this.map.set(this.normalizeKey(keys), archetype)
    return this
  }

  has(keys: readonly ComponentName[]): boolean {
    return this.map.has(this.normalizeKey(keys))
  }

  delete(keys: readonly ComponentName[]): boolean {
    return this.map.delete(this.normalizeKey(keys))
  }

  clear() {
    this.map.clear()
  }

  keys(): IterableIterator<string> {
    return this.map.keys()
  }

  values(): IterableIterator<Archetype> {
    return this.map.values()
  }

  entries(): IterableIterator<[string, Archetype]> {
    return this.map.entries()
  }
}
