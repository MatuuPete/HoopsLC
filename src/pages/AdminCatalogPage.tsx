import { useState } from 'react'
import { useCatalog } from '../data/useCatalog'
import { parseCatalogImport } from '../catalog/parseCatalogImport'
import { diffCatalogImport } from '../catalog/diffCatalogImport'
import type { CatalogDiffEntry, CatalogImportRow } from '../catalog/types'

export function AdminCatalogPage() {
  const { catalog, importBatch } = useCatalog()
  const [raw, setRaw] = useState('')
  const [diff, setDiff] = useState<CatalogDiffEntry[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  function handlePreview() {
    setParseError(null)
    setDiff(null)
    try {
      const rows = parseCatalogImport(raw)
      setDiff(diffCatalogImport(rows, catalog))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse batch')
    }
  }

  async function handleConfirm() {
    if (!diff) return
    setImporting(true)
    setImportError(null)
    try {
      const rows: CatalogImportRow[] = diff.map((entry) => entry.row)
      await importBatch(rows)
      setDiff(null)
      setRaw('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl">
      <h1 className="text-sm uppercase tracking-widest text-muted">Catalog Admin</h1>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-muted">
        Batch JSON
        <textarea
          className="bg-bg border border-border px-2 py-1 text-text h-40 font-mono text-xs"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </label>

      {parseError && <p className="text-xs text-red-400">{parseError}</p>}

      <button
        onClick={handlePreview}
        className="border border-border px-4 py-2 uppercase tracking-widest text-xs w-fit"
      >
        Preview
      </button>

      {diff && (
        <div className="border border-border bg-panel p-4 flex flex-col gap-2">
          {diff.map((entry) => (
            <div key={entry.row.name} className="flex justify-between text-sm">
              <span className={entry.status === 'unchanged' ? 'text-muted' : 'text-text'}>
                {entry.row.name} {entry.status === 'new' && '(new)'}
              </span>
              <span className="text-muted">
                {entry.existing ? `${entry.existing.price} -> ${entry.row.price}` : `${entry.row.price}`}
              </span>
            </div>
          ))}

          {importError && <p className="text-xs text-red-400">{importError}</p>}

          <button
            onClick={handleConfirm}
            disabled={importing}
            className="bg-text text-bg px-4 py-2 uppercase tracking-widest text-xs font-bold w-fit disabled:opacity-50"
          >
            Confirm Import
          </button>
        </div>
      )}
    </div>
  )
}
