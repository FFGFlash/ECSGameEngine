import { ComponentOf, EntityID, ComponentName } from './types'
import ArchetypeMap from './ArchetypeMap'
import Archetype from './Archetype'
import logger from './logger'
import Query from './Query'

const debug = logger.extend('world')

export default class World {
  private nextEntityId = 0
  private archetypes = new ArchetypeMap()
  private entityArchetype = new Map<EntityID, Archetype | null>()
  private systems: System[] = []

  private getOrCreateArchetype(keys: ComponentName[]): Archetype {
    if (!this.archetypes.has(keys)) {
      const archetype = new Archetype(keys)
      this.archetypes.set(keys, archetype)
    }
    return this.archetypes.get(keys)!
  }

  createEntity(): EntityID {
    const entity = this.nextEntityId++
    debug('Creating entity %d', entity)
    this.entityArchetype.set(entity, null)
    return entity
  }

  addComponent<K extends ComponentName>(entity: EntityID, name: K, data: ComponentOf<K>) {
    debug('Adding component %s to entity %d\n%o', name, entity, data)
    if (!this.entityArchetype.has(entity)) throw new Error('Entity does not exist')
    const oldArchetype = this.entityArchetype.get(entity)

    const newKeys: ComponentName[] = [name]
    let oldValues: Partial<Record<ComponentName, any>> = {}

    if (oldArchetype) {
      const index = oldArchetype.getEntityIndex(entity)
      const oldKeys = (oldArchetype.componentKeys as ComponentName[]).filter(k => k !== name)
      oldValues = oldKeys.reduce((acc, key) => {
        acc[key] = oldArchetype.getComponentAt(key, index)
        return acc
      }, {} as Record<ComponentName, any>)

      newKeys.unshift(...oldKeys)
      oldArchetype.removeEntity(entity)
    }

    const newArchetype = this.getOrCreateArchetype(newKeys)
    newArchetype.addEntity(entity, {
      ...oldValues,
      [name]: data,
    })

    this.entityArchetype.set(entity, newArchetype)

    debug('Entity %d now has archetype %o', entity, newArchetype.componentKeys)

    return this
  }

  removeComponent(entity: EntityID, name: ComponentName) {
    debug('Removing component %s from entity %d', name, entity)
    if (!this.entityArchetype.has(entity)) throw new Error('Entity does not exist')
    const oldArchetype = this.entityArchetype.get(entity)
    if (!oldArchetype?.componentKeys.includes(name)) return this

    const index = oldArchetype.getEntityIndex(entity)
    const newKeys = (oldArchetype.componentKeys as ComponentName[]).filter(k => k !== name)
    const newValues = newKeys.reduce((acc, key) => {
      acc[key] = oldArchetype.getComponentAt(key, index)
      return acc
    }, {} as Record<ComponentName, any>)

    const newArchetype = this.getOrCreateArchetype(newKeys)

    oldArchetype.removeEntity(entity)
    newArchetype.addEntity(entity, newValues)
    this.entityArchetype.set(entity, newArchetype)

    debug('Entity %d now has archetype %o', entity, newArchetype.componentKeys)

    return this
  }

  getComponent<K extends ComponentName>(entity: EntityID, name: K): ComponentOf<K> | undefined {
    debug('Getting component %s from entity %d', name, entity)
    if (!this.entityArchetype.has(entity)) throw new Error('Entity does not exist')
    const archetype = this.entityArchetype.get(entity)
    if (!archetype) return undefined

    const index = archetype.getEntityIndex(entity)
    if (index === -1) return undefined

    return archetype.getComponentAt<K>(name, index)
  }

  queryArchetypes<Names extends readonly ComponentName[]>(names: Names) {
    debug('Querying archetype for components %o', names)
    const requested = new Set(names)
    return Array.from(this.archetypes.values()).filter(a => a.matches(requested))
  }

  get query(): Query {
    return new Query(this)
  }

  private createTrackedWorld(reads: Set<ComponentName>, writes: Set<ComponentName>) {
    return new Proxy(this, {
      get(target, p, receiver) {
        if (p !== 'query') return Reflect.get(target, p, receiver)
        return () => {
          const query = new Proxy(target.query, {
            get(qTarget, qProp, qReceiver) {
              if (qProp === 'write') {
                return (...names: ComponentName[]) => {
                  names.forEach(name => writes.add(name))
                  return qTarget.write(...names)
                }
              } else if (qProp === 'read') {
                return (...names: ComponentName[]) => {
                  names.forEach(name => reads.add(name))
                  return qTarget.read(...names)
                }
              }
              return Reflect.get(qTarget, qProp, qReceiver)
            },
          })
          return query
        }
      },
    })
  }

  registerSystem(run: SystemCallback, constraints: SystemConstraints = {}) {
    const reads = new Set(constraints.reads)
    const writes = new Set(constraints.writes)

    const trackedWorld = this.createTrackedWorld(reads, writes)

    try {
      run(trackedWorld, 0)
    } catch {}

    const system: System = {
      run,
      constraints: {
        ...constraints,
        reads: Array.from(reads),
        writes: Array.from(writes),
      },
    }
    debug('Registering system %o', system)

    this.systems.push(system)

    return this
  }

  async update(deltaTime: number) {
    debug('Updating world with %d systems', this.systems.length)
    await scheduleAndRunSystems(this, this.systems, deltaTime)
  }

  private loopIdentifier?: number

  startLoop(options: LoopOptions = {}) {
    const { timestep = 1000 / 60, onUpdate = dt => this.update(dt), onRender = () => {} } = options

    let last = performance.now()
    let acc = 0

    const loop = async (now: number) => {
      const delta = now - last
      last = now
      acc += delta

      while (acc >= timestep) {
        await onUpdate(timestep)
        acc -= timestep
      }

      const alpha = acc / timestep
      await onRender(alpha)

      if (!this.loopIdentifier) return // Stop if loopIdentifier is cleared
      this.loopIdentifier = requestAnimationFrame(loop)
    }

    this.loopIdentifier = requestAnimationFrame(loop)
  }

  stopLoop() {
    if (this.loopIdentifier) {
      cancelAnimationFrame(this.loopIdentifier)
      delete this.loopIdentifier
      debug('Loop stopped')
    } else {
      debug('No loop to stop')
    }
  }
}

export type LoopOptions = {
  timestep?: number
  onUpdate?: (deltaTime: number) => Promise<void> | void
  onRender?: (alpha: number) => Promise<void> | void
}

export type System = {
  run: SystemCallback
  constraints: SystemConstraints
}

export type SystemCallback = (world: World, deltaTime: number) => void

export type SystemConstraints = {
  reads?: ComponentName[]
  writes?: ComponentName[]
}

async function scheduleAndRunSystems(world: World, systems: System[], deltaTime: number) {
  const scheduledBatches: System[][] = []

  for (const system of systems) {
    let placed = false

    for (const batch of scheduledBatches) {
      if (!conflictsWithBatch(system, batch)) {
        batch.push(system)
        placed = true
        break
      }
    }

    if (!placed) {
      scheduledBatches.push([system])
    }
  }

  for (const batch of scheduledBatches) {
    await Promise.all(
      batch.map(sys => new Promise<void>(resolve => resolve(sys.run(world, deltaTime)))),
    )
  }
}

function conflictsWithBatch(system: System, batch: System[]): boolean {
  return batch.some(other => systemsConflict(system, other))
}

function systemsConflict(a: System, b: System): boolean {
  const aRead = new Set(a.constraints.reads || [])
  const aWrite = new Set(a.constraints.writes || [])
  const bRead = new Set(b.constraints.reads || [])
  const bWrite = new Set(b.constraints.writes || [])

  for (const r of aRead) if (bWrite.has(r)) return true
  for (const w of aWrite) if (bRead.has(w) || bWrite.has(w)) return true
  return false
}
