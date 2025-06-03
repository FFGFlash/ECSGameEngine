import ArchetypeMap from './ArchetypeMap'
import type { ComponentData, ComponentName } from './World'

export default class Query<Accesses extends AccessList = []> {
  private _iterator?: Iterator<QueryYield<Accesses>>
  private _peeked?: IteratorResult<QueryYield<Accesses>>
  private _locked = false

  private components = new Map<ComponentName, AccessMode>()

  constructor(private archetypes: ArchetypeMap) {}

  read<
    N extends AvailableComponentNames<Accesses>[],
    A extends AccessList = [...Accesses, ...{ [K in keyof N]: [N[K], 'read'] }],
  >(...names: N): Query<A> {
    if (this._locked) throw new Error('Query is locked and cannot be modified')
    for (const name of names) {
      if (this.components.has(name)) throw new Error(`Component ${name} already used in this query`)
      this.components.set(name, 'read')
    }
    return this as Query<A>
  }

  lock() {
    this._locked = true
  }

  write<
    N extends AvailableComponentNames<Accesses>[],
    A extends AccessList = [...Accesses, ...{ [K in keyof N]: [N[K], 'write'] }],
  >(...names: N): Query<A> {
    if (this._locked) throw new Error('Query is locked and cannot be modified')
    for (const name of names) {
      if (this.components.has(name)) throw new Error(`Component ${name} already used in this query`)
      this.components.set(name, 'write')
    }
    return this as Query<A>
  }

  with<
    N extends AvailableComponentNames<Accesses>[],
    A extends AccessList = [...Accesses, ...{ [K in keyof N]: [N[K], 'none'] }],
  >(...names: N): Query<A> {
    if (this._locked) throw new Error('Query is locked and cannot be modified')
    for (const name of names) {
      if (this.components.has(name)) throw new Error(`Component ${name} already used in this query`)
      this.components.set(name, 'none')
    }
    return this as Query<A>
  }

  reset() {
    this._iterator = undefined
    this._peeked = undefined
  }

  peek() {
    if (!this._iterator) this._iterator = this.makeIterator()
    if (!this._peeked) this._peeked = this._iterator.next()
    return this._peeked.done ? undefined : this._peeked.value
  }

  next() {
    if (!this._iterator) this._iterator = this.makeIterator()
    if (this._peeked) {
      const result = this._peeked
      this._peeked = undefined
      return result
    }
    return this._iterator.next()
  }

  private *makeIterator(): Iterator<QueryYield<Accesses>> {
    const names = [...this.components.keys()]
    const filteredNames = names.filter(name => this.components.get(name) !== 'none')

    for (const arch of this.archetypes.values()) {
      if (!arch.matches(names)) continue
      for (const [entity, ...components] of arch.query(filteredNames)) {
        const lockedComponents = components.map((comp, i) => {
          const name = names[i]
          if (this.components.get(name) === 'write') return comp
          return Object.freeze({ ...(comp as any) }) // Freeze for read access
        })

        // Yield the entity ID and the components with their access modes
        yield [entity, ...lockedComponents] as QueryYield<Accesses>
      }
    }
  }

  [Symbol.iterator](): Iterator<QueryYield<Accesses>> {
    this._iterator = this.makeIterator()
    this._peeked = undefined
    return this._iterator
  }
}

export type AccessMode = 'read' | 'write' | 'none'
export type AccessList = [ComponentName, AccessMode][]

export type QueryYield<T extends AccessList> = [
  number,
  ...{
    [K in keyof T]: T[K] extends [infer N, infer A]
      ? N extends ComponentName
        ? A extends 'read'
          ? Readonly<ComponentData<N>>
          : A extends 'write'
          ? ComponentData<N>
          : never
        : never
      : never
  },
]
export type AvailableComponentNames<T extends AccessList> = Exclude<ComponentName, T[number][0]>
