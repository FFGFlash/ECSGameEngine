import { ComponentName, ComponentData, EntityID } from 'src/World'

export default class Archetype<Names extends readonly ComponentName[] = any> {
  readonly signature: ReadonlySet<ComponentName>
  private entities: EntityID[] = []
  private columns: ComponentStore<Names>

  constructor(componentKeys: Names) {
    this.signature = new Set(componentKeys)
    this.columns = Object.fromEntries(
      componentKeys.map(key => [key, [] as ComponentData[]]),
    ) as ComponentStore<Names>
  }

  get length() {
    return this.entities.length
  }

  addEntity(entity: EntityID, components: ComponentMapStore<Names>) {
    this.entities.push(entity)
    for (const key of this.signature) {
      this.columns[key as Names[number]].push(components[key as Names[number]])
    }
  }

  getEntityIndex(entity: EntityID): number {
    const index = this.entities.indexOf(entity)
    if (index === -1) throw new Error(`Entity ${entity} not found in archetype`)
    return index
  }

  getComponentAt<K extends ComponentName>(name: K, index: number) {
    if (index < 0 || index >= this.entities.length)
      throw new RangeError(`Index ${index} out of bounds for archetype`)
    return this.columns[name][index]
  }

  removeEntity(entity: EntityID) {
    const index = this.getEntityIndex(entity)
    this.entities.splice(index, 1)
    for (const key of this.signature) {
      this.columns[key as Names[number]].splice(index, 1)
    }
  }

  matches<Selected extends readonly ComponentName[]>(
    requested: Selected,
  ): requested is Names & Selected {
    for (const name of requested) {
      if (!this.signature.has(name)) return false
    }
    return true
  }

  *query<Selected extends readonly ComponentName[]>(
    requested: Selected,
  ): IterableIterator<[EntityID, ...ComponentList<Selected>]> {
    for (const name of requested) {
      if (!this.signature.has(name)) return
    }
    for (let i = 0; i < this.entities.length; i++) {
      const row = Array.from(requested).map(k => (this.columns as any)[k][i]) as unknown as {
        [K in keyof Selected]: ComponentData<Selected[K]>
      }
      yield [this.entities[i], ...row]
    }
  }
}

export type ComponentMap<Names extends ComponentName = ComponentName> = {
  [K in Names]: ComponentData<K>
}

export type ComponentMapStore<Names extends readonly ComponentName[] = any> = {
  [K in Names[number]]: ComponentData<K>
}

export type ComponentStore<Names extends readonly ComponentName[] = any> = {
  [K in Names[number]]: ComponentData<K>[]
}

export type ComponentList<Names extends readonly ComponentName[] = any> = {
  [K in keyof Names]: ComponentData<Names[K]>
}
