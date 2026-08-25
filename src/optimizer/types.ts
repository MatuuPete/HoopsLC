export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export interface Player {
  id: string
  name: string
  position: Position
  isXPlayer: boolean
  baseSalary: number
  currentSalary: number
  offense: number
  defense: number
}

export interface LineupSlot {
  position: Position
  player: Player
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
}

export type LineupResult = LineupSuccess | LineupMissingPosition | LineupCapTooLow
