import World from 'src/World'
import { describe, it, expect } from 'vitest'

declare module 'src/types' {
  interface ComponentRegistry {
    position: { x: number; y: number }
    velocity: { dx: number; dy: number }
  }
}

describe('world', () => {
  it('should create an entity', () => {
    const world = new World()
    const entity = world.createEntity()
    expect(entity).toBe(0)
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity)).toBeNull()
  })

  it('should add a component to an entity', () => {
    const world = new World()
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 0, y: 0 })
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity)?.componentKeys).toContain('position')
  })

  it("should update an entity's archetype when adding a component", () => {
    const world = new World()
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 0, y: 0 })
    world.addComponent(entity, 'velocity', { dx: 1, dy: 1 })
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity)?.componentKeys).toEqual(['position', 'velocity'])
  })

  it('should throw an error when adding a component to a non-existent entity', () => {
    const world = new World()
    expect(() => world.addComponent(999, 'position', { x: 0, y: 0 })).toThrow(
      'Entity does not exist',
    )
  })

  it('should create a new archetype when adding a component', () => {
    const world = new World()
    const entity1 = world.createEntity()
    world.addComponent(entity1, 'position', { x: 0, y: 0 })
    const entity2 = world.createEntity()
    world.addComponent(entity2, 'velocity', { dx: 1, dy: 1 })
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity1)?.componentKeys).toEqual(['position'])
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity2)?.componentKeys).toEqual(['velocity'])
  })

  it('should handle multiple components on the same entity', () => {
    const world = new World()
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 0, y: 0 })
    world.addComponent(entity, 'velocity', { dx: 1, dy: 1 })
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity)?.componentKeys).toEqual(['position', 'velocity'])
  })

  it('should use the same archetype for entities with the same components', () => {
    const world = new World()
    const entity1 = world.createEntity()
    world.addComponent(entity1, 'velocity', { dx: 1, dy: 1 })
    world.addComponent(entity1, 'position', { x: 0, y: 0 })
    const entity2 = world.createEntity()
    world.addComponent(entity2, 'position', { x: 1, y: 1 })
    world.addComponent(entity2, 'velocity', { dx: 2, dy: 1 })
    // @ts-expect-error // entityArchetype is private
    expect(world.entityArchetype.get(entity1)).toBe(
      // @ts-expect-error // entityArchetype is private
      world.entityArchetype.get(entity2),
    )
  })

  it('should throw when trying to mutate a component without write access', () => {
    const world = new World()
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 0, y: 0 })
    world.addComponent(entity, 'velocity', { dx: 1, dy: 1 })

    for (const [, vel, pos] of world.query.read('velocity', 'position')) {
      expect(() => {
        // @ts-expect-error // pos is read-only
        pos.x += vel.dx // This should throw because 'position' is read-only
      }).toThrow("Cannot assign to read only property 'x' of object '#<Object>'")
    }
  })

  it('should allow mutation of components with write access', () => {
    const world = new World()
    const entity = world.createEntity()
    world.addComponent(entity, 'position', { x: 0, y: 0 })
    world.addComponent(entity, 'velocity', { dx: 1, dy: 1 })

    for (const [, vel, pos] of world.query.read('velocity').write('position')) {
      pos.x += vel.dx // This should work because 'position' is writable
      expect(pos.x).toBe(1)
    }
  })
})
