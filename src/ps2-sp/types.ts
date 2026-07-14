// Shared game types: recipe data (game.json + Firebase level exports),
// global game state, HUD state, and the input/font/sound service
// interfaces the scene and entity modules consume through GameContext.

import type { PS2ColorValue } from '../core/index.ts'

// --- Recipe (game.json) ---

export interface ShootData {
  texture?: string[]
  interval?: number
  damage?: number
  hp?: number
}

export interface ProjectileSpec {
  texture?: string[]
  speed?: number
  damage?: number
  hp?: number
  name?: string
  interval?: number
  atlas?: string
}

export interface PlayerData {
  name?: string
  texture?: string[]
  hp?: number
  maxHp?: number
  spDamage?: number
  defaultShootName?: string
  defaultShootSpeed?: string
  shootNormal?: ShootData
  shootBig?: ShootData
  shoot3way?: ShootData
  barrier?: { texture?: string[] }
}

export interface EnemyData {
  name?: string
  atlas?: string
  texture?: string[]
  hp?: number | 'infinity'
  speed?: number
  score?: number
  spgage?: number
  interval?: number
  projectileData?: ProjectileSpec | null
  bulletData?: ProjectileSpec | null
  itemName?: string | null
  itemTexture?: string[] | null
  shadowReverse?: number
  shadowOffsetY?: number
}

export interface BossData {
  name?: string
  texture?: string[]
  attackTexture?: string[]
  anim?: { idle?: string[]; attack?: string[] }
  atlas?: string
  hp?: number
  score?: number
  spgage?: number
  speed?: number
  projectileData?: ProjectileSpec | null
  projectileDataA?: ProjectileSpec | null
  projectileDataB?: ProjectileSpec | null
  projectileDataC?: ProjectileSpec | null
  bulletData?: ProjectileSpec | null
  gokiFlg?: number
}

export interface StageData {
  enemylist: string[][]
}

export interface Recipe {
  playerData?: PlayerData
  enemyData?: Record<string, EnemyData>
  bossData?: Record<string, BossData>
  stage0?: StageData
  stage1?: StageData
  stage2?: StageData
  stage3?: StageData
  stage4?: StageData
  [stageKey: string]: unknown
}

/** A pre-exported Firebase level (JSON of levels/{name}) merged over the base recipe. */
export interface FirebaseLevelSource {
  dataPath: string
  atlasPngPath: string
  atlasJsonPath: string
}

// --- Global game state ---

export interface GameState {
  score: number
  highScore: number
  localHighScore: number
  stageId: number
  continueCnt: number
  akebonoCnt: number
  maxCombo: number
  spgage: number
  playerHp: number
  playerMaxHp: number
  spDamage: number
  shootMode: string
  shootSpeed: string
  shortFlg: number
  secondLoop: number
  recipe: Recipe | null
  paused: number
  pauseCursor: number
  turboMode: number
}

// --- HUD state ---

export interface HudState {
  scoreCount: number
  highScore: number
  comboCount: number
  maxCombo: number
  comboTimeCnt: number
  spgageCount: number
  spgageMax: number
  spFireFlg: number
  spBtnActive: number
  hpPercent: number
  bossTimerVisible: number
  bossTimerCount: number
}

// --- Services ---

/**
 * DualShock bindings over the runtime pad. update() runs once per fixed
 * step; isPressed edges are step-accurate (held now, not held last step).
 */
export interface GameInput {
  update(): void
  isDown(mask: number): boolean
  isPressed(mask: number): boolean
  getAnalogX(): number
  getAnalogY(): number
  isLeftHeld(): boolean
  isRightHeld(): boolean
  isUpHeld(): boolean
  isDownHeld(): boolean
  isUpPressed(): boolean
  isDownPressed(): boolean
  isFirePressed(): boolean
  isSpPressed(): boolean
  isStartPressed(): boolean
  isSelectPressed(): boolean
  isConfirmPressed(): boolean
  isBackPressed(): boolean
  isYesPressed(): boolean
  isNoPressed(): boolean
  isTurboToggle(): boolean
}

/** The shared game font. print() takes screen coordinates, printGame() game coordinates. */
export interface GameFont {
  print(x: number, y: number, text: string, color?: PS2ColorValue): void
  printGame(gx: number, gy: number, text: string, color?: PS2ColorValue): void
}

/**
 * Audio backend. The default is a silent stub (the PS2 port never shipped
 * sound); hosts can inject a real player via GameOptions.sound.
 */
export interface SoundPlayer {
  init(): void
  loadSfx(key: string, path: string): void
  loadStream(key: string, path: string): void
  playSfx(key: string, volume?: number): void
  playSound(key: string, volume?: number): void
  playBgm(key: string, volume?: number): void
  stopBgm(): void
  stopAllSounds(): void
}

// --- createGame options ---

export interface GameOptions {
  sound?: SoundPlayer
  /** Firebase level to merge over the base recipe; null skips the merge. Defaults to level_foo. */
  level?: FirebaseLevelSource | null
  /** Scene to boot into (testing hook). Defaults to the title scene. */
  startScene?: string
}

export interface ResolvedGameOptions {
  sound: SoundPlayer
  level: FirebaseLevelSource | null
  startScene: string
}
