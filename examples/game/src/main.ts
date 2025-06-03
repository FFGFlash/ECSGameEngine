import Engine, { Clone, SystemType } from '@ffgflash/ecs'
import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="gameCanvas" width="800" height="600"></canvas>
`

declare module '@ffgflash/ecs' {
  interface ResourceRegistry {
    canvas: HTMLCanvasElement
    ctx: { value: CanvasRenderingContext2D | null }
    input: InputMap
    clearColor: { value: string }
  }

  interface ComponentRegistry {
    position: { x: number; y: number }
    velocity: { dx: number; dy: number }
    player: {}
    speed: { value: number }
    circle: { radius: number }
    color: { value: string }
    health: { value: number }
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')
if (!canvas) throw new Error('Canvas element not found')

class InputMap extends Map<string, number> {
  constructor(entries?: Iterable<readonly [string, number]> | null) {
    super(entries)
  }

  override get(key: string, ...keys: string[]): number {
    if (keys.length === 0) return super.get(key) ?? 0
    keys.unshift(key)
    return keys.find(k => super.get(k) === 1) ? 1 : 0
  }

  [Clone]() {
    return new InputMap(this.entries())
  }

  [Symbol.toStringTag] = 'InputMap'
}

const engine = new Engine()
  .addResource('canvas', canvas)
  .addResource('ctx', { value: null })
  .addResource('input', new InputMap())
  .addResource('clearColor', { value: 'white' })
  .addResource('score', { value: 0 })

const setupCanvas = engine.createSystem(
  world =>
    [
      world.getMutableResource('canvas'),
      world.getMutableResource('ctx'),
      world.getMutableResource('input'),
    ] as const,
  (canvas, ctx, input) => {
    // Get rendering context
    ctx.value = canvas.getContext('2d')
    if (!ctx.value) throw new Error('Failed to get 2D context from canvas')

    canvas.tabIndex = 0 // Make canvas focusable

    // Add input event listeners
    canvas.addEventListener(
      'keydown',
      e => {
        e.preventDefault()
        input.set(e.key, 1)
      },
      false,
    )

    canvas.addEventListener(
      'keyup',
      e => {
        e.preventDefault()
        input.set(e.key, 0)
      },
      false,
    )

    canvas.addEventListener('blur', () => {
      input.clear()
    })
  },
)

const setupGame = engine.createSystem(
  world => [world.commands, world.getResource('canvas')] as const,
  (commands, canvas) => {
    // Spawn a player entity at the center of the canvas
    commands.spawn({
      player: {},
      position: { x: canvas.width / 2, y: canvas.height / 2 },
      velocity: { dx: 0, dy: 0 },
      health: { value: 100 },
      speed: { value: 5 },
      circle: { radius: 20 },
      color: { value: 'blue' },
    })
  },
)

engine.registerSystems(SystemType.STARTUP, setupCanvas, setupGame)

const updatePlayerMovement = engine.createSystem(
  world =>
    [
      world.getResource('input'),
      world.query.with('player').read('speed').write('velocity'),
    ] as const,
  function updatePlayerMovement(input, query) {
    const [, speed, vel] = query.peek()!

    vel.dx = (input.get('ArrowRight', 'd') - input.get('ArrowLeft', 'a')) * speed.value
    vel.dy = (input.get('ArrowDown', 's') - input.get('ArrowUp', 'w')) * speed.value
  },
)

const updatePositions = engine
  .createSystem(
    world => [world.query.write('position').read('velocity'), world.getResource('canvas')] as const,
    (query, canvas) => {
      for (const [, pos, vel] of query) {
        pos.x += vel.dx
        pos.y += vel.dy

        // Keep player within canvas bounds
        if (pos.x < 0) pos.x = 0
        if (pos.x > canvas.width) pos.x = canvas.width
        if (pos.y < 0) pos.y = 0
        if (pos.y > canvas.height) pos.y = canvas.height
      }
    },
  )
  .after('updatePlayerMovement')

engine.registerSystems(SystemType.FIXED_UPDATE, updatePlayerMovement, updatePositions)

const clearCanvas = engine.createSystem(
  world => [world.getMutableResource('ctx'), world.getResource('clearColor')] as const,
  function clearCanvas(ctx, clearColor) {
    if (!ctx.value) throw new Error('Canvas context is not set')
    ctx.value.fillStyle = clearColor.value
    ctx.value.fillRect(0, 0, ctx.value.canvas.width, ctx.value.canvas.height)
  },
)

const drawEntities = engine
  .createSystem(
    world =>
      [world.getMutableResource('ctx'), world.query.read('position', 'circle', 'color')] as const,
    function drawEntities(ctx, query) {
      if (!ctx.value) throw new Error('Canvas context is not set')
      for (const [, pos, circle, color] of query) {
        ctx.value.fillStyle = color.value
        ctx.value.beginPath()
        ctx.value.arc(pos.x, pos.y, circle.radius, 0, Math.PI * 2)
        ctx.value.fill()
      }
    },
  )
  .after('clearCanvas')

engine.registerSystems(SystemType.RENDER, clearCanvas, drawEntities)

engine.start()
