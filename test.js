import { World } from './dist/index.cjs'

function moveSystem(world) {
  for (const [, vel, pos] of world.query.read('velocity').write('position')) {
    pos.x += vel.dx
    pos.y += vel.dy
  }
}

const world = new World()

world.registerSystem(moveSystem)

const player = world.createEntity()
world.addComponent(player, 'position', { x: 0, y: 0 })
world.addComponent(player, 'velocity', { dx: 1, dy: 1 })

console.log(world.getComponent(player, 'position'))

world.update()

console.log(world.getComponent(player, 'position'))
