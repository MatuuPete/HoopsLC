import { describe, it, expect } from 'vitest'
import { conferenceOf, diffXPoolImport, parseXPoolImport, type XPoolPlayer } from './xPool'

const melo = { name: 'Carmelo Anthony', team: 'DEN', positions: ['SF', 'PF'], offense: 267, defense: 183 }

describe('parseXPoolImport', () => {
  it('parses a row, defaulting the tier to standard', () => {
    expect(parseXPoolImport(JSON.stringify([melo]))).toEqual([{ ...melo, tier: 'standard' }])
  })

  it('accepts Legend X rows totalling 500', () => {
    const row = { ...melo, tier: 'legend', offense: 300, defense: 200 }
    expect(parseXPoolImport(JSON.stringify([row]))[0].tier).toBe('legend')
  })

  it("rejects stats that don't add up to the tier total", () => {
    const row = { ...melo, offense: 268 }
    expect(() => parseXPoolImport(JSON.stringify([row]))).toThrow(
      'Row 1: offense + defense must total 450 (X Player), got 451',
    )
  })

  it('requires a team', () => {
    const { team: _team, ...noTeam } = melo
    expect(() => parseXPoolImport(JSON.stringify([noTeam]))).toThrow('Row 1: "team" must be a non-empty string')
  })

  it('throws when the top level is not an array', () => {
    expect(() => parseXPoolImport(JSON.stringify(melo))).toThrow('Expected a JSON array of X Players')
  })
})

describe('diffXPoolImport', () => {
  const existing: XPoolPlayer = { id: '1', ...melo, positions: ['SF', 'PF'], tier: 'standard' }
  const row = parseXPoolImport(JSON.stringify([melo]))[0]

  it('marks unknown names as new', () => {
    expect(diffXPoolImport([row], [])[0].status).toBe('new')
  })

  it('matches names ignoring case and apostrophe style, ignoring position order', () => {
    const stored = { ...existing, positions: ['PF' as const, 'SF' as const] }
    expect(diffXPoolImport([row], [stored])[0].status).toBe('unchanged')
    const amare = parseXPoolImport(
      JSON.stringify([{ name: "Amar'e Stoudemire", team: 'NYK', positions: ['PF'], offense: 260, defense: 190 }]),
    )[0]
    const typed: XPoolPlayer = { id: '2', ...amare, name: 'amar’e stoudemire' }
    expect(diffXPoolImport([amare], [typed])[0].status).toBe('changed')
  })

  it('marks a team change as changed', () => {
    expect(diffXPoolImport([{ ...row, team: 'NYK' }], [existing])[0].status).toBe('changed')
  })
})

describe('conferenceOf', () => {
  it('splits teams into East and West', () => {
    expect(conferenceOf('BOS')).toBe('East')
    expect(conferenceOf('DEN')).toBe('West')
    expect(conferenceOf('PHI')).toBe('East')
    expect(conferenceOf('LAC')).toBe('West')
  })
})
