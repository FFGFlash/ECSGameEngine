import { add } from 'src/index'
import { describe, it, expect } from 'vitest'

describe('add', () => {
  it('should add two numbers together', () => {
    expect(add(1, 2)).toBe(3)
  })

  it('should return a number', () => {
    expect(typeof add(1, 2)).toBe('number')
  })

  it('should return NaN when adding a string', () => {
    // @ts-expect-error - testing invalid input
    expect(add(1, '2')).toBeNaN()
  })
})
