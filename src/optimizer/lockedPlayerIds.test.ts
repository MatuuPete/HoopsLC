import { describe, expect, it } from 'vitest'
import { lockedPlayerIds } from './lockedPlayerIds'
import type { Player, SavedLineupSlot } from './types'

function slot(overrides: Partial<SavedLineupSlot>): SavedLineupSlot {
  return {
    position: 'PG',
    name: 'Player',
    isXPlayer: false,
    currentSalary: 0,
    baseSalary: 0,
    offense: 0,
    defense: 0,
    ...overrides,
  }
}

function player(overrides: Partial<Player>): Player {
  return {
    id: 'p',
    name: 'Player',
    positions: ['PG'],
    isXPlayer: false,
    baseSalary: 0,
    currentSalary: 0,
    offense: 0,
    defense: 0,
    catalogPlayerId: null,
    ...overrides,
  }
}

describe('lockedPlayerIds', () => {
  it('collects unique player ids across every saved lineup', () => {
    const locked = lockedPlayerIds([
      { slots: [slot({ playerId: 'a' }), slot({ playerId: 'b' })] },
      { slots: [slot({ playerId: 'b' }), slot({ playerId: 'c' })] },
    ])
    expect([...locked].sort()).toEqual(['a', 'b', 'c'])
  })

  it('resolves slots with no playerId by matching the name to an owned player', () => {
    const locked = lockedPlayerIds(
      [{ slots: [slot({ name: 'Andre Iguodala' }), slot({ playerId: 'a' })] }],
      [player({ id: 'andre', name: 'andre iguodala ' })],
    )
    expect([...locked].sort()).toEqual(['a', 'andre'])
  })

  it('ignores slots with no playerId when no owned player matches the name', () => {
    const locked = lockedPlayerIds([{ slots: [slot({ name: 'Ghost' }), slot({ playerId: 'a' })] }], [])
    expect([...locked]).toEqual(['a'])
  })

  it('is empty for no saved lineups', () => {
    expect(lockedPlayerIds([]).size).toBe(0)
  })
})
