# @FFGFlash/ECS

A simple Entity Component System written in TypeScript for creating games.

## Example

```ts
import { World } from '@ffgflash/ecs'

declare module '@ffgflash/ecs' {
  interface ComponentRegistry {
    position: { x: number; y: number }
    velocity: { dx: number; dy: number }
  }
}

function movementSystem(world: World, deltaTime: number) {
  for (const [, pos, vel] of world.query.write('position').read('velocity')) {
    pos.x += vel.dx * deltaTime
    pos.y += vel.dy * deltaTime
  }
}

const world = new World().registerSystem(movementSystem)

const player = world.createEntity()

world
  .addComponent(player, 'position', { x: 0, y: 0 })
  .addComponent(player, 'velocity', { dx: 1, dy: 1 })

world.startLoop()
```

## TODO

- [x] Create Entities & Components
- [x] Register Systems
- [x] Efficiently Query for Entities
- [ ] Add More System Options
  - [ ] Add labels, before and after (system) options to give more control over execution order.
  - [ ] Enable the ability to turn off inferred dependencies
- [ ] Add Resources (Global data for use within systems)
  - Preferably this would work within the existing query system, so probably a refactor.
- [ ] Cleanup, I wrote most of this on no sleep, so some types are a bit all over the place. :3

## Documentation

### `class World()`

This is the main entry point into the ECS system, it manages everything from the gameloop, to all the entities and archetypes.

#### `.registerSystem(run: SystemCallback, constraints?: SystemConstraints): World`

Systems are used to update and control your entities. Such as updating player positions, health, etc.

```ts
world.registerSystem(
  (world, delta) => {
    for (const [, pos, vel] of world.query.write('position').read('velocity')) {
      pos.x += vel.dx * delta
      pos.y += vel.dy * delta
    }
  },
  {
    // The read dependencies for the system
    // (These will be inferred, but queries behind conditional logic will need to be provided here)
    reads: ['velocity'],
    // The write dependencies for the system
    // (These will be inferred, but queries behind conditional logic will need to be provided here)
    writes: ['position'],
  },
)
```

#### `.query`

This will return an instance of the Query class which will let you create iterators for different component combinations.

```ts
for (const [entity, pos, vel] of world.query.write('position').read('velocity')) {
  pos.x += vel.dx * delta
  pos.y += vel.dy * delta
  console.log(`Updated Entity ${entity}'s position: (${pos.x}, ${pos.y})`)
}
```

#### `.update(deltaTime: number)`

This will run all of the systems and will most likely be unused unless you'd like to write your own gameloop.

```ts
world.update(60)
```

#### `.startLoop(options: LoopOptions)`

This will start the game loop and will run all of the systems and the render callback.

```ts
world.startLoop({
  // Control the amount of system updates.
  timestep: 1000 / 60,
  // Callback for overriding the default update logic.
  onUpdate: dt => world.update(dt),
  // Callback for providing rendering logic.
  onRender: alpha => console.log('rendering!'),
})
```

#### `.createEntity(): EntityID`

This will return a unique identifier for the newly created entity, which can be used to later add components.

```ts
const entity = world.createEntity()
```

#### `.addComponent(entity: EntityID, component: ComponentName, data: ComponentOf): World`

Attach a component to the given entity. Components are used for storing data, such as position, velocity and health.

For TypeScript these component types can be registered globally for type-saftey.

```ts
// Registering the position component
declare module '@ffgflash/ecs' {
  interface ComponentRegistry {
    position: { x: number; y: number }
  }
}

const entity = world.createEntity()

world.addComponent(entity, 'position', { x: 0, y: 0 })
```

#### `.removeComponent(entity: EntityID, component: ComponentName): World`

Remove a component from the given entity.

```ts
world.removeComponent(entity, 'position')
```

#### `.getComponent(entity: EntityID, component: ComponentName): ComponentOf | undefined`

Get the current value of a component for the given entity.

```ts
const pos = world.getComponent(entity, 'position')!
console.log(`Entity ${entity}'s current position is (${pos.x}, ${pos.y})`)
```

### `class Query()`

Used to fetch a list of entities who all share the queried components.

#### `.write(...components: ComponentName[]): Query`

Used to query for components and get them back as a mutable object.

```ts
for (const [, pos] of world.query.write('position')) {
  pos.x += 1
}
```

#### `.read(...components: ComponentName[]): Query`

Used to query for components and get them back as a read-only object.

```ts
for (const [entity, pos] of world.query.read('position')) {
  console.log(`Entity ${entity}'s current position is (${pos.x}, ${pos.y})`)
}
```
