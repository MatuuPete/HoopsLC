import { describe, expect, it } from 'vitest'
import { summarizeSavedLineup } from './summarizeSavedLineup'
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

describe('summarizeSavedLineup', () => {
  it('sums each field across every slot', () => {
    const slots: SavedLineupSlot[] = [
      slot({ currentSalary: 999, baseSalary: 999, offense: 200, defense: 250 }),
      slot({ currentSalary: 2350, baseSalary: 2000, offense: 180, defense: 120 }),
      slot({ currentSalary: 2500, baseSalary: 2100, offense: 300, defense: 90 }),
    ]

    expect(summarizeSavedLineup(slots)).toEqual({
      totalPowerBySal: 5849,
      totalBaseSalary: 5099,
      totalOffense: 680,
      totalDefense: 460,
    })
  })

  it('returns all zeros for an empty lineup', () => {
    expect(summarizeSavedLineup([])).toEqual({
      totalPowerBySal: 0,
      totalBaseSalary: 0,
      totalOffense: 0,
      totalDefense: 0,
    })
  })
})
