import { describe, expect, it } from 'vitest'
import { roleOf, withRole, type PlayerRoleLists } from './playerRoles'

const EMPTY: PlayerRoleLists = { requiredPlayerIds: [], preferredBenchPlayerIds: [], unavailablePlayerIds: [] }

describe('roleOf', () => {
  it('reads the role from whichever list holds the player', () => {
    const lists = { requiredPlayerIds: ['a'], preferredBenchPlayerIds: ['b'], unavailablePlayerIds: ['c'] }
    expect(roleOf(lists, 'a')).toBe('start')
    expect(roleOf(lists, 'b')).toBe('bench')
    expect(roleOf(lists, 'c')).toBe('out')
    expect(roleOf(lists, 'd')).toBeNull()
  })
})

describe('withRole', () => {
  it('adds the player to the list for the role', () => {
    expect(withRole(EMPTY, 'a', 'bench')).toEqual({ ...EMPTY, preferredBenchPlayerIds: ['a'] })
  })

  it('moves the player out of any other list, so they hold one role at most', () => {
    const lists = { ...EMPTY, requiredPlayerIds: ['a', 'x'], unavailablePlayerIds: ['y'] }
    expect(withRole(lists, 'a', 'out')).toEqual({
      requiredPlayerIds: ['x'],
      preferredBenchPlayerIds: [],
      unavailablePlayerIds: ['y', 'a'],
    })
  })

  it('clears the role when given null', () => {
    const lists = { ...EMPTY, preferredBenchPlayerIds: ['a', 'b'] }
    expect(withRole(lists, 'a', null)).toEqual({ ...EMPTY, preferredBenchPlayerIds: ['b'] })
  })

  it('does not duplicate a player already in the list', () => {
    const lists = { ...EMPTY, requiredPlayerIds: ['a'] }
    expect(withRole(lists, 'a', 'start')).toEqual(lists)
  })
})
