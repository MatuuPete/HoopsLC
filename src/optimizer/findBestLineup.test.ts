import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { Player } from './types'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'position'>): Player {
  return {
    name: overrides.id,
    isXPlayer: false,
    baseSalary: 100,
    currentSalary: 100,
    offense: 50,
    defense: 50,
    catalogPlayerId: null,
    ...overrides,
  }
}

describe('findBestLineup', () => {
  it('requires exactly one X Player and picks the best position for it', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', position: 'PG', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-x', position: 'PG', isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-x', position: 'SG', isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sf-x', position: 'SF', isXPlayer: true, baseSalary: 150, currentSalary: 400 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-x', position: 'PF', isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-x', position: 'C', isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
    ]

    const result = findBestLineup(players, 600)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots).toHaveLength(5)
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.find((s) => s.position === 'SF')?.player.id).toBe('sf-x')
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-1')
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-1')
    expect(result.slots.find((s) => s.position === 'PF')?.player.id).toBe('pf-1')
    expect(result.slots.find((s) => s.position === 'C')?.player.id).toBe('c-1')
    expect(result.totalCurrentSalary).toBe(800)
    expect(result.totalBaseSalary).toBe(550)
    expect(result.remainingCap).toBe(50)
  })

  it('reports missing_position when a position has no eligible players at all', () => {
    const players: Player[] = [
      makePlayer({ id: 'sg-1', position: 'SG' }),
      makePlayer({ id: 'sf-1', position: 'SF' }),
      makePlayer({ id: 'pf-1', position: 'PF' }),
      makePlayer({ id: 'c-1', position: 'C' }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'missing_position') throw new Error('expected missing_position')
    expect(result.missingPositions).toEqual(['PG'])
  })

  it('reports no_valid_x_slot when the pool has no X Players at all', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', position: 'PG' }),
      makePlayer({ id: 'sg-1', position: 'SG' }),
      makePlayer({ id: 'sf-1', position: 'SF' }),
      makePlayer({ id: 'pf-1', position: 'PF' }),
      makePlayer({ id: 'c-1', position: 'C' }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutXPlayer).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
    expect(result.positionsWithoutRegularPlayer).toEqual([])
  })

  it('reports no_valid_x_slot when two positions have no regular player, forcing a conflict', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', position: 'PG', isXPlayer: true }),
      makePlayer({ id: 'sg-x', position: 'SG', isXPlayer: true }),
      makePlayer({ id: 'sf-1', position: 'SF' }),
      makePlayer({ id: 'pf-1', position: 'PF' }),
      makePlayer({ id: 'c-1', position: 'C' }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutRegularPlayer).toEqual(['PG', 'SG'])
    expect(result.positionsWithoutXPlayer).toEqual(['SF', 'PF', 'C'])
  })

  it('reports cap_too_low with the closest valid (exactly-one-X) lineup when nothing fits', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', position: 'PG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pg-x', position: 'PG', isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sg-x', position: 'SG', isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sf-x', position: 'SF', isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pf-x', position: 'PF', isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'c-x', position: 'C', isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
    ]

    const result = findBestLineup(players, 700)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'cap_too_low') throw new Error('expected cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(900)
    expect(result.closestTotalCurrentSalary).toBe(900)
    expect(result.closestLineup).toHaveLength(5)
    expect(result.closestLineup.find((s) => s.position === 'SF')?.player.id).toBe('sf-x')
    expect(result.closestLineup.find((s) => s.position === 'PG')?.player.id).toBe('pg-1')
  })

  it('breaks ties in a regular slot by preferring lower cost, once the X slot is forced', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', position: 'PG', isXPlayer: true, baseSalary: 999, currentSalary: 999 }),
      makePlayer({ id: 'sg-a', position: 'SG', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-b', position: 'SG', baseSalary: 80, currentSalary: 100 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1250)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-x')
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-b')
    expect(result.totalBaseSalary).toBe(1229)
  })
})
