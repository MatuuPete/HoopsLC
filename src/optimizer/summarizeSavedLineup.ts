import type { SavedBenchPlayer, SavedLineupSlot } from './types'

export interface SavedLineupSummary {
  totalPowerBySal: number
  totalBaseSalary: number
  totalOffense: number
  totalDefense: number
}

/**
 * Totals for a saved lineup's starting five. The bench adds only to the base
 * salary total, because bench salaries count against the same cap.
 */
export function summarizeSavedLineup(
  slots: SavedLineupSlot[],
  bench: SavedBenchPlayer[] = [],
): SavedLineupSummary {
  const starters = slots.reduce<SavedLineupSummary>(
    (summary, slot) => ({
      totalPowerBySal: summary.totalPowerBySal + slot.currentSalary,
      totalBaseSalary: summary.totalBaseSalary + slot.baseSalary,
      totalOffense: summary.totalOffense + slot.offense,
      totalDefense: summary.totalDefense + slot.defense,
    }),
    { totalPowerBySal: 0, totalBaseSalary: 0, totalOffense: 0, totalDefense: 0 },
  )
  const benchBaseSalary = bench.reduce((sum, player) => sum + player.baseSalary, 0)
  return { ...starters, totalBaseSalary: starters.totalBaseSalary + benchBaseSalary }
}
