import type { CatalogDiffEntry, CatalogImportRow, CatalogPlayer } from './types'

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function samePositions(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, i) => value === sortedB[i])
}

export function diffCatalogImport(rows: CatalogImportRow[], existing: CatalogPlayer[]): CatalogDiffEntry[] {
  return rows.map((row) => {
    const match = existing.find((catalogPlayer) => sameName(catalogPlayer.name, row.name))
    if (!match) {
      return { row, status: 'new', existing: null }
    }
    const unchanged =
      match.price === row.price &&
      match.offense === row.offense &&
      match.defense === row.defense &&
      samePositions(match.positions, row.positions)
    return { row, status: unchanged ? 'unchanged' : 'changed', existing: match }
  })
}
