// The 2019-es7 PS2 shooter ported onto the 5velte-ps2 runtime: pass any
// PS2Runtime (browser Phaser host or the native AthenaEnv adapter) to
// createGame and drive it with runtime.tick().

export { createGame } from './game.ts'
export type { GameHandle } from './game.ts'
export { createNullSound } from './sound.ts'
export {
  GW,
  GH,
  GCX,
  GCY,
  SCREEN_W,
  SCREEN_H,
  FPS,
  FRAME_MS,
  BOSS_NAMES,
  ITEM_CODES,
  SCENE_TITLE,
  SCENE_ADV,
  SCENE_GAME,
  SCENE_CONTINUE,
  SCENE_ENDING,
} from './constants.ts'
export type { GameContext } from './context.ts'
export type {
  GameOptions,
  GameState,
  HudState,
  GameInput,
  GameFont,
  SoundPlayer,
  Recipe,
  StageData,
  PlayerData,
  EnemyData,
  BossData,
  ShootData,
  ProjectileSpec,
  FirebaseLevelSource,
  ResolvedGameOptions,
} from './types.ts'
