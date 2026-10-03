import type { Player } from './types'

/**
 * Which X Players a lineup holds so far. A lineup always fields one X
 * Player of either tier; during a Legend X event it may add one more, as
 * long as one of the two is a Legend X (two standard X Players never pair).
 */
export const X_NONE = 0
export const X_STANDARD = 1
export const X_LEGEND = 2
export const X_PAIR = 3
export const X_STATES = [X_NONE, X_STANDARD, X_LEGEND, X_PAIR]

/** The X states a finished lineup may end in. */
export function finalXStates(extraLegendX: boolean): number[] {
  return extraLegendX ? [X_STANDARD, X_LEGEND, X_PAIR] : [X_STANDARD, X_LEGEND]
}

/** The X state after adding `player`, or null if the lineup has no room for them. */
export function nextXState(state: number, player: Player, extraLegendX: boolean): number | null {
  if (!player.isXPlayer) return state
  const legend = player.xTier === 'legend'
  if (state === X_NONE) return legend ? X_LEGEND : X_STANDARD
  if (!extraLegendX || state === X_PAIR) return null
  if (state === X_STANDARD && !legend) return null
  return X_PAIR
}

/** Whether `players` can all be in one lineup without breaking the X Player limit. */
export function xPlayersFit(players: Player[], extraLegendX: boolean): boolean {
  let state: number | null = X_NONE
  for (const player of players) {
    state = nextXState(state, player, extraLegendX)
    if (state === null) return false
  }
  return true
}
