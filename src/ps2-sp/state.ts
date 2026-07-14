// Global game state: score and high-score bookkeeping, run-wide player
// and stage settings, plus best-effort high-score persistence to
// ps2sp_hiscore.txt through the runtime's std module.

import type { PS2Runtime } from '../core/index.ts'
import type { GameContext } from './context.ts'
import type { GameState } from './types.ts'

const HISCORE_FILE = 'ps2sp_hiscore.txt'

export function createGameState(): GameState {
  return {
    score: 0,
    highScore: 0,
    localHighScore: 0,
    stageId: 0,
    continueCnt: 0,
    akebonoCnt: 0,
    maxCombo: 0,
    spgage: 0,
    playerHp: 0,
    playerMaxHp: 0,
    spDamage: 0,
    shootMode: 'normal',
    shootSpeed: 'speed_normal',
    shortFlg: 0,
    secondLoop: 0,
    recipe: null,
    paused: 0,
    pauseCursor: 0,
    turboMode: 0,
  }
}

export function resetGameState(state: GameState): void {
  state.score = 0
  state.maxCombo = 0
  state.spgage = 0
  state.stageId = 0
  state.continueCnt = 0
  state.akebonoCnt = 0
  state.shortFlg = 0
  state.turboMode = 0
}

export function saveHighScore(ctx: GameContext): void {
  const state = ctx.state
  if (state.score > state.highScore) {
    state.highScore = state.score
  }
  if (state.highScore > state.localHighScore) {
    state.localHighScore = state.highScore
  }
  try {
    const file = ctx.rt.std.open(HISCORE_FILE, 'w')
    file.puts(String(state.localHighScore))
    file.close()
  } catch {
    // persistence is best-effort
  }
}

export function loadSavedHighScore(rt: PS2Runtime): number {
  try {
    const text = rt.std.loadFile(HISCORE_FILE)
    if (text === null) {
      return 0
    }
    const value = parseInt(text, 10)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}
