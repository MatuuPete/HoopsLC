import { describe, it, expect } from 'vitest'
import { xPlayersFit } from './xRule'
import type { Player } from './types'

function makePlayer(id: string, xTier: Player['xTier']): Player {
  return {
    id,
    name: id,
    positions: ['PG'],
    isXPlayer: xTier !== null,
    xTier,
    baseSalary: 100,
    currentSalary: 100,
    offense: 50,
    defense: 50,
    catalogPlayerId: null,
  }
}

const reg = makePlayer('reg', null)
const x = makePlayer('x', 'standard')
const lx = makePlayer('lx', 'legend')

describe('xPlayersFit', () => {
  it('allows one X Player of either tier', () => {
    expect(xPlayersFit([reg, x], false)).toBe(true)
    expect(xPlayersFit([lx, reg], false)).toBe(true)
  })

  it('allows no second X Player without the event', () => {
    expect(xPlayersFit([x, lx], false)).toBe(false)
    expect(xPlayersFit([lx, lx], false)).toBe(false)
  })

  it('allows a second X Player during the event only when one of the two is a Legend X', () => {
    expect(xPlayersFit([x, lx], true)).toBe(true)
    expect(xPlayersFit([lx, x], true)).toBe(true)
    expect(xPlayersFit([lx, lx], true)).toBe(true)
    expect(xPlayersFit([x, x], true)).toBe(false)
  })

  it('never allows a third X Player', () => {
    expect(xPlayersFit([lx, lx, lx], true)).toBe(false)
  })
})
