import type { Position } from '../optimizer/types'

export interface CatalogPlayer {
  id: string
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  /** The player's team, e.g. "DEN"; null until an import sets one. Drives Team Big 3 stars. */
  team: string | null
  updatedAt: string
}

export interface CatalogImportRow {
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  /** Absent leaves an existing player's team as it is. */
  team?: string
}

export type CatalogDiffStatus = 'new' | 'changed' | 'unchanged'

export interface CatalogDiffEntry {
  row: CatalogImportRow
  status: CatalogDiffStatus
  existing: CatalogPlayer | null
}
