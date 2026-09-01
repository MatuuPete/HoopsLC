import type { SavedLineupSlot } from './types'

export interface SavedLineupSummary {
  totalPowerBySal: number
  totalBaseSalary: number
  totalOffense: number
  totalDefense: number
}

export function summarizeSavedLineup(slots: SavedLineupSlot[]): SavedLineupSummary {
  return slots.reduce<SavedLineupSummary>(
    (summary, slot) => ({
      totalPowerBySal: summary.totalPowerBySal + slot.currentSalary,
      totalBaseSalary: summary.totalBaseSalary + slot.baseSalary,
      totalOffense: summary.totalOffense + slot.offense,
      totalDefense: summary.totalDefense + slot.defense,
    }),
    { totalPowerBySal: 0, totalBaseSalary: 0, totalOffense: 0, totalDefense: 0 },
  )
}
