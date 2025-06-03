import World, { ResourceName } from './World'

export default function system<T extends any[]>(
  deps: SystemDependencyCallback<T>,
  fn: SystemCallback<T>,
): System<T>

export default function system<T extends any[]>(fn: SystemCallback<T>): System<T>

export default function system<T extends any[]>(
  ...args: [SystemDependencyCallback<T>, SystemCallback<T>] | [SystemCallback<T>]
): System<T> {
  let base: SystemCallback<T>
  let deps: SystemDependencyCallback<T> | undefined
  if (args.length === 2) {
    deps = args[0]
    base = args[1]
  } else {
    base = args[0]
  }

  return Object.defineProperties(base, {
    getArgs: {
      get(this: System<T>) {
        return deps || (() => [] as unknown as T)
      },
    },
    after: {
      get(this: System<T>) {
        return (...names: string[]) => {
          if (!this._after) this._after = new Set<string>()
          names.forEach(name => this._after!.add(name))
          return this
        }
      },
    },
    before: {
      get(this: System<T>) {
        return (...names: string[]) => {
          if (!this._before) this._before = new Set<string>()
          names.forEach(name => this._before!.add(name))
          return this
        }
      },
    },
    sync: {
      get(this: System<T>) {
        return () => {
          if (!this._flags) this._flags = {}
          this._flags.sync = true
          return this
        }
      },
    },
  }) as System<T>
}

export type SystemCallback<T extends any[] = any[]> = (...args: NoInfer<T>) => void | Promise<void>

export type SystemDependencyCallback<
  T extends any[] = any[],
  Resources extends readonly ResourceName[] = [],
> = (world: World<Resources>) => T

export interface System<T extends any[] = any[]> {
  _flags?: SystemFlags
  _after?: Set<string>
  _before?: Set<string>
  _reads?: Set<string>
  _writes?: Set<string>
  (...args: T): void | Promise<void>
  get getArgs(): SystemDependencyCallback<T>
  get after(): (...names: string[]) => System<T>
  get before(): (...names: string[]) => System<T>
  get sync(): () => System<T>
}

export interface SystemFlags {
  sync?: boolean
}
