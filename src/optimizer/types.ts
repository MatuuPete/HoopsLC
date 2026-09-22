export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export type XTier = 'standard' | 'legend'

/** Offense + Defense must equal exactly `statTotal` for an X Player of that tier. */
export const X_TIERS: Record<XTier, { label: string; shortLabel: string; statTotal: number }> = {
  standard: { label: 'X Player', shortLabel: 'X', statTotal: 450 },
  legend: { label: 'Legend X', shortLabel: 'LX', statTotal: 500 },
}

export interface Player {
  id: string
  name: string
  positions: Position[]
  isXPlayer: boolean
  /** Set only for X Players; null for regular players. */
  xTier: XTier | null
  baseSalary: number
  currentSalary: number
  offense: number
  defense: number
  catalogPlayerId: string | null
}

export interface LineupSlot {
  position: Position
  player: Player
}

/**
 * A point-in-time snapshot of one slot in a saved lineup. Values are copied
 * from the player at save time so a saved lineup keeps rendering what it was
 * even after catalog prices or stats change.
 */
export interface SavedLineupSlot {
  position: Position
  /**
   * The owned player this slot was filled with. Used to lock that player out
   * of future lineups. Optional only for back-compat with lineups saved
   * before this field existed — those contribute nothing to the locked set.
   */
  playerId?: string
  name: string
  isXPlayer: boolean
  /** Absent on lineups saved before Legend X existed — those are standard. */
  xTier?: XTier
  currentSalary: number
  baseSalary: number
  offense: number
  defense: number
}

export type ObjectiveMode = 'power' | 'stats'

export interface LineupPreferences {
  requiredPlayerIds: string[]
  unavailablePlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
}

export interface LineupSuccess {
  success: true
  slots: LineupSlot[]
  totalBaseSalary: number
  totalCurrentSalary: number
  remainingCap: number
}

export interface LineupMissingPosition {
  success: false
  reason: 'missing_position'
  missingPositions: Position[]
}

export interface LineupCapTooLow {
  success: false
  reason: 'cap_too_low'
  cheapestPossibleBaseSalary: number
  closestLineup: LineupSlot[]
  closestTotalCurrentSalary: number
}

export interface LineupNoValidXSlot {
  success: false
  reason: 'no_valid_x_slot'
  positionsWithoutXPlayer: Position[]
  positionsWithoutRegularPlayer: Position[]
}

export interface LineupRequiredPlayersConflict {
  success: false
  reason: 'required_players_conflict'
  conflictingPlayerIds: string[]
}

export type LineupResult =
  | LineupSuccess
  | LineupMissingPosition
  | LineupCapTooLow
  | LineupNoValidXSlot
  | LineupRequiredPlayersConflict
