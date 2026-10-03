import { describe, it, expect } from 'vitest'
import { formatSortValue, sortPlayers } from './playerSort'
import type { Player } from '../optimizer/types'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id'>): Player {
  return {
    name: overrides.id,
    positions: ['PG'],
    isXPlayer: false,
    xTier: null,
    baseSalary: 100,
    currentSalary: 100,
    offense: 50,
    defense: 50,
    catalogPlayerId: null,
    ...overrides,
  }
}

const ids = (players: Player[]) => players.map((p) => p.id)

describe('sortPlayers', () => {
  const players = [
    makePlayer({ id: 'cheap', baseSalary: 50, offense: 40, defense: 40, currentSalary: 200, positions: ['C'] }),
    makePlayer({ id: 'star', baseSalary: 400, offense: 200, defense: 100, currentSalary: 300, positions: ['SG', 'PG'] }),
    makePlayer({ id: 'lx', isXPlayer: true, xTier: 'legend', baseSalary: 999, offense: 250, defense: 250, positions: ['SF'] }),
    makePlayer({ id: 'x', isXPlayer: true, xTier: 'standard', baseSalary: 999, offense: 300, defense: 150, positions: ['PF'] }),
  ]

  it('sorts by power, strongest first', () => {
    expect(ids(sortPlayers(players, { key: 'power', dir: 'desc' }))).toEqual(['lx', 'x', 'star', 'cheap'])
  })

  it('counts award bonuses toward power', () => {
    const sga = makePlayer({ id: 'sga', name: 'Shai Gilgeous-Alexander', offense: 50, defense: 50 })
    const twin = makePlayer({ id: 'twin', offense: 55, defense: 55 })
    expect(ids(sortPlayers([twin, sga], { key: 'power', dir: 'desc' }))).toEqual(['sga', 'twin'])
  })

  it('sorts by power per salary', () => {
    expect(ids(sortPlayers(players, { key: 'value', dir: 'desc' }))).toEqual(['cheap', 'star', 'lx', 'x'])
  })

  it('sorts by price change', () => {
    expect(ids(sortPlayers(players, { key: 'gain', dir: 'desc' }))[0]).toBe('cheap')
  })

  it('puts Legend X first, then X, then regular players by power', () => {
    expect(ids(sortPlayers(players, { key: 'tier', dir: 'desc' }))).toEqual(['lx', 'x', 'star', 'cheap'])
  })

  it('sorts by the earliest position a player can play', () => {
    expect(ids(sortPlayers(players, { key: 'position', dir: 'asc' }))).toEqual(['star', 'lx', 'x', 'cheap'])
  })

  it('sorts by name either way', () => {
    expect(ids(sortPlayers(players, { key: 'name', dir: 'asc' }))).toEqual(['cheap', 'lx', 'star', 'x'])
    expect(ids(sortPlayers(players, { key: 'name', dir: 'desc' }))).toEqual(['x', 'star', 'lx', 'cheap'])
  })

  it('breaks ties by power, then name', () => {
    const a = makePlayer({ id: 'a', offense: 10 })
    const b = makePlayer({ id: 'b', offense: 90 })
    const c = makePlayer({ id: 'c', offense: 90 })
    expect(ids(sortPlayers([a, c, b], { key: 'salary', dir: 'asc' }))).toEqual(['b', 'c', 'a'])
  })

  it('does not change the input array', () => {
    const copy = [...players]
    sortPlayers(players, { key: 'name', dir: 'asc' })
    expect(players).toEqual(copy)
  })
})

describe('formatSortValue', () => {
  it('signs price changes and rounds value', () => {
    const p = makePlayer({ id: 'p', baseSalary: 300, currentSalary: 420, offense: 50, defense: 5 })
    expect(formatSortValue(p, 'gain')).toBe('+120')
    expect(formatSortValue(p, 'value')).toBe('18.3')
  })
})
