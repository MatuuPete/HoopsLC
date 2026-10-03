import type { Player, SavedBenchPlayer, SavedLineupSlot } from './types'

/**
 * The set of owned player ids committed to at least one saved lineup, bench
 * included. Those players are locked out of future lineup calculations.
 *
 * Slots saved before `playerId` was recorded only carry a `name`, so they are
 * resolved back to an owned player by matching that name (case-insensitive).
 */
export function lockedPlayerIds(
  lineups: { slots: SavedLineupSlot[]; bench?: SavedBenchPlayer[] }[],
  players: Player[] = [],
): Set<string> {
  const idByName = new Map<string, string>()
  for (const player of players) {
    idByName.set(player.name.trim().toLowerCase(), player.id)
  }

  const ids = new Set<string>()
  for (const lineup of lineups) {
    for (const slot of lineup.slots) {
      if (slot.playerId) {
        ids.add(slot.playerId)
        continue
      }
      const matchedId = idByName.get(slot.name.trim().toLowerCase())
      if (matchedId) ids.add(matchedId)
    }
    for (const benchPlayer of lineup.bench ?? []) ids.add(benchPlayer.playerId)
  }
  return ids
}
