import { POSITIONS, type Position } from '../optimizer/types'
import type { CatalogImportRow, CatalogPlayer } from './types'

const STAT_FIELDS = ['positions', 'price', 'offense', 'defense'] as const

function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as string[]).includes(value)
}

/**
 * Parses a catalog batch. A row with only "name" and "team" sets just that
 * player's team: its positions, price and stats are copied from `existing`,
 * so stale numbers never ride along with a team update.
 */
export function parseCatalogImport(raw: string, existing: CatalogPlayer[] = []): CatalogImportRow[] {
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

    if (typeof row.name === 'string' && typeof row.team === 'string' && STAT_FIELDS.every((f) => !(f in row))) {
      const name = row.name.trim().toLowerCase()
      const match = existing.find((p) => p.name.trim().toLowerCase() === name)
      if (!match) {
        throw new Error(
          `Row ${index + 1}: "${row.name}" isn't in the catalog yet, so it needs positions, price, offense and defense`,
        )
      }
      if (row.team.trim() === '') throw new Error(`Row ${index + 1}: "team" must be a non-empty string when given`)
      const { name: matchName, positions, price, offense, defense } = match
      return { name: matchName, positions, price, offense, defense, team: row.team.trim() }
    }

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

    if (row.team !== undefined && (typeof row.team !== 'string' || row.team.trim() === '')) {
      throw new Error(`Row ${index + 1}: "team" must be a non-empty string when given`)
    }

    return {
      name: row.name.trim(),
      positions: row.positions as Position[],
      price: row.price as number,
      offense: row.offense as number,
      defense: row.defense as number,
      ...(typeof row.team === 'string' ? { team: row.team.trim() } : {}),
    }
  })
}
