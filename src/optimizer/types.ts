import type { Award } from './awards'

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
  /** Offense and defense include any award bonus the player had at save time. */
  offense: number
  defense: number
  /** Absent when the player had no award, or on lineups saved before awards existed. */
  award?: Award
}

/** Bench spots a lineup can have on top of the starting five. */
export const MAX_BENCH_SIZE = 6

/**
 * A point-in-time snapshot of one bench player in a saved lineup, copied at
 * save time like SavedLineupSlot. Bench players are never X Players and have
 * no slot, so they keep every position they can play instead.
 */
export interface SavedBenchPlayer {
  playerId: string
  name: string
  positions: Position[]
  currentSalary: number
  baseSalary: number
  /** Offense and defense include any award bonus the player had at save time. */
  offense: number
  defense: number
  award?: Award
}

export type ObjectiveMode = 'power' | 'stats'

export interface LineupPreferences {
  requiredPlayerIds: string[]
  unavailablePlayerIds: string[]
  objectiveMode: ObjectiveMode
  offenseWeight: number
  /**
   * Bench spots to fill after the starting five; 0 or absent means no bench.
   * The starting five always ranks first, and the bench is the strongest
   * that still fits under the same cap.
   */
  benchSize?: number
  /**
   * Regular players forced onto the bench, like requiredPlayerIds is for the
   * starting five. Ignored when there is no bench; X Players are skipped.
   */
  preferredBenchPlayerIds?: string[]
}

export interface LineupSuccess {
  success: true
  slots: LineupSlot[]
  /** Regular players only; empty when no bench was asked for. */
  bench: Player[]
  /** Starters plus bench: everything that counts against the cap. */
  totalBaseSalary: number
  /** Starting five only. */
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
  closestBench: Player[]
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

/** A starting five exists, but not enough regular players are left to fill the bench. */
export interface LineupBenchTooSmall {
  success: false
  reason: 'bench_too_small'
  requestedBenchSize: number
  maxBenchSize: number
}

/** More players are preferred for the bench than it has spots. */
export interface LineupBenchPreferredOverflow {
  success: false
  reason: 'bench_preferred_overflow'
  preferredCount: number
  benchSize: number
}

export type LineupResult =
  | LineupSuccess
  | LineupMissingPosition
  | LineupCapTooLow
  | LineupNoValidXSlot
  | LineupRequiredPlayersConflict
  | LineupBenchTooSmall
  | LineupBenchPreferredOverflow
