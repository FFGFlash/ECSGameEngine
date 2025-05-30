import {
  ComponentOf,
  ComponentStore,
  QueryIterator,
  Components,
  EntityID,
  ComponentName,
} from './types'

export default class Archetype<Names extends readonly ComponentName[] = any> {
  readonly signature: ReadonlySet<ComponentName>
  private entities: EntityID[] = []
  private columns: Record<string, any[]> = {}

  constructor(public componentKeys: Names) {
    this.signature = new Set(componentKeys)
    this.columns = Object.fromEntries(
      componentKeys.map(key => [key, []]),
    ) as unknown as ComponentStore<Names>
  }

  addEntity(entity: EntityID, components: Components<Names>) {
    this.entities.push(entity)
    for (const key of this.componentKeys) {
      this.columns[key].push(components[key as keyof Components<Names>])
    }
  }

  getEntityIndex(entity: EntityID): number {
    const index = this.entities.indexOf(entity)
    if (index === -1) throw new Error(`Entity ${entity} not found in archetype`)
    return index
  }

  getComponentAt<K extends ComponentName>(name: K, index: number): ComponentOf<K> {
    if (index < 0 || index >= this.entities.length)
      throw new RangeError(`Index ${index} out of bounds for archetype`)
    return this.columns[name][index] as ComponentOf<K>
  }

  removeEntity(entity: EntityID) {
    const index = this.getEntityIndex(entity)
    this.entities.splice(index, 1)
    for (const key of this.componentKeys) {
      this.columns[key].splice(index, 1)
    }
  }

  *query<Selected extends readonly ComponentName[]>(requested: Selected): QueryIterator<Selected> {
    for (let i = 0; i < this.entities.length; i++) {
      const row = requested.map(k => this.columns[k][i]) as unknown as {
        [K in keyof Selected]: ComponentOf<Selected[K]>
      }
      yield [this.entities[i], ...row]
    }
  }

  matches(requested: Set<ComponentName>): boolean {
    for (const name of requested) {
      if (!this.signature.has(name)) return false
    }
    return true
  }
}
