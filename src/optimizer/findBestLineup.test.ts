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
    ...overrides,
  }
}

describe('findBestLineup', () => {
  it('picks the combination that maximizes total current salary under the cap', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-cheap', position: 'PG', baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'pg-expensive', position: 'PG', baseSalary: 400, currentSalary: 500 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 100, currentSalary: 120 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 100, currentSalary: 120 }),
    ]

    const result = findBestLineup(players, 900)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-expensive')
    expect(result.totalBaseSalary).toBe(800)
    expect(result.totalCurrentSalary).toBe(980)
    expect(result.remainingCap).toBe(100)
  })

  it('reports missing positions when a position has no eligible players', () => {
    const players: Player[] = [
      makePlayer({ id: 'sg-1', position: 'SG' }),
      makePlayer({ id: 'sf-1', position: 'SF' }),
      makePlayer({ id: 'pf-1', position: 'PF' }),
      makePlayer({ id: 'c-1', position: 'C' }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toBe('missing_position')
    expect(result.missingPositions).toEqual(['PG'])
  })

  it('reports cap_too_low when no combination fits under the cap', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', position: 'PG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 200, currentSalary: 200 }),
    ]

    const result = findBestLineup(players, 500)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toBe('cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(1000)
  })

  it('selects an X Player when it is the optimal choice for a slot', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-regular', position: 'PG', baseSalary: 100, currentSalary: 150 }),
      makePlayer({
        id: 'pg-x',
        position: 'PG',
        isXPlayer: true,
        baseSalary: 999,
        currentSalary: 999,
        offense: 250,
        defense: 250,
      }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1200)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-x')
  })

  it('breaks ties in total current salary by preferring lower total base salary, then lowest id', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-a', position: 'PG', baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-b', position: 'PG', baseSalary: 80, currentSalary: 100 }),
      makePlayer({ id: 'sg-1', position: 'SG', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'sf-1', position: 'SF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', position: 'PF', baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', position: 'C', baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1000)

    expect(result.success).toBe(true)
    if (!result.success) return
    const pgSlot = result.slots.find((s) => s.position === 'PG')
    expect(pgSlot?.player.id).toBe('pg-b')
    expect(result.totalBaseSalary).toBe(280)
  })
})
