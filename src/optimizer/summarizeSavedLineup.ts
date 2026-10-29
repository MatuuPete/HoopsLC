import type { SavedBenchPlayer, SavedLineupSlot } from './types'

export interface SavedLineupSummary {
  totalPowerBySal: number
  totalBaseSalary: number
  totalOffense: number
  totalDefense: number
}

/**
 * Totals for a saved lineup. Base salary, offense and defense cover the whole
 * team, bench included; TPower by salary is the starting five only.
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
  return bench.reduce(
    (summary, player) => ({
      ...summary,
      totalBaseSalary: summary.totalBaseSalary + player.baseSalary,
      totalOffense: summary.totalOffense + player.offense,
      totalDefense: summary.totalDefense + player.defense,
    }),
    starters,
  )
}
