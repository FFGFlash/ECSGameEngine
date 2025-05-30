/**
 * The component registry defines the types of components that can be used in the ECS (Entity-Component-System) architecture.
 */
export interface ComponentRegistry {}

/**
 * The name of a component in the ECS system, which corresponds to a key in the ComponentRegistry.
 */
export type ComponentName = keyof ComponentRegistry

/**
 * The type of a component in the ECS system, which is defined in the ComponentRegistry.
 */
export type ComponentOf<K extends ComponentName> = ComponentRegistry[K]

/**
 * Represents a unique identifier for an entity in the ECS system.
 */
export type EntityID = number

export type Components<Names extends readonly ComponentName[]> = {
  [K in Names[number]]: ComponentOf<K>
}

export type ComponentStore<Names extends readonly ComponentName[]> = {
  [K in Names[number]]: ComponentOf<K>[]
}

export type QueryIterator<Names extends readonly ComponentName[]> = IterableIterator<
  QueryResult<Names>
>

export type QueryResult<Names extends readonly ComponentName[]> = [
  EntityID,
  ...{ [K in keyof Names]: ComponentOf<Names[K]> },
]
