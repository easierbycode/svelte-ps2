// Game constants — the original 256x480 playfield rendered inside the
// PS2's 640x448 mode, updated at a fixed 30 steps per second.

export const GW = 256
export const GH = 480
export const GCX = 128
export const GCY = 240

export const SCREEN_W = 640
export const SCREEN_H = 448

export const FPS = 30
export const FRAME_MS: number = 1000 / FPS

export const PLAYER_MOVE_SPEED = 6
export const PLAYER_SMOOTHING = 0.09

export const SCENE_TITLE = 'title'
export const SCENE_ADV = 'adventure'
export const SCENE_GAME = 'game'
export const SCENE_CONTINUE = 'continue'
export const SCENE_ENDING = 'ending'

// Boss BGM names (index = stageId)
export const BOSS_NAMES: string[] = ['bison', 'barlog', 'sagat', 'vega', 'fang']

// Item codes from enemy wave data
export const ITEM_CODES: Record<string, string> = {
  '1': 'big',
  '2': '3way',
  '3': 'speed_high',
  '9': 'barrier',
}
