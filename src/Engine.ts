import logger from 'src/logger'
import system, {
  type SystemCallback,
  type SystemDependencyCallback,
  type System,
  SystemFlags,
} from './System'
import World, { AvailableNames, ComponentName, EntityID, ResourceData, ResourceName } from './World'
import scheduler, { topologicalSort } from './Scheduler'

const debug = logger.extend('engine')

export default class Engine<Resources extends readonly ResourceName[] = []> {
  private _world = new World<Resources>()
  private systems = new Map<SystemType, System[]>()

  get world() {
    return this._world
  }

  createEntity(): EntityID {
    return this.world.createEntity()
  }

  addResource<
    N extends AvailableNames<Resources, ResourceName>,
    R extends readonly ResourceName[] = [...Resources, N],
  >(name: N, data: ResourceData<N>): Engine<R> {
    this.world.addResource(name, data)
    return this
  }

  getResource<N extends ResourceName>(name: N) {
    return this.world.getResource(name)
  }

  getMutableResource<N extends ResourceName>(name: N) {
    return this.world.getMutableResource(name)
  }

  get query() {
    return this.world.query
  }

  createSystem<T extends any[]>(
    deps: SystemDependencyCallback<T, Resources>,
    fn: SystemCallback<T>,
  ): System<T>
  createSystem<T extends any[]>(fn: SystemCallback<T>): System<T>
  createSystem<T extends any[]>(
    ...args: [SystemDependencyCallback<T, Resources>, SystemCallback<T>] | [SystemCallback<T>]
  ) {
    return system<T>(...(args as Parameters<typeof system>))
  }

  getSystems(type: SystemType): System[] | undefined {
    return this.systems.get(type)
  }

  getSystem(name: string): System | undefined
  getSystem(type: SystemType, name: string): System | undefined
  getSystem(typeOrName?: SystemType | string, name?: string) {
    if (typeof typeOrName === 'string') {
      name = typeOrName
      typeOrName = undefined
    }

    if (name == null) throw new TypeError('Name must be provided')

    if (typeOrName != null) {
      const systems = this.systems.get(typeOrName)
      if (!systems) return undefined
      return systems.find(sys => sys.name === name)
    }

    for (const systems of this.systems.values()) {
      const sys = systems.find(s => s.name === name)
      if (sys) return sys
    }

    return undefined
  }

  registerSystems(type: SystemType, ...systems: System[]) {
    debug(
      'Registering %s systems: %o',
      SystemType[type],
      systems.map(sys => sys.name || sys),
    )
    if (!this.systems.has(type)) this.systems.set(type, [])
    const systemList = this.systems.get(type)!

    for (const sys of systems) {
      if (systemList.includes(sys)) {
        console.warn(`System already registered: ${sys}`)
        continue
      }

      if (typeof sys !== 'function') throw new TypeError('System must be a function')

      systemList.push(sys)
    }
  }

  private getTrackedWorld(reads: Set<string>, writes: Set<string>, flags: SystemFlags) {
    return new Proxy(this.world, {
      get(target, prop, receiver) {
        if (
          typeof prop !== 'string' ||
          (prop !== 'query' && prop !== 'commands' && !prop.startsWith('get'))
        ) {
          return Reflect.get(target, prop, receiver)
        }

        if (prop === 'commands') {
          flags.sync = true
          return target.commands
        }

        //! Handle get[Mutable]<Name> queries. Ex. getResource or getMutableResource
        if (prop !== 'query') {
          const match = prop.match(/^get(Mutable)?(.+)$/)
          if (!match) return Reflect.get(target, prop, receiver)
          const [, mutable, name] = match
          if (mutable) {
            return (...names: string[]) => {
              names.forEach(n => {
                const id = `${name.toLowerCase()}#${n}`
                if (reads.has(id)) reads.delete(id)
                writes.add(id)
              })
              return (target as any)[`getMutable${name}`](...names)
            }
          }

          return (...names: string[]) => {
            names.forEach(n => {
              const id = `${name.toLowerCase()}#${n}`
              if (writes.has(id)) return
              reads.add(id)
            })
            return (target as any)[`get${name}`](...names)
          }
        }

        //! Handle entity queries
        return new Proxy(target.query, {
          get(qTarget, qProp, qReceiver) {
            if (qProp === 'read') {
              return (...names: ComponentName[]) => {
                names.forEach(name => {
                  const id = `component#${name}`
                  if (writes.has(id)) return
                  reads.add(id)
                })
                return qTarget.read(...names)
              }
            } else if (qProp === 'write') {
              return (...names: ComponentName[]) => {
                names.forEach(name => {
                  const id = `component#${name}`
                  if (reads.has(id)) reads.delete(id)
                  writes.add(id)
                })
                return qTarget.write(...names)
              }
            }
            return Reflect.get(qTarget, qProp, qReceiver)
          },
        })
      },
    })
  }

  private initializeSystems() {
    for (const systems of this.systems.values()) {
      for (const sys of systems) {
        if (typeof sys.getArgs !== 'function' || sys._reads || sys._writes) continue
        sys._reads = new Set<string>()
        sys._writes = new Set<string>()
        sys._flags ??= {}
        sys.getArgs(this.getTrackedWorld(sys._reads, sys._writes, sys._flags))
      }
    }
  }

  private loopController?: AbortController

  async start(options: RunOptions = {}) {
    this.initializeSystems()

    const startupSystems = topologicalSort(this.systems.get(SystemType.STARTUP) || [])
    const fixedUpdateSystems = topologicalSort(this.systems.get(SystemType.FIXED_UPDATE) || [])
    const renderSystems = topologicalSort(this.systems.get(SystemType.RENDER) || [])
    const updateSystems = topologicalSort(this.systems.get(SystemType.UPDATE) || [])

    const FIXED_DT = options.timestep ?? 1000 / 60 // Default to 60 UPS

    await scheduler(this.world, startupSystems)

    let last = performance.now()
    let acc = 0

    const loop = async () => {
      const now = performance.now()
      const delta = now - last
      last = now

      acc += delta

      while (acc >= FIXED_DT) {
        await scheduler(this.world, fixedUpdateSystems)
        acc -= FIXED_DT
      }

      await scheduler(this.world, updateSystems)
      await scheduler(this.world, renderSystems)

      if (this.loopController?.signal.aborted) return
      loopId = requestAnimationFrame(loop)
    }

    let loopId = requestAnimationFrame(loop)

    this.loopController = new AbortController()

    this.loopController.signal.addEventListener('abort', () => cancelAnimationFrame(loopId))
  }

  stop() {
    if (this.loopController) {
      this.loopController.abort()
      this.loopController = undefined
    } else {
      console.warn('Engine is not running, cannot stop')
    }
  }
}

export enum SystemType {
  STARTUP,
  FIXED_UPDATE,
  UPDATE,
  RENDER,
}

export type RunOptions = {
  timestep?: number
}
