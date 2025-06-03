import Archetype, { ComponentMap, ComponentMapStore, ComponentStore } from './Archetype'
import ArchetypeMap from './ArchetypeMap'
import Query from './Query'

export default class World<Resources extends readonly ResourceName[] = []> {
  private nextEntityId = 0
  private archetypes = new ArchetypeMap()
  private entityArchetypeMap = new Map<EntityID, Archetype | null>()
  private resources: {
    [K in Resources[number]]: ResourceData<K>
  } = {} as any

  constructor() {}

  createEntity(): EntityID {
    const id = this.nextEntityId++
    this.entityArchetypeMap.set(id, null)
    return id
  }

  addResource<
    N extends AvailableNames<Resources, ResourceName>,
    R extends readonly ResourceName[] = [...Resources, N],
  >(name: N, data: ResourceData<N>): World<R> {
    this.resources[name] = data
    return this
  }

  getResource<N extends ResourceName>(name: N): Readonly<ResourceData<N>> {
    if (!(name in this.resources)) throw new Error(`Resource ${name} does not exist`)
    return Object.freeze(structuredClone(this.resources[name]))
  }

  getMutableResource<N extends ResourceName>(name: N): ResourceData<N> {
    if (!(name in this.resources)) throw new Error(`Resource ${name} does not exist`)
    return this.resources[name]
  }

  private getOrCreateArchetype<Names extends readonly ComponentName[]>(
    keys: Names,
  ): Archetype<Names> {
    if (!this.archetypes.has(keys)) {
      const newArchetype = new Archetype<Names>(keys)
      this.archetypes.set(keys, newArchetype)
    }
    return this.archetypes.get(keys)!
  }

  setComponents<N extends readonly ComponentName[]>(
    entity: EntityID,
    components: ComponentMapStore<N>,
  ) {
    if (!this.entityArchetypeMap.has(entity)) throw new Error(`Entity ${entity} does not exist`)
    const oldArchetype = this.entityArchetypeMap.get(entity)

    if (oldArchetype != null) {
      oldArchetype.removeEntity(entity)

      if (oldArchetype.length === 0) {
        this.archetypes.delete(Array.from(oldArchetype.signature))
      }
    }

    const newArchetype = this.getOrCreateArchetype<N>([...Object.keys(components)] as unknown as N)
    newArchetype.addEntity(entity, components)
    this.entityArchetypeMap.set(entity, newArchetype)

    return this
  }

  addComponent<N extends ComponentName>(entity: EntityID, name: N, data: ComponentData<N>) {
    if (!this.entityArchetypeMap.has(entity)) throw new Error(`Entity ${entity} does not exist`)
    const oldArchetype = this.entityArchetypeMap.get(entity)

    const newKeys: ComponentName[] = [name]
    let oldValues: ComponentMap = {} as any

    if (oldArchetype != null) {
      const index = oldArchetype.getEntityIndex(entity)
      const oldKeys = Array.from(oldArchetype.signature).filter(k => k !== name)
      oldValues = oldKeys.reduce((acc, key) => {
        acc[key] = oldArchetype.getComponentAt(key, index) as any
        return acc
      }, {} as ComponentMap)
      newKeys.unshift(...oldKeys)
      oldArchetype.removeEntity(entity)

      if (oldArchetype.length === 0) {
        this.archetypes.delete(Array.from(oldArchetype.signature))
      }
    }

    const newArchetype = this.getOrCreateArchetype(newKeys)
    newArchetype.addEntity(entity, { ...oldValues, [name]: data } as ComponentMap)

    return this
  }

  removeComponent(entity: EntityID, name: ComponentName) {
    if (!this.entityArchetypeMap.has(entity)) throw new Error(`Entity ${entity} does not exist`)
    const oldArchetype = this.entityArchetypeMap.get(entity)
    if (oldArchetype == null || !oldArchetype.signature.has(name)) return this

    const index = oldArchetype.getEntityIndex(entity)
    const newKeys = Array.from(oldArchetype.signature).filter(k => k !== name)
    const newValues = newKeys.reduce((acc, key) => {
      acc[key] = oldArchetype.getComponentAt(key, index) as any
      return acc
    }, {} as ComponentMap)

    const newArchetype = this.getOrCreateArchetype(newKeys)

    oldArchetype.removeEntity(entity)
    newArchetype.addEntity(entity, newValues)
    this.entityArchetypeMap.set(entity, newArchetype)

    if (oldArchetype.length === 0) {
      this.archetypes.delete(Array.from(oldArchetype.signature))
    }

    return this
  }

  get commands() {
    return {
      spawn: <Names extends ComponentName>(components: ComponentMap<Names>) => {
        const entity = this.createEntity()
        this.setComponents(entity, components as ComponentMapStore)
        return entity
      },
    }
  }

  get query() {
    return new Query(this.archetypes)
  }
}

export type EntityID = number

export interface ComponentRegistry {}
export type ComponentName = keyof ComponentRegistry
export type ComponentData<T extends ComponentName = ComponentName> = ComponentRegistry[T]

export interface ResourceRegistry {
  score: { value: number }
}
export type ResourceName = keyof ResourceRegistry
export type ResourceData<T extends ResourceName = ResourceName> = ResourceRegistry[T]

export type AvailableNames<AlreadyUsed extends readonly string[], Names extends string> = Exclude<
  Names,
  AlreadyUsed[number]
>

export type ResourceMap<N extends readonly ResourceName[]> = {
  [K in keyof N]: ResourceData<N[K]>
}
