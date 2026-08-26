export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export interface Player {
  id: string
  name: string
  positions: Position[]
  isXPlayer: boolean
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

export type ObjectiveMode = 'power' | 'stats'

export interface LineupPreferences {
  requiredPlayerIds: string[]
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
