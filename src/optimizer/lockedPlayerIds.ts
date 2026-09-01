import type { SavedLineupSlot } from './types'

/**
 * The set of owned player ids committed to at least one saved lineup. Those
 * players are locked out of future lineup calculations. Slots saved before
 * `playerId` was recorded contribute nothing.
 */
export function lockedPlayerIds(lineups: { slots: SavedLineupSlot[] }[]): Set<string> {
  const ids = new Set<string>()
  for (const lineup of lineups) {
    for (const slot of lineup.slots) {
      if (slot.playerId) ids.add(slot.playerId)
    }
  }
  return ids
}
