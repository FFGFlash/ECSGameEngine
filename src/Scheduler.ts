import Query from './Query'
import { System } from './System'
import World from './World'

export default async function scheduler(world: World, systems: System[]) {
  const scheduledBatches: System[][] = []

  for (const system of systems) {
    const lastBatch = scheduledBatches.at(-1)
    if (lastBatch && !conflictsWithBatch(system, lastBatch)) {
      lastBatch.push(system)
      continue
    }

    scheduledBatches.push([system])
  }

  for (const batch of scheduledBatches) {
    await Promise.all(
      batch.map(
        sys =>
          new Promise<void>(resolve => {
            const args = sys.getArgs(world).map(arg => {
              if (arg instanceof Query) return arg.lock()
              return arg
            })

            resolve(sys(...args))
          }),
      ),
    )
  }
}

function conflictsWithBatch(system: System, batch: System[]): boolean {
  return batch.some(other => systemsConflict(system, other))
}

function systemsConflict(a: System, b: System): boolean {
  const aSync = a._flags?.sync || false
  const bSync = b._flags?.sync || false

  if (aSync || bSync) return true

  const aRead = new Set(a._reads || [])
  const aWrite = new Set(a._writes || [])
  const bRead = new Set(b._reads || [])
  const bWrite = new Set(b._writes || [])

  for (const r of aRead) if (bWrite.has(r)) return true
  for (const w of aWrite) if (bRead.has(w) || bWrite.has(w)) return true

  return false
}

export function topologicalSort(systems: System[]): System[] {
  const visited = new Set<System>()
  const temp = new Set<System>()
  const result: System[] = []

  function visit(system: System) {
    if (visited.has(system)) return
    if (temp.has(system)) throw new Error('Circular dependency detected')

    temp.add(system)

    for (const name of system._after || []) {
      for (const other of systems) {
        if (other.name === name) visit(other)
      }
    }

    temp.delete(system)
    visited.add(system)
    result.push(system)

    for (const name of system._before || []) {
      for (const other of systems) {
        if (other.name === name) visit(other)
      }
    }
  }

  for (const system of systems) {
    visit(system)
  }

  return result
}
