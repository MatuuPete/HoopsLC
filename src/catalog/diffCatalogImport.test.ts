import { describe, it, expect } from 'vitest'
import { diffCatalogImport } from './diffCatalogImport'
import type { CatalogImportRow, CatalogPlayer } from './types'

function makeCatalogPlayer(overrides: Partial<CatalogPlayer> & Pick<CatalogPlayer, 'id' | 'name'>): CatalogPlayer {
  return {
    positions: ['PG'],
    price: 100,
    offense: 50,
    defense: 50,
    updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  }
}

function makeImportRow(overrides: Partial<CatalogImportRow> & Pick<CatalogImportRow, 'name'>): CatalogImportRow {
  return {
    positions: ['PG'],
    price: 100,
    offense: 50,
    defense: 50,
    ...overrides,
  }
}

describe('diffCatalogImport', () => {
  it('marks a row as new when no existing catalog player matches the name', () => {
    const rows = [makeImportRow({ name: 'Victor Wembanyama' })]
    const result = diffCatalogImport(rows, [])
    expect(result).toEqual([{ row: rows[0], status: 'new', existing: null }])
  })

  it('marks a row as changed when price differs', () => {
    const existing = makeCatalogPlayer({ id: '1', name: 'Victor Wembanyama', price: 2470 })
    const row = makeImportRow({ name: 'Victor Wembanyama', price: 2500 })
    const result = diffCatalogImport([row], [existing])
    expect(result).toEqual([{ row, status: 'changed', existing }])
  })

  it('marks a row as unchanged when all fields match, ignoring position order', () => {
    const existing = makeCatalogPlayer({
      id: '1',
      name: 'Victor Wembanyama',
      positions: ['C', 'PF'],
      price: 2500,
      offense: 182,
      defense: 218,
    })
    const row = makeImportRow({
      name: 'Victor Wembanyama',
      positions: ['PF', 'C'],
      price: 2500,
      offense: 182,
      defense: 218,
    })
    const result = diffCatalogImport([row], [existing])
    expect(result).toEqual([{ row, status: 'unchanged', existing }])
  })

  it('matches names case-insensitively and ignoring surrounding whitespace', () => {
    const existing = makeCatalogPlayer({ id: '1', name: 'victor wembanyama ' })
    const row = makeImportRow({ name: 'Victor Wembanyama' })
    const result = diffCatalogImport([row], [existing])
    expect(result[0].status).toBe('unchanged')
    expect(result[0].existing).toBe(existing)
  })
})
