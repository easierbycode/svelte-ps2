// GameContext — the service bundle threaded through every scene and
// entity function in place of the original port's globals.

import type { PS2Runtime } from '../core/index.ts'
import type {
  AtlasManager,
  SceneManager,
  Scheduler,
  TweenManager,
  Viewport,
} from '../toolkit/index.ts'
import type { GameFont, GameInput, GameState, HudState, SoundPlayer } from './types.ts'

export interface GameContext {
  rt: PS2Runtime
  vp: Viewport
  atlas: AtlasManager
  tweens: TweenManager
  scheduler: Scheduler
  scenes: SceneManager
  state: GameState
  hud: HudState
  input: GameInput
  sound: SoundPlayer
  font: GameFont
}
