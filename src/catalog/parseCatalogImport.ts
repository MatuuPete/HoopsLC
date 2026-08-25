import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogImportRow } from './types'

function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as string[]).includes(value)
}

export function parseCatalogImport(raw: string): CatalogImportRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of players')
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Row ${index + 1}: expected an object`)
    }
    const row = entry as Record<string, unknown>

    if (typeof row.name !== 'string' || row.name.trim() === '') {
      throw new Error(`Row ${index + 1}: "name" must be a non-empty string`)
    }
    if (
      !Array.isArray(row.positions) ||
      row.positions.length === 0 ||
      !row.positions.every(isPosition)
    ) {
      throw new Error(`Row ${index + 1}: "positions" must be a non-empty array of PG/SG/SF/PF/C`)
    }
    for (const field of ['price', 'offense', 'defense'] as const) {
      const value = row[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Row ${index + 1}: "${field}" must be a non-negative number`)
      }
    }

    return {
      name: row.name.trim(),
      positions: row.positions as Position[],
      price: row.price as number,
      offense: row.offense as number,
      defense: row.defense as number,
    }
  })
}
