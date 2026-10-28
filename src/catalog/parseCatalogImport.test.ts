import { describe, it, expect } from 'vitest'
import { parseCatalogImport } from './parseCatalogImport'

describe('parseCatalogImport', () => {
  it('parses a valid batch', () => {
    const raw = JSON.stringify([
      { name: 'Victor Wembanyama', positions: ['PF', 'C'], price: 2500, offense: 182, defense: 218 },
    ])
    expect(parseCatalogImport(raw)).toEqual([
      { name: 'Victor Wembanyama', positions: ['PF', 'C'], price: 2500, offense: 182, defense: 218 },
    ])
  })

  it('keeps a trimmed team when one is given', () => {
    const raw = JSON.stringify([{ name: 'Nikola Jokic', positions: ['C'], price: 2400, offense: 249, defense: 119, team: ' DEN ' }])
    expect(parseCatalogImport(raw)[0].team).toBe('DEN')
  })

  it('throws when team is given but empty', () => {
    const raw = JSON.stringify([{ name: 'Test', positions: ['PG'], price: 100, offense: 50, defense: 50, team: ' ' }])
    expect(() => parseCatalogImport(raw)).toThrow('Row 1: "team" must be a non-empty string when given')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseCatalogImport('not json')).toThrow('Invalid JSON')
  })

  it('throws when the top level is not an array', () => {
    expect(() => parseCatalogImport('{}')).toThrow('Expected a JSON array of players')
  })

  it('throws when a row is missing a name', () => {
    const raw = JSON.stringify([{ positions: ['PG'], price: 100, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow('Row 1: "name" must be a non-empty string')
  })

  it('throws when positions contains an invalid value', () => {
    const raw = JSON.stringify([{ name: 'Test', positions: ['ZZ'], price: 100, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow(
      'Row 1: "positions" must be a non-empty array of PG/SG/SF/PF/C',
    )
  })

  it('throws when a numeric field is negative', () => {
    const raw = JSON.stringify([{ name: 'Test', positions: ['PG'], price: -1, offense: 50, defense: 50 }])
    expect(() => parseCatalogImport(raw)).toThrow('Row 1: "price" must be a non-negative number')
  })
})
