import { ComponentName, ComponentOf, QueryIterator, QueryResult } from './types'
import World from './World'

export default class Query<Accesses extends AccessList = []> {
  private access = new Map<ComponentName, AccessMode>()

  constructor(private world: World) {}

  read<
    N extends AvailableComponentNames<Accesses>[],
    A extends AccessList = [...Accesses, ...{ [K in keyof N]: [N[K], 'read'] }],
  >(...names: IsTupleUnique<N> extends true ? N : never): Query<A> {
    for (const name of names) {
      if (this.access.has(name)) throw new Error(`Component ${name} already used in this query`)
      this.access.set(name, 'read')
    }
    return this as unknown as Query<A>
  }

  write<
    N extends AvailableComponentNames<Accesses>[],
    A extends AccessList = [...Accesses, ...{ [K in keyof N]: [N[K], 'write'] }],
  >(...names: IsTupleUnique<N> extends true ? N : never): Query<A> {
    for (const name of names) {
      if (this.access.has(name)) throw new Error(`Component ${name} already used in this query`)
      this.access.set(name, 'write')
    }
    return this as unknown as Query<A>
  }

  *[Symbol.iterator](): IterableIterator<
    [entity: number, ...components: ComponentAccessMap<Accesses>]
  > {
    const names = [...this.access.keys()]
    const archetypes = this.world.queryArchetypes(names)

    for (const arch of archetypes) {
      for (const [entity, ...components] of arch.query(names)) {
        const lockedComponents = components.map((comp, i) => {
          const name = names[i]
          if (this.access.get(name) === 'write') return comp
          return Object.freeze({ ...(comp as any) })
        })
        yield [entity, ...lockedComponents] as [number, ...ComponentAccessMap<Accesses>]
      }
    }
  }
}

type AccessMode = 'read' | 'write'
type AccessList = [ComponentName, AccessMode][]
type ComponentAccessMap<T extends AccessList> = {
  [K in keyof T]: T[K] extends [infer N, infer A]
    ? N extends ComponentName
      ? A extends 'read'
        ? Readonly<ComponentOf<N>>
        : ComponentOf<N>
      : never
    : never
}
type IsTupleUnique<T extends readonly any[], Seen extends any[] = []> = T extends [
  infer F,
  ...infer R,
]
  ? F extends Seen[number]
    ? false
    : IsTupleUnique<R, [...Seen, F]>
  : true
type UniqueTuple<T extends readonly ComponentName[]> = IsTupleUnique<T> extends true ? T : never
type AvailableComponentNames<Used extends AccessList> = Exclude<ComponentName, Used[number][0]>
