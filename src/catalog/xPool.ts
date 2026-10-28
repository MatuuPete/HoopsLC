import { POSITIONS, X_TIERS, type Position, type XTier } from '../optimizer/types'

/** One X Player in the shared pool: the game's own list, the same for every user. */
export interface XPoolPlayer {
  id: string
  name: string
  team: string
  positions: Position[]
  tier: XTier
  offense: number
  defense: number
}

export interface XPoolImportRow {
  name: string
  team: string
  positions: Position[]
  /** Absent in the JSON means 'standard'. */
  tier: XTier
  offense: number
  defense: number
}

export type XPoolDiffStatus = 'new' | 'changed' | 'unchanged'

export interface XPoolDiffEntry {
  row: XPoolImportRow
  status: XPoolDiffStatus
  existing: XPoolPlayer | null
}

/** Eastern Conference team codes; every other team is in the West. */
const EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])

export type Conference = 'East' | 'West'

export function conferenceOf(team: string): Conference {
  return EAST.has(team) ? 'East' : 'West'
}

function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as string[]).includes(value)
}

function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/’/g, "'")
  return norm(a) === norm(b)
}

/** Parses an X Pool batch, checking each row's stats add up to its tier's total. */
export function parseXPoolImport(raw: string): XPoolImportRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of X Players')

  return parsed.map((entry, index) => {
    const at = `Row ${index + 1}`
    if (typeof entry !== 'object' || entry === null) throw new Error(`${at}: expected an object`)
    const row = entry as Record<string, unknown>

    if (typeof row.name !== 'string' || row.name.trim() === '') {
      throw new Error(`${at}: "name" must be a non-empty string`)
    }
    if (typeof row.team !== 'string' || row.team.trim() === '') {
      throw new Error(`${at}: "team" must be a non-empty string`)
    }
    if (!Array.isArray(row.positions) || row.positions.length === 0 || !row.positions.every(isPosition)) {
      throw new Error(`${at}: "positions" must be a non-empty array of PG/SG/SF/PF/C`)
    }
    const tier = row.tier ?? 'standard'
    if (tier !== 'standard' && tier !== 'legend') throw new Error(`${at}: "tier" must be "standard" or "legend"`)
    for (const field of ['offense', 'defense'] as const) {
      const value = row[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`${at}: "${field}" must be a non-negative number`)
      }
    }
    const offense = row.offense as number
    const defense = row.defense as number
    const total = X_TIERS[tier].statTotal
    if (offense + defense !== total) {
      throw new Error(`${at}: offense + defense must total ${total} (${X_TIERS[tier].label}), got ${offense + defense}`)
    }

    return {
      name: row.name.trim(),
      team: row.team.trim(),
      positions: row.positions as Position[],
      tier,
      offense,
      defense,
    }
  })
}

export function diffXPoolImport(rows: XPoolImportRow[], existing: XPoolPlayer[]): XPoolDiffEntry[] {
  return rows.map((row) => {
    const match = existing.find((p) => sameName(p.name, row.name))
    if (!match) return { row, status: 'new', existing: null }
    const unchanged =
      match.name === row.name &&
      match.team === row.team &&
      match.tier === row.tier &&
      match.offense === row.offense &&
      match.defense === row.defense &&
      [...match.positions].sort().join() === [...row.positions].sort().join()
    return { row, status: unchanged ? 'unchanged' : 'changed', existing: match }
  })
}
