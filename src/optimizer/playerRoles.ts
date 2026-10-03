/**
 * What the user wants done with a player in the next calculation: forced
 * into the starting five, forced onto the bench, or left out. Each role is
 * stored as its own id list in settings; a player holds one role at most.
 */
export type PlayerRole = 'start' | 'bench' | 'out'

export interface PlayerRoleLists {
  requiredPlayerIds: string[]
  preferredBenchPlayerIds: string[]
  unavailablePlayerIds: string[]
}

const LIST_FOR_ROLE: Record<PlayerRole, keyof PlayerRoleLists> = {
  start: 'requiredPlayerIds',
  bench: 'preferredBenchPlayerIds',
  out: 'unavailablePlayerIds',
}

export function roleOf(lists: PlayerRoleLists, playerId: string): PlayerRole | null {
  for (const role of Object.keys(LIST_FOR_ROLE) as PlayerRole[]) {
    if (lists[LIST_FOR_ROLE[role]].includes(playerId)) return role
  }
  return null
}

/** `lists` with the player given `role` (or no role for null), removed from every other list. */
export function withRole(lists: PlayerRoleLists, playerId: string, role: PlayerRole | null): PlayerRoleLists {
  const next = {
    requiredPlayerIds: lists.requiredPlayerIds.filter((id) => id !== playerId),
    preferredBenchPlayerIds: lists.preferredBenchPlayerIds.filter((id) => id !== playerId),
    unavailablePlayerIds: lists.unavailablePlayerIds.filter((id) => id !== playerId),
  }
  if (role) {
    const key = LIST_FOR_ROLE[role]
    const kept = lists[key].includes(playerId) ? lists[key] : [...next[key], playerId]
    next[key] = kept
  }
  return next
}
