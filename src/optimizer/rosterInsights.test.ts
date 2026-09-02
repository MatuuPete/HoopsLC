import { describe, expect, it } from 'vitest'
import {
  positionalCoverage,
  valueRanking,
  salaryMovers,
  playerValueRank,
} from './rosterInsights'
import type { Player } from './types'

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

describe('positionalCoverage', () => {
  it('counts players eligible at each of the five positions', () => {
    const players = [
      player({ positions: ['PG', 'SG'] }),
      player({ positions: ['SG', 'SF'] }),
      player({ positions: ['C'] }),
    ]

    expect(positionalCoverage(players)).toEqual([
      { position: 'PG', count: 1 },
      { position: 'SG', count: 2 },
      { position: 'SF', count: 1 },
      { position: 'PF', count: 0 },
      { position: 'C', count: 1 },
    ])
  })

  it('reports zero for every position when there are no players', () => {
    expect(positionalCoverage([])).toEqual([
      { position: 'PG', count: 0 },
      { position: 'SG', count: 0 },
      { position: 'SF', count: 0 },
      { position: 'PF', count: 0 },
      { position: 'C', count: 0 },
    ])
  })
})

describe('valueRanking', () => {
  it('ranks players by power per current-salary dollar, highest first', () => {
    const bargain = player({ id: 'a', currentSalary: 1000, offense: 200, defense: 100 })
    const overpriced = player({ id: 'b', currentSalary: 2000, offense: 150, defense: 90 })

    const ranking = valueRanking([overpriced, bargain])

    expect(ranking.map((entry) => entry.player.id)).toEqual(['a', 'b'])
    expect(ranking[0].value).toBeCloseTo(0.3)
    expect(ranking[1].value).toBeCloseTo(0.12)
  })

  it('excludes X players whose fixed salary makes their value meaningless', () => {
    const regular = player({ id: 'a', currentSalary: 2000, offense: 200, defense: 100 })
    const xPlayer = player({ id: 'x', isXPlayer: true, currentSalary: 999, offense: 200, defense: 100 })

    expect(valueRanking([regular, xPlayer]).map((entry) => entry.player.id)).toEqual(['a'])
  })

  it('excludes players with no current salary to avoid dividing by zero', () => {
    const priced = player({ id: 'a', currentSalary: 1000, offense: 100, defense: 100 })
    const unpriced = player({ id: 'b', currentSalary: 0, offense: 100, defense: 100 })

    expect(valueRanking([priced, unpriced]).map((entry) => entry.player.id)).toEqual(['a'])
  })
})

describe('salaryMovers', () => {
  it('ranks players by the size of their salary change, largest swing first', () => {
    const riser = player({ id: 'a', baseSalary: 1000, currentSalary: 1400 })
    const faller = player({ id: 'b', baseSalary: 1200, currentSalary: 1100 })
    const bigRiser = player({ id: 'c', baseSalary: 900, currentSalary: 1800 })

    const movers = salaryMovers([riser, faller, bigRiser])

    expect(movers.map((m) => m.player.id)).toEqual(['c', 'a', 'b'])
    expect(movers.map((m) => m.delta)).toEqual([900, 400, -100])
  })

  it('drops players whose salary has not moved', () => {
    const moved = player({ id: 'a', baseSalary: 1000, currentSalary: 1200 })
    const flat = player({ id: 'b', baseSalary: 999, currentSalary: 999 })

    expect(salaryMovers([moved, flat]).map((m) => m.player.id)).toEqual(['a'])
  })
})

describe('playerValueRank', () => {
  const players = [
    player({ id: 'a', currentSalary: 1000, offense: 200, defense: 100 }),
    player({ id: 'b', currentSalary: 2000, offense: 150, defense: 90 }),
    player({ id: 'c', currentSalary: 1500, offense: 120, defense: 60 }),
  ]

  it('returns the 1-based rank, the ranked total, and the value for a player', () => {
    expect(playerValueRank(players, 'b')).toEqual({
      rank: 2,
      total: 3,
      value: (150 + 90) / 2000,
    })
  })

  it('returns null for a player missing from the ranking', () => {
    const withX = [...players, player({ id: 'x', isXPlayer: true, currentSalary: 999 })]
    expect(playerValueRank(withX, 'x')).toBeNull()
  })
})
