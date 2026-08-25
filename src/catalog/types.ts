import type { Position } from '../optimizer/types'

export interface CatalogPlayer {
  id: string
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
  updatedAt: string
}

export interface CatalogImportRow {
  name: string
  positions: Position[]
  price: number
  offense: number
  defense: number
}

export type CatalogDiffStatus = 'new' | 'changed' | 'unchanged'

export interface CatalogDiffEntry {
  row: CatalogImportRow
  status: CatalogDiffStatus
  existing: CatalogPlayer | null
}
