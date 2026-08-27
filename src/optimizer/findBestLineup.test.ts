import { describe, it, expect } from 'vitest'
import { findBestLineup } from './findBestLineup'
import type { LineupPreferences, Player } from './types'

const DEFAULT_PREFERENCES: LineupPreferences = {
  requiredPlayerIds: [],
  unavailablePlayerIds: [],
  objectiveMode: 'power',
  offenseWeight: 0.5,
}

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'positions'>): Player {
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
