import logger from 'src/logger'

const log = logger.extend('add')

/**
 * Adds two numbers together
 * @param a The left operand
 * @param b The right operand
 * @returns The sum of the two numbers
 * @example
 * ```ts
 * const sum = add(1, 2); // 3
 * ```
 */
export function add(a: number, b: number): number {
  log('Adding %d and %d', a, b)
  if (typeof a !== 'number' || typeof b !== 'number') {
    log('Invalid input: %s and %s', a, b)
    return NaN
  }
  const result = a + b
  log('Result: %d', result)
  return result
}
