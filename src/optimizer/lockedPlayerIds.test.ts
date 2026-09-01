import { describe, expect, it } from 'vitest'
import { lockedPlayerIds } from './lockedPlayerIds'
import type { SavedLineupSlot } from './types'

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

describe('lockedPlayerIds', () => {
  it('collects unique player ids across every saved lineup', () => {
    const locked = lockedPlayerIds([
      { slots: [slot({ playerId: 'a' }), slot({ playerId: 'b' })] },
      { slots: [slot({ playerId: 'b' }), slot({ playerId: 'c' })] },
    ])
    expect([...locked].sort()).toEqual(['a', 'b', 'c'])
  })

  it('ignores slots with no playerId (saved before the field existed)', () => {
    const locked = lockedPlayerIds([{ slots: [slot({}), slot({ playerId: 'a' })] }])
    expect([...locked]).toEqual(['a'])
  })

  it('is empty for no saved lineups', () => {
    expect(lockedPlayerIds([]).size).toBe(0)
  })
})
