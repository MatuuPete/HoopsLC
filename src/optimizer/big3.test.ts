import { describe, it, expect } from 'vitest'
import { big3Bonus, big3Stars, candidateBig3Sets } from './big3'
import type { Player } from './types'

function makeCatalog(name: string, price: number, team: string | null) {
  return { id: name, name, price, team }
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    positions: ['PG'],
    isXPlayer: false,
    xTier: null,
    baseSalary: 100,
    currentSalary: 100,
    offense: 100,
    defense: 100,
    catalogPlayerId: id,
    ...overrides,
  }
}

describe('big3Stars', () => {
  it("takes each team's five highest-priced players", () => {
    const catalog = [
      makeCatalog('a', 600, 'DEN'),
      makeCatalog('b', 500, 'DEN'),
      makeCatalog('c', 400, 'DEN'),
      makeCatalog('d', 300, 'DEN'),
      makeCatalog('e', 200, 'DEN'),
      makeCatalog('f', 100, 'DEN'),
      makeCatalog('g', 50, 'BOS'),
    ]
    const stars = big3Stars(catalog)
    expect([...stars.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'g'])
    expect(stars.get('a')).toBe('DEN')
    expect(stars.get('g')).toBe('BOS')
  })

  it('breaks a tie for fifth by name', () => {
    const catalog = [
      makeCatalog('a', 500, 'DEN'),
      makeCatalog('b', 500, 'DEN'),
      makeCatalog('c', 500, 'DEN'),
      makeCatalog('d', 500, 'DEN'),
      makeCatalog('zed', 100, 'DEN'),
      makeCatalog('amy', 100, 'DEN'),
    ]
    const stars = big3Stars(catalog)
    expect(stars.has('amy')).toBe(true)
    expect(stars.has('zed')).toBe(false)
  })

  it('skips players without a team', () => {
    expect(big3Stars([makeCatalog('a', 999, null)]).size).toBe(0)
  })
})

describe('big3Bonus', () => {
  it('adds 25% of base offense and defense, rounded', () => {
    expect(big3Bonus({ offense: 249, defense: 119 })).toEqual({ offense: 62, defense: 30 })
  })
})

describe('candidateBig3Sets', () => {
  const stars = new Map([
    ['d1', 'DEN'],
    ['d2', 'DEN'],
    ['d3', 'DEN'],
    ['d4', 'DEN'],
    ['b1', 'BOS'],
    ['b2', 'BOS'],
    ['b3', 'BOS'],
    ['l1', 'LAL'],
  ])
  const players = ['d1', 'd2', 'd3', 'd4', 'b1', 'b2', 'b3', 'l1', 'other'].map((id) => makePlayer(id))

  it('returns only the empty set when the bonus is off', () => {
    expect(candidateBig3Sets(players, stars, 0)).toEqual([[]])
  })

  it('tries every same-team trio for one Big 3', () => {
    const sets = candidateBig3Sets(players, stars, 1)
    // Empty set + C(4,3) Denver trios + 1 Boston trio. LAL has only one star.
    expect(sets).toHaveLength(1 + 4 + 1)
    expect(sets.slice(1).every((set) => set.length === 1)).toBe(true)
  })

  it('adds pairs of trios from different teams for two Big 3s', () => {
    const sets = candidateBig3Sets(players, stars, 2)
    const pairs = sets.filter((set) => set.length === 2)
    // Each of the 4 Denver trios with the 1 Boston trio; never two Denver trios.
    expect(pairs).toHaveLength(4)
    expect(pairs.every(([a, b]) => a.team !== b.team)).toBe(true)
  })

  it('ignores X Players and unlinked players', () => {
    const unlinked = [makePlayer('d1', { catalogPlayerId: null }), makePlayer('d2'), makePlayer('d3')]
    expect(candidateBig3Sets(unlinked, stars, 1)).toEqual([[]])
  })
})
