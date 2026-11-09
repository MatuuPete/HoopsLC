import { describe, it, expect } from 'vitest'
import { awardFor, effectiveDefense, effectiveOffense } from './awards'
import type { Player } from './types'

function makePlayer(name: string, overrides: Partial<Player> = {}): Player {
  return {
    id: name,
    name,
    positions: ['PG'],
    isXPlayer: false,
    xTier: null,
    baseSalary: 100,
    currentSalary: 100,
    offense: 200,
    defense: 100,
    catalogPlayerId: null,
    ...overrides,
  }
}

describe('awards', () => {
  it('looks up an award by player name, ignoring case and surrounding spaces', () => {
    expect(awardFor('Jayson Tatum')).toMatchObject({ award: 'Player of the Week', offense: 5, defense: 0 })
    expect(awardFor('  jayson tatum ')).toMatchObject({ award: 'Player of the Week', offense: 5, defense: 0 })
    expect(awardFor('Victor Wembanyama')).toMatchObject({ award: 'Player of the Week', offense: 5, defense: 0 })
  })

  it('returns null for players without an award', () => {
    expect(awardFor('Stephen Curry')).toBeNull()
  })

  it('adds the award bonus to offense and defense', () => {
    const tatum = makePlayer('Jayson Tatum', { offense: 180, defense: 120 })
    expect(effectiveOffense(tatum)).toBe(185)
    expect(effectiveDefense(tatum)).toBe(120)
  })

  it('leaves players without an award unchanged', () => {
    const curry = makePlayer('Stephen Curry', { offense: 267, defense: 121 })
    expect(effectiveOffense(curry)).toBe(267)
    expect(effectiveDefense(curry)).toBe(121)
  })
})
