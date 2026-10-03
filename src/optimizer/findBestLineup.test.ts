import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { LineupPreferences, Player } from './types'

const DEFAULT_PREFERENCES: LineupPreferences = {
  requiredPlayerIds: [],
  unavailablePlayerIds: [],
  objectiveMode: 'power',
  offenseWeight: 0.5,
}

/**
 * Unless a test sets offense/defense itself, a player's power (offense +
 * defense) equals its currentSalary, so fixtures can use currentSalary as a
 * single "strength" number for power-mode tests.
 */
function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'positions'>): Player {
  const currentSalary = overrides.currentSalary ?? 100
  return {
    name: overrides.id,
    isXPlayer: false,
    xTier: null,
    baseSalary: 100,
    currentSalary,
    offense: currentSalary / 2,
    defense: currentSalary / 2,
    catalogPlayerId: null,
    ...overrides,
  }
}

describe('findBestLineup', () => {
  it('ranks by total power (offense + defense + awards) in power mode, not by salary', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-pricey', positions: ['PG'], currentSalary: 900, offense: 100, defense: 50 }),
      makePlayer({ id: 'pg-strong', positions: ['PG'], currentSalary: 200, offense: 150, defense: 50 }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf-rich', positions: ['SF'], currentSalary: 900, offense: 100, defense: 100 }),
      // 100 + 95 raw, plus the Rookie of the Year bonus (+5/+5) = 205.
      makePlayer({ id: 'sf-roy', name: 'Cooper Flagg', positions: ['SF'], currentSalary: 200, offense: 100, defense: 95 }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
    const result = findBestLineup(players, 10000, DEFAULT_PREFERENCES)
    expect(result.success).toBe(true)
    if (!result.success) return
    const ids = result.slots.map((s) => s.player.id)
    expect(ids).toContain('pg-strong')
    expect(ids).toContain('sf-roy')
  })

  it('counts award bonuses toward stats-mode value', () => {
    // Two PGs with identical raw stats and salary; only one has an award (MVP, +10 OFF / +5 DEF).
    const players: Player[] = [
      makePlayer({ id: 'a-plain', name: 'Plain Guard', positions: ['PG'] }),
      makePlayer({ id: 'z-mvp', name: 'Shai Gilgeous-Alexander', positions: ['PG'] }),
      makePlayer({ id: 'sg', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf', positions: ['SF'] }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
    const result = findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, objectiveMode: 'stats' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('z-mvp')
  })

  it('requires exactly one X Player and picks the best position for it', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sf-x', positions: ['SF'], isXPlayer: true, baseSalary: 150, currentSalary: 400 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-x', positions: ['PF'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-x', positions: ['C'], isXPlayer: true, baseSalary: 200, currentSalary: 150 }),
    ]

    const result = findBestLineup(players, 600, DEFAULT_PREFERENCES)

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
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'missing_position') throw new Error('expected missing_position')
    expect(result.missingPositions).toEqual(['PG'])
  })

  it('reports no_valid_x_slot when the pool has no X Players at all', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'] }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutXPlayer).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
    expect(result.positionsWithoutRegularPlayer).toEqual([])
  })

  it('reports no_valid_x_slot when two positions have no regular player, forcing a conflict', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'no_valid_x_slot') throw new Error('expected no_valid_x_slot')
    expect(result.positionsWithoutRegularPlayer).toEqual(['PG', 'SG'])
    expect(result.positionsWithoutXPlayer).toEqual(['SF', 'PF', 'C'])
  })

  it('reports cap_too_low with the closest valid (exactly-one-X) lineup when nothing fits', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'sf-x', positions: ['SF'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'pf-x', positions: ['PF'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 200, currentSalary: 200 }),
      makePlayer({ id: 'c-x', positions: ['C'], isXPlayer: true, baseSalary: 300, currentSalary: 300 }),
    ]

    const result = findBestLineup(players, 700, DEFAULT_PREFERENCES)

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
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 999, currentSalary: 999 }),
      makePlayer({ id: 'sg-a', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-b', positions: ['SG'], baseSalary: 80, currentSalary: 100 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 50, currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1250, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-x')
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-b')
    expect(result.totalBaseSalary).toBe(1229)
  })

  it('assigns a shared multi-position player to the slot that has no other candidate', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'flex', positions: ['SF', 'PF'], baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'sf-cheap', positions: ['SF'], baseSalary: 50, currentSalary: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PF')?.player.id).toBe('flex')
    expect(result.slots.find((s) => s.position === 'SF')?.player.id).toBe('sf-cheap')
    expect(result.totalCurrentSalary).toBe(850)
    expect(result.totalBaseSalary).toBe(450)
  })

  it('never places the same shared player into two slots at once', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'flex', positions: ['SG', 'SF'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-alt', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-alt', positions: ['SF'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.id === 'flex')).toHaveLength(1)
    expect(result.totalCurrentSalary).toBe(750)
    expect(result.totalBaseSalary).toBe(500)
  })

  it('keeps exactly one X Player even when the best X candidate is eligible at multiple positions', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-1', positions: ['PG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'x-flex', positions: ['SG', 'SF'], isXPlayer: true, baseSalary: 100, currentSalary: 400 }),
      makePlayer({ id: 'sg-1', positions: ['SG'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.filter((s) => s.player.id === 'x-flex')).toHaveLength(1)
    expect(result.totalCurrentSalary).toBe(800)
    expect(result.totalBaseSalary).toBe(500)
  })

  it('forces a required player into the lineup even when they are not the best choice for their slot', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-best', positions: ['SG'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-required', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, { ...DEFAULT_PREFERENCES, requiredPlayerIds: ['sg-required'] })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-required')
  })

  it('leaves an unavailable player out even when they are the best pick for their slot', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'sg-best', positions: ['SG'], baseSalary: 100, currentSalary: 300 }),
      makePlayer({ id: 'sg-next', positions: ['SG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      unavailablePlayerIds: ['sg-best'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-next')
  })

  it('reports missing_position when every candidate for a position is unavailable', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
      makePlayer({ id: 'c-2', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      unavailablePlayerIds: ['c-1', 'c-2'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'missing_position') throw new Error('expected missing_position')
    expect(result.missingPositions).toEqual(['C'])
  })

  it('never fields two copies of the same catalog player, keeping the cheaper copy', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'star-cheap', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'star-exp', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 300, currentSalary: 500 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, DEFAULT_PREFERENCES)

    expect(result.success).toBe(true)
    if (!result.success) return
    const catalogIds = result.slots.map((s) => s.player.catalogPlayerId).filter((id) => id !== null)
    expect(new Set(catalogIds).size).toBe(catalogIds.length)
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('star-cheap')
    expect(result.slots.find((s) => s.position === 'SF')?.player.id).toBe('sf-1')
  })

  it('dedupes among still-available copies after removing unavailable ones', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'star-cheap', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 50, currentSalary: 500 }),
      makePlayer({ id: 'star-mid', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'star-exp', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 300, currentSalary: 500 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      unavailablePlayerIds: ['star-cheap'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const catalogIds = result.slots.map((s) => s.player.catalogPlayerId).filter((id) => id !== null)
    expect(new Set(catalogIds).size).toBe(catalogIds.length)
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('star-mid')
  })

  it('keeps only the preferred copy when another copy of that player is cheaper', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'star-cheap', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 100, currentSalary: 500 }),
      makePlayer({ id: 'star-exp', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1', baseSalary: 300, currentSalary: 500 }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100 }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['star-exp'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    const catalogIds = result.slots.map((s) => s.player.catalogPlayerId).filter((id) => id !== null)
    expect(new Set(catalogIds).size).toBe(catalogIds.length)
    expect(result.slots.map((s) => s.player.id)).toContain('star-exp')
    expect(result.slots.map((s) => s.player.id)).not.toContain('star-cheap')
  })

  it('reports required_players_conflict when two copies of the same player are both preferred', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'star-a', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1' }),
      makePlayer({ id: 'star-b', positions: ['SG', 'SF'], catalogPlayerId: 'cat-1' }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['star-a', 'star-b'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'required_players_conflict') throw new Error('expected required_players_conflict')
    expect(result.conflictingPlayerIds).toEqual(expect.arrayContaining(['star-a', 'star-b']))
  })

  it('reports required_players_conflict when two required players share their only eligible position', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-a', positions: ['SG'] }),
      makePlayer({ id: 'sg-b', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['sg-a', 'sg-b'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'required_players_conflict') throw new Error('expected required_players_conflict')
    expect([...result.conflictingPlayerIds].sort()).toEqual(['sg-a', 'sg-b'])
  })

  it('reports required_players_conflict when more than 5 players are required', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-x', positions: ['PG'], isXPlayer: true }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
      makePlayer({ id: 'extra', positions: ['PG'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['pg-x', 'sg-1', 'sf-1', 'pf-1', 'c-1', 'extra'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    if (result.reason !== 'required_players_conflict') throw new Error('expected required_players_conflict')
  })

  it('lets a required X Player satisfy the exactly-one-X-Player rule without needing another', () => {
    const players: Player[] = [
      makePlayer({ id: 'pg-required-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 100 }),
      makePlayer({ id: 'pg-other-x', positions: ['PG'], isXPlayer: true, baseSalary: 100, currentSalary: 400 }),
      makePlayer({ id: 'sg-1', positions: ['SG'] }),
      makePlayer({ id: 'sf-1', positions: ['SF'] }),
      makePlayer({ id: 'pf-1', positions: ['PF'] }),
      makePlayer({ id: 'c-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['pg-required-x'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.filter((s) => s.player.isXPlayer)).toHaveLength(1)
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-required-x')
  })

  it('prioritizes offense over price when objective mode is stats with offenseWeight 1', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({ id: 'sg-rich', positions: ['SG'], baseSalary: 100, currentSalary: 500, offense: 50, defense: 50 }),
      makePlayer({
        id: 'sg-offense',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 300,
        defense: 10,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      unavailablePlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 1,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-offense')
  })

  it('prioritizes defense over price when objective mode is stats with offenseWeight 0', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({ id: 'sg-rich', positions: ['SG'], baseSalary: 100, currentSalary: 500, offense: 50, defense: 50 }),
      makePlayer({
        id: 'sg-defense',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 10,
        defense: 300,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      unavailablePlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 0,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-defense')
  })

  it('sums offense and defense equally when objective mode is stats with offenseWeight 0.5', () => {
    const players: Player[] = [
      makePlayer({
        id: 'pg-x',
        positions: ['PG'],
        isXPlayer: true,
        baseSalary: 100,
        currentSalary: 100,
        offense: 100,
        defense: 100,
      }),
      makePlayer({
        id: 'sg-balanced',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 125,
        defense: 125,
      }),
      makePlayer({
        id: 'sg-offense-heavy',
        positions: ['SG'],
        baseSalary: 100,
        currentSalary: 100,
        offense: 200,
        defense: 40,
      }),
      makePlayer({ id: 'sf-1', positions: ['SF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'pf-1', positions: ['PF'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
      makePlayer({ id: 'c-1', positions: ['C'], baseSalary: 100, currentSalary: 100, offense: 50, defense: 50 }),
    ]

    const result = findBestLineup(players, 1000, {
      requiredPlayerIds: [],
      unavailablePlayerIds: [],
      objectiveMode: 'stats',
      offenseWeight: 0.5,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'SG')?.player.id).toBe('sg-balanced')
  })
})

describe('findBestLineup with a bench', () => {
  /** A valid starting five: one regular per position plus an X Player at SG, 100 salary and 100 power each. */
  function startingFive(): Player[] {
    return [
      makePlayer({ id: 'pg', positions: ['PG'] }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf', positions: ['SF'] }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
  }

  function benchIds(result: ReturnType<typeof findBestLineup>): string[] {
    if (!result.success) throw new Error(`expected success, got ${result.reason}`)
    return result.bench.map((p) => p.id).sort()
  }

  it('returns an empty bench when no bench is asked for', () => {
    const players = [...startingFive(), makePlayer({ id: 'extra', positions: ['PG'], currentSalary: 10 })]
    expect(benchIds(findBestLineup(players, 10000, DEFAULT_PREFERENCES))).toEqual([])
    expect(benchIds(findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, benchSize: 0 }))).toEqual([])
  })

  it('fills the bench with the strongest remaining players at any position, counting their salary', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-pg', positions: ['PG'], currentSalary: 90 }),
      makePlayer({ id: 'e-c', positions: ['C'], currentSalary: 80 }),
      makePlayer({ id: 'e-weak', positions: ['SF'], currentSalary: 30 }),
    ]

    const result = findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, benchSize: 2 })

    expect(benchIds(result)).toEqual(['e-c', 'e-pg'])
    if (!result.success) return
    expect(result.slots.map((s) => s.player.id).sort()).toEqual(['c', 'pf', 'pg', 'sf', 'sg-x'])
    expect(result.totalBaseSalary).toBe(700)
    expect(result.remainingCap).toBe(9300)
  })

  it('never puts an X Player on the bench', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'pf-x', positions: ['PF'], isXPlayer: true, currentSalary: 1000 }),
      makePlayer({ id: 'e-weak', positions: ['SF'], currentSalary: 10 }),
    ]

    expect(benchIds(findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, benchSize: 1 }))).toEqual([
      'e-weak',
    ])
  })

  it('holds back enough cap for the full bench, even if that means a weaker five', () => {
    const players = [
      ...startingFive().filter((p) => p.id !== 'pg'),
      makePlayer({ id: 'pg-star', positions: ['PG'], baseSalary: 500, currentSalary: 300 }),
      makePlayer({ id: 'pg-cheap', positions: ['PG'], baseSalary: 100, currentSalary: 150 }),
      makePlayer({ id: 'bench-a', positions: ['SF'], currentSalary: 50 }),
      makePlayer({ id: 'bench-b', positions: ['SF'], currentSalary: 50 }),
    ]

    const result = findBestLineup(players, 1000, { ...DEFAULT_PREFERENCES, benchSize: 2 })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-cheap')
    expect(benchIds(result)).toEqual(['bench-a', 'bench-b'])
  })

  it('puts the starting five first: a stronger five beats a weaker five with a better bench', () => {
    const players = [
      ...startingFive().filter((p) => p.id !== 'pg'),
      makePlayer({ id: 'pg-strong', positions: ['PG'], baseSalary: 300, currentSalary: 200 }),
      makePlayer({ id: 'pg-weak', positions: ['PG'], baseSalary: 200, currentSalary: 150 }),
      makePlayer({ id: 'bench-cheap', positions: ['SF'], baseSalary: 100, currentSalary: 10 }),
      makePlayer({ id: 'bench-mid', positions: ['SF'], baseSalary: 200, currentSalary: 90 }),
    ]

    // pg-strong + bench-cheap: 600 + 10. pg-weak + bench-mid: 550 + 90 is more in
    // total, but the starting five is weaker.
    const result = findBestLineup(players, 800, { ...DEFAULT_PREFERENCES, benchSize: 1 })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-strong')
    expect(benchIds(result)).toEqual(['bench-cheap'])
  })

  it('never benches a second copy of a starter', () => {
    const players = [
      ...startingFive().map((p) => (p.id === 'sf' ? { ...p, catalogPlayerId: 'cat-sf' } : p)),
      makePlayer({ id: 'sf-copy', positions: ['SF'], baseSalary: 200, catalogPlayerId: 'cat-sf' }),
      makePlayer({ id: 'e-weak', positions: ['C'], currentSalary: 10 }),
    ]

    expect(benchIds(findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, benchSize: 1 }))).toEqual([
      'e-weak',
    ])
  })

  it('leaves unavailable players off the bench', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-strong', positions: ['PG'], currentSalary: 90 }),
      makePlayer({ id: 'e-weak', positions: ['C'], currentSalary: 10 }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      unavailablePlayerIds: ['e-strong'],
    })

    expect(benchIds(result)).toEqual(['e-weak'])
  })

  it('reports bench_too_small with the largest bench that could be filled', () => {
    const players = [...startingFive(), makePlayer({ id: 'e-1', positions: ['PG'] })]

    const result = findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, benchSize: 3 })

    expect(result.success).toBe(false)
    if (result.success || result.reason !== 'bench_too_small') throw new Error('expected bench_too_small')
    expect(result.requestedBenchSize).toBe(3)
    expect(result.maxBenchSize).toBe(1)
  })

  it('reports cap_too_low counting the bench, with the closest lineup and bench', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-1', positions: ['PG'] }),
      makePlayer({ id: 'e-2', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 600, { ...DEFAULT_PREFERENCES, benchSize: 2 })

    expect(result.success).toBe(false)
    if (result.success || result.reason !== 'cap_too_low') throw new Error('expected cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(700)
    expect(result.closestLineup).toHaveLength(5)
    expect(result.closestBench).toHaveLength(2)
    const used = [...result.closestLineup.map((s) => s.player.id), ...result.closestBench.map((p) => p.id)]
    expect(used.sort()).toEqual(['c', 'e-1', 'e-2', 'pf', 'pg', 'sf', 'sg-x'])
  })

  it('keeps preferred players in the starting five', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'pg-pref', positions: ['PG'], currentSalary: 10 }),
      makePlayer({ id: 'e-1', positions: ['C'], currentSalary: 5 }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      requiredPlayerIds: ['pg-pref'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-pref')
    expect(benchIds(result)).toEqual(['pg'])
  })
})

describe('findBestLineup with a bench, against brute force', () => {
  const positions: Player['positions'][number][] = ['PG', 'SG', 'SF', 'PF', 'C']

  /** Lexicographic best (starter power, then bench power) by trying every lineup. */
  function bruteForce(players: Player[], cap: number, benchSize: number): [number, number] | null {
    const power = (p: Player) => p.offense + p.defense
    let best: [number, number] | null = null
    function pickStarters(slot: number, used: Set<string>, cost: number, value: number, xCount: number) {
      if (slot === positions.length) {
        if (xCount !== 1) return
        const rest = players.filter((p) => !used.has(p.id) && !p.isXPlayer)
        pickBench(rest, 0, benchSize, cost, value, 0)
        return
      }
      for (const p of players) {
        if (used.has(p.id) || !p.positions.includes(positions[slot])) continue
        used.add(p.id)
        pickStarters(slot + 1, used, cost + p.baseSalary, value + power(p), xCount + (p.isXPlayer ? 1 : 0))
        used.delete(p.id)
      }
    }
    function pickBench(rest: Player[], from: number, left: number, cost: number, starters: number, bench: number) {
      if (left === 0) {
        if (cost > cap) return
        if (!best || starters > best[0] || (starters === best[0] && bench > best[1])) best = [starters, bench]
        return
      }
      for (let i = from; i < rest.length; i++) {
        pickBench(rest, i + 1, left - 1, cost + rest[i].baseSalary, starters, bench + rest[i].offense + rest[i].defense)
      }
    }
    pickStarters(0, new Set(), 0, 0, 0)
    return best
  }

  it('matches brute force on random small pools', () => {
    let seed = 42
    const rand = (n: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % n
    }

    for (let trial = 0; trial < 150; trial++) {
      const players: Player[] = Array.from({ length: 8 + rand(3) }, (_, i) => {
        const isXPlayer = i < 2
        return makePlayer({
          id: `p${i}`,
          positions: [...new Set([positions[rand(5)], positions[rand(5)]])],
          isXPlayer,
          baseSalary: 50 + rand(200),
          offense: 10 + rand(90),
          defense: 10 + rand(90),
        })
      })
      const benchSize = 1 + rand(3)
      const cap = 500 + rand(1200)

      const expected = bruteForce(players, cap, benchSize)
      const result = findBestLineup(players, cap, { ...DEFAULT_PREFERENCES, benchSize })

      if (!expected) {
        expect(result.success, `trial ${trial}`).toBe(false)
        continue
      }
      expect(result.success, `trial ${trial}`).toBe(true)
      if (!result.success) continue
      const power = (p: Player) => p.offense + p.defense
      expect(result.slots.reduce((s, slot) => s + power(slot.player), 0), `trial ${trial} starters`).toBe(expected[0])
      expect(result.bench.reduce((s, p) => s + power(p), 0), `trial ${trial} bench`).toBe(expected[1])
      expect(result.bench).toHaveLength(benchSize)
      expect(result.totalBaseSalary).toBeLessThanOrEqual(cap)
    }
  })
})
