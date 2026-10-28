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
      // 100 + 96 raw, plus the Player of the Week bonus (+5 OFF) = 201.
      makePlayer({ id: 'sf-potw', name: 'Ty Jerome', positions: ['SF'], currentSalary: 200, offense: 100, defense: 96 }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
    const result = findBestLineup(players, 10000, DEFAULT_PREFERENCES)
    expect(result.success).toBe(true)
    if (!result.success) return
    const ids = result.slots.map((s) => s.player.id)
    expect(ids).toContain('pg-strong')
    expect(ids).toContain('sf-potw')
  })

  it('counts award bonuses toward stats-mode value', () => {
    // Two PGs with identical raw stats and salary; only one has an award (Player of the Week, +5 OFF).
    const players: Player[] = [
      makePlayer({ id: 'a-plain', name: 'Plain Guard', positions: ['PG'] }),
      makePlayer({ id: 'z-potw', name: 'Ty Jerome', positions: ['PG'] }),
      makePlayer({ id: 'sg', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf', positions: ['SF'] }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
    const result = findBestLineup(players, 10000, { ...DEFAULT_PREFERENCES, objectiveMode: 'stats' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('z-potw')
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
  function bruteForce(players: Player[], cap: number, benchSize: number, extraLegendX = false): [number, number] | null {
    const power = (p: Player) => p.offense + p.defense
    let best: [number, number] | null = null
    function pickStarters(slot: number, used: Set<string>, cost: number, value: number, xCount: number) {
      if (slot === positions.length) {
        const legends = players.filter((p) => used.has(p.id) && p.xTier === 'legend').length
        if (!(xCount === 1 || (extraLegendX && xCount === 2 && legends >= 1))) return
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

  it('matches brute force on random small pools during a Legend X event', () => {
    let seed = 7
    const rand = (n: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % n
    }

    for (let trial = 0; trial < 150; trial++) {
      const players: Player[] = Array.from({ length: 8 + rand(3) }, (_, i) => {
        const isXPlayer = i < 3
        return makePlayer({
          id: `p${i}`,
          positions: [...new Set([positions[rand(5)], positions[rand(5)]])],
          isXPlayer,
          xTier: isXPlayer ? (rand(2) === 0 ? 'legend' : 'standard') : null,
          baseSalary: 50 + rand(200),
          offense: 10 + rand(90),
          defense: 10 + rand(90),
        })
      })
      const benchSize = rand(3)
      const cap = 500 + rand(1200)

      const expected = bruteForce(players, cap, benchSize, true)
      const result = findBestLineup(players, cap, { ...DEFAULT_PREFERENCES, benchSize, extraLegendX: true })

      if (!expected) {
        expect(result.success, `trial ${trial}`).toBe(false)
        continue
      }
      expect(result.success, `trial ${trial}`).toBe(true)
      if (!result.success) continue
      const power = (p: Player) => p.offense + p.defense
      expect(result.slots.reduce((s, slot) => s + power(slot.player), 0), `trial ${trial} starters`).toBe(expected[0])
      expect(result.bench.reduce((s, p) => s + power(p), 0), `trial ${trial} bench`).toBe(expected[1])
    }
  })
})

describe('findBestLineup with Team Big 3', () => {
  // Three Denver stars and a non-star at each position they'd compete with.
  function denverPool(): Player[] {
    return [
      makePlayer({ id: 'jokic', positions: ['C'], catalogPlayerId: 'jokic', offense: 249, defense: 119 }),
      makePlayer({ id: 'murray', positions: ['PG'], catalogPlayerId: 'murray', offense: 100, defense: 60 }),
      makePlayer({ id: 'gordon', positions: ['PF'], catalogPlayerId: 'gordon', offense: 80, defense: 80 }),
      makePlayer({ id: 'pg-other', positions: ['PG'], offense: 110, defense: 60 }),
      makePlayer({ id: 'pf-other', positions: ['PF'], offense: 90, defense: 80 }),
      makePlayer({ id: 'sg', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf', positions: ['SF'] }),
    ]
  }
  const denverStars = new Map([
    ['jokic', 'DEN'],
    ['murray', 'DEN'],
    ['gordon', 'DEN'],
  ])

  it('fields a Big 3 when its bonus beats stronger individual players', () => {
    const result = findBestLineup(denverPool(), 10000, {
      ...DEFAULT_PREFERENCES,
      big3: { maxCount: 1, stars: denverStars },
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    const ids = result.slots.map((s) => s.player.id)
    expect(ids).toEqual(expect.arrayContaining(['jokic', 'murray', 'gordon']))
    expect(result.big3s).toEqual([{ team: 'DEN', playerIds: expect.arrayContaining(['jokic', 'murray', 'gordon']) }])
  })

  it('ignores Big 3s when the setting is off', () => {
    const result = findBestLineup(denverPool(), 10000, {
      ...DEFAULT_PREFERENCES,
      big3: { maxCount: 0, stars: denverStars },
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.big3s).toEqual([])
    expect(result.slots.map((s) => s.player.id)).toEqual(expect.arrayContaining(['pg-other', 'pf-other']))
  })

  it('skips a Big 3 the cap cannot afford', () => {
    const players = denverPool().map((p) => (p.id === 'murray' ? { ...p, baseSalary: 5000 } : p))
    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      big3: { maxCount: 1, stars: denverStars },
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.big3s).toEqual([])
  })

  it('counts bench players toward a Big 3', () => {
    // Gordon can't start over pf-other even with his bonus (120 + 30 < 170),
    // but on the bench he completes the trio and boosts Jokic and Murray.
    const players = [
      ...denverPool().map((p) => (p.id === 'gordon' ? { ...p, offense: 60, defense: 60 } : p)),
      makePlayer({ id: 'bench-filler', positions: ['SF'], offense: 1, defense: 1 }),
    ]
    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      big3: { maxCount: 1, stars: denverStars },
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.big3s).toHaveLength(1)
    expect(result.slots.map((s) => s.player.id)).toEqual(expect.arrayContaining(['jokic', 'murray', 'pf-other']))
    expect(result.bench.map((p) => p.id)).toEqual(['gordon'])
  })

  it('fields two Big 3s from different teams when allowed', () => {
    const players = [
      makePlayer({ id: 'd1', positions: ['PG'], catalogPlayerId: 'd1' }),
      makePlayer({ id: 'd2', positions: ['SG'], catalogPlayerId: 'd2' }),
      makePlayer({ id: 'd3', positions: ['SF'], catalogPlayerId: 'd3' }),
      makePlayer({ id: 'b1', positions: ['PF'], catalogPlayerId: 'b1' }),
      makePlayer({ id: 'b2', positions: ['C'], catalogPlayerId: 'b2' }),
      makePlayer({ id: 'b3', positions: ['C'], catalogPlayerId: 'b3' }),
      makePlayer({ id: 'x', positions: ['C'], isXPlayer: true }),
      makePlayer({ id: 'filler', positions: ['SF'], currentSalary: 300 }),
    ]
    const stars = new Map([
      ['d1', 'DEN'],
      ['d2', 'DEN'],
      ['d3', 'DEN'],
      ['b1', 'BOS'],
      ['b2', 'BOS'],
      ['b3', 'BOS'],
    ])
    // The filler outranks d3 at SF, so d3, b2 and b3 all need bench spots.
    const preferences = { ...DEFAULT_PREFERENCES, benchSize: 3 }

    const two = findBestLineup(players, 10000, { ...preferences, big3: { maxCount: 2, stars } })
    expect(two.success).toBe(true)
    if (!two.success) return
    expect(two.big3s.map((b) => b.team).sort()).toEqual(['BOS', 'DEN'])

    const one = findBestLineup(players, 10000, { ...preferences, big3: { maxCount: 1, stars } })
    expect(one.success).toBe(true)
    if (!one.success) return
    expect(one.big3s).toHaveLength(1)
  })

  describe('against brute force', () => {
    const positions: Player['positions'][number][] = ['PG', 'SG', 'SF', 'PF', 'C']
    const bonusPower = (p: Player) => Math.round(p.offense * 0.25) + Math.round(p.defense * 0.25)

    /** Best [starter bonus, bench bonus] from at most `maxCount` same-team trios among the fielded stars. */
    function bestBonus(starters: Player[], bench: Player[], stars: Map<string, string>, maxCount: number): [number, number] {
      const byTeam = new Map<string, Player[]>()
      for (const p of [...starters, ...bench]) {
        const team = p.catalogPlayerId ? stars.get(p.catalogPlayerId) : undefined
        if (team) byTeam.set(team, [...(byTeam.get(team) ?? []), p])
      }
      const teamOptions = [...byTeam.values()].map((group) => {
        const options: [number, number][] = []
        for (let a = 0; a < group.length; a++)
          for (let b = a + 1; b < group.length; b++)
            for (let c = b + 1; c < group.length; c++) {
              const trio = [group[a], group[b], group[c]]
              const s = trio.filter((p) => starters.includes(p)).reduce((sum, p) => sum + bonusPower(p), 0)
              const n = trio.filter((p) => bench.includes(p)).reduce((sum, p) => sum + bonusPower(p), 0)
              options.push([s, n])
            }
        return options
      })
      let best: [number, number] = [0, 0]
      const better = (x: [number, number]) => x[0] > best[0] || (x[0] === best[0] && x[1] > best[1])
      function pick(team: number, left: number, acc: [number, number]) {
        if (better(acc)) best = acc
        if (team === teamOptions.length || left === 0) return
        pick(team + 1, left, acc)
        for (const [s, n] of teamOptions[team]) pick(team + 1, left - 1, [acc[0] + s, acc[1] + n])
      }
      pick(0, maxCount, [0, 0])
      return best
    }

    function bruteForce(players: Player[], cap: number, benchSize: number, stars: Map<string, string>, maxCount: number) {
      const power = (p: Player) => p.offense + p.defense
      let best: [number, number] | null = null
      function pickStarters(slot: number, starters: Player[], cost: number) {
        if (slot === positions.length) {
          if (starters.filter((p) => p.isXPlayer).length !== 1) return
          const rest = players.filter((p) => !starters.includes(p) && !p.isXPlayer)
          pickBench(rest, 0, benchSize, cost, starters, [])
          return
        }
        for (const p of players) {
          if (starters.includes(p) || !p.positions.includes(positions[slot])) continue
          pickStarters(slot + 1, [...starters, p], cost + p.baseSalary)
        }
      }
      function pickBench(rest: Player[], from: number, left: number, cost: number, starters: Player[], bench: Player[]) {
        if (left === 0) {
          if (cost > cap) return
          const [sb, bb] = bestBonus(starters, bench, stars, maxCount)
          const total: [number, number] = [
            starters.reduce((s, p) => s + power(p), 0) + sb,
            bench.reduce((s, p) => s + power(p), 0) + bb,
          ]
          if (!best || total[0] > best[0] || (total[0] === best[0] && total[1] > best[1])) best = total
          return
        }
        for (let i = from; i < rest.length; i++) {
          pickBench(rest, i + 1, left - 1, cost + rest[i].baseSalary, starters, [...bench, rest[i]])
        }
      }
      pickStarters(0, [], 0)
      return best
    }

    it('matches brute force on random small pools with one or two Big 3s', () => {
      let seed = 2024
      const rand = (n: number) => {
        seed = (seed * 16807) % 2147483647
        return seed % n
      }
      const teams = ['DEN', 'BOS', 'LAL']
      const big3Counts = [0, 0, 0]

      for (let trial = 0; trial < 150; trial++) {
        const stars = new Map<string, string>()
        // Every third pool is all stars from two teams, so two Big 3s come up.
        const allStars = trial % 3 === 0
        const players: Player[] = Array.from({ length: 8 + rand(3) }, (_, i) => {
          const isXPlayer = i < 2
          if (!isXPlayer && (allStars || rand(3) > 0)) stars.set(`c${i}`, teams[rand(allStars ? 2 : 3)])
          return makePlayer({
            id: `p${i}`,
            positions: [...new Set([positions[rand(5)], positions[rand(5)]])],
            isXPlayer,
            catalogPlayerId: isXPlayer ? null : `c${i}`,
            baseSalary: 50 + rand(200),
            offense: 10 + rand(90),
            defense: 10 + rand(90),
          })
        })
        // Two Big 3s need six stars fielded, so allow up to three bench spots.
        const benchSize = rand(4)
        const maxCount = 1 + rand(2)
        const cap = 500 + rand(1200)

        const expected = bruteForce(players, cap, benchSize, stars, maxCount)
        const result = findBestLineup(players, cap, { ...DEFAULT_PREFERENCES, benchSize, big3: { maxCount, stars } })

        if (!expected) {
          expect(result.success, `trial ${trial}`).toBe(false)
          continue
        }
        expect(result.success, `trial ${trial}`).toBe(true)
        if (!result.success) continue
        const starterIds = new Set(result.slots.map((s) => s.player.id))
        const bonusIds = new Set(result.big3s.flatMap((b) => b.playerIds))
        const total = (list: Player[], starter: boolean) =>
          list
            .filter((p) => starterIds.has(p.id) === starter)
            .reduce((sum, p) => sum + p.offense + p.defense + (bonusIds.has(p.id) ? bonusPower(p) : 0), 0)
        const fielded = [...result.slots.map((s) => s.player), ...result.bench]
        expect(total(fielded, true), `trial ${trial} starters`).toBe(expected[0])
        expect(total(fielded, false), `trial ${trial} bench`).toBe(expected[1])
        expect(result.big3s.length, `trial ${trial} count`).toBeLessThanOrEqual(maxCount)
        big3Counts[result.big3s.length]++
      }
      // The pools must actually exercise one and two Big 3s, not just lineups without any.
      expect(big3Counts[1]).toBeGreaterThan(10)
      expect(big3Counts[2]).toBeGreaterThan(0)
    })
  })
})

describe('findBestLineup X Player limit', () => {
  const legend = (id: string, positions: Player['positions'], power = 500) =>
    makePlayer({ id, positions, isXPlayer: true, xTier: 'legend', offense: power / 2, defense: power / 2 })
  const standard = (id: string, positions: Player['positions'], power = 450) =>
    makePlayer({ id, positions, isXPlayer: true, xTier: 'standard', offense: power / 2, defense: power / 2 })
  const regulars = () =>
    (['PG', 'SG', 'SF', 'PF', 'C'] as const).map((pos) => makePlayer({ id: pos.toLowerCase(), positions: [pos] }))
  const xIds = (result: ReturnType<typeof findBestLineup>) =>
    result.success ? result.slots.filter((s) => s.player.isXPlayer).map((s) => s.player.id).sort() : []

  it('reports x_players_conflict instead of fielding two X Players set to Start', () => {
    const players = [legend('lx1', ['PG']), legend('lx2', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, { ...DEFAULT_PREFERENCES, requiredPlayerIds: ['lx1', 'lx2'] })
    expect(result).toEqual({
      success: false,
      reason: 'x_players_conflict',
      conflictingPlayerIds: ['lx1', 'lx2'],
      extraLegendX: false,
    })
  })

  it('fields one X Player without the event, even when two Legend X would be stronger', () => {
    const players = [legend('lx1', ['PG']), legend('lx2', ['SG']), ...regulars()]
    expect(xIds(findBestLineup(players, 10_000, DEFAULT_PREFERENCES))).toHaveLength(1)
  })

  it('adds a Legend X next to a standard X during the event', () => {
    const players = [standard('x', ['PG']), legend('lx', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, { ...DEFAULT_PREFERENCES, extraLegendX: true })
    expect(xIds(result)).toEqual(['lx', 'x'])
  })

  it('fields two Legend X during the event', () => {
    const players = [legend('lx1', ['PG']), legend('lx2', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, { ...DEFAULT_PREFERENCES, extraLegendX: true })
    expect(xIds(result)).toEqual(['lx1', 'lx2'])
  })

  it('never pairs two standard X Players, even during the event', () => {
    const players = [standard('x1', ['PG']), standard('x2', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, { ...DEFAULT_PREFERENCES, extraLegendX: true })
    expect(xIds(result)).toHaveLength(1)
  })

  it('leaves the extra spot unused during the event when a regular player is stronger', () => {
    const players = [standard('x', ['PG']), legend('lx', ['SG'], 100), ...regulars()]
    players.find((p) => p.id === 'sg')!.offense = 300
    const result = findBestLineup(players, 10_000, { ...DEFAULT_PREFERENCES, extraLegendX: true })
    expect(xIds(result)).toEqual(['x'])
  })

  it('accepts a standard X and a Legend X set to Start during the event', () => {
    const players = [standard('x', ['PG']), legend('lx', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['x', 'lx'],
      extraLegendX: true,
    })
    expect(xIds(result)).toEqual(['lx', 'x'])
  })

  it('reports x_players_conflict for two standard X set to Start during the event', () => {
    const players = [standard('x1', ['PG']), standard('x2', ['SG']), ...regulars()]
    const result = findBestLineup(players, 10_000, {
      ...DEFAULT_PREFERENCES,
      requiredPlayerIds: ['x1', 'x2'],
      extraLegendX: true,
    })
    expect(result.success === false && result.reason).toBe('x_players_conflict')
  })
})

describe('findBestLineup with preferred bench players', () => {
  function startingFive(): Player[] {
    return [
      makePlayer({ id: 'pg', positions: ['PG'] }),
      makePlayer({ id: 'sg-x', positions: ['SG'], isXPlayer: true }),
      makePlayer({ id: 'sf', positions: ['SF'] }),
      makePlayer({ id: 'pf', positions: ['PF'] }),
      makePlayer({ id: 'c', positions: ['C'] }),
    ]
  }

  it('puts a preferred bench player on the bench even when they would otherwise start', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'pg-star', positions: ['PG'], currentSalary: 300 }),
      makePlayer({ id: 'e-1', positions: ['C'], currentSalary: 50 }),
      makePlayer({ id: 'e-2', positions: ['C'], currentSalary: 10 }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 2,
      preferredBenchPlayerIds: ['pg-star'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg')
    expect(result.bench.map((p) => p.id).sort()).toEqual(['e-1', 'pg-star'])
  })

  it('keeps a weak preferred bench player over a stronger one', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-strong', positions: ['C'], currentSalary: 90 }),
      makePlayer({ id: 'e-weak', positions: ['C'], currentSalary: 10 }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      preferredBenchPlayerIds: ['e-weak'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.bench.map((p) => p.id)).toEqual(['e-weak'])
  })

  it('reports bench_preferred_overflow when more bench players are preferred than there are spots', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-1', positions: ['C'] }),
      makePlayer({ id: 'e-2', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      preferredBenchPlayerIds: ['e-1', 'e-2'],
    })

    expect(result.success).toBe(false)
    if (result.success || result.reason !== 'bench_preferred_overflow') throw new Error('expected overflow')
    expect(result.preferredCount).toBe(2)
    expect(result.benchSize).toBe(1)
  })

  it('reports required_players_conflict when a player is preferred for both the five and the bench', () => {
    const players = [...startingFive(), makePlayer({ id: 'e-1', positions: ['C'] })]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      requiredPlayerIds: ['pg'],
      preferredBenchPlayerIds: ['pg'],
    })

    expect(result.success).toBe(false)
    if (result.success || result.reason !== 'required_players_conflict') throw new Error('expected conflict')
    expect(result.conflictingPlayerIds).toEqual(['pg'])
  })

  it('reports required_players_conflict when two copies of one player are preferred, one to start and one for the bench', () => {
    const players = [
      ...startingFive().map((p) => (p.id === 'sf' ? { ...p, catalogPlayerId: 'cat-sf' } : p)),
      makePlayer({ id: 'sf-copy', positions: ['SF'], catalogPlayerId: 'cat-sf' }),
      makePlayer({ id: 'e-1', positions: ['C'] }),
    ]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      requiredPlayerIds: ['sf'],
      preferredBenchPlayerIds: ['sf-copy'],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.reason).toBe('required_players_conflict')
  })

  it('ignores preferred bench players when there is no bench', () => {
    const players = [...startingFive(), makePlayer({ id: 'pg-star', positions: ['PG'], currentSalary: 300 })]

    const result = findBestLineup(players, 10000, {
      ...DEFAULT_PREFERENCES,
      preferredBenchPlayerIds: ['pg-star'],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.slots.find((s) => s.position === 'PG')?.player.id).toBe('pg-star')
    expect(result.bench).toEqual([])
  })

  it('counts preferred bench salaries against the cap', () => {
    const players = [
      ...startingFive(),
      makePlayer({ id: 'e-pricey', positions: ['C'], baseSalary: 600 }),
    ]

    const result = findBestLineup(players, 1000, {
      ...DEFAULT_PREFERENCES,
      benchSize: 1,
      preferredBenchPlayerIds: ['e-pricey'],
    })

    expect(result.success).toBe(false)
    if (result.success || result.reason !== 'cap_too_low') throw new Error('expected cap_too_low')
    expect(result.cheapestPossibleBaseSalary).toBe(1100)
    expect(result.closestBench.map((p) => p.id)).toEqual(['e-pricey'])
  })
})
