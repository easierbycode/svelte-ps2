// createGame — assembles the services, registers the scenes, loads assets,
// and registers the per-frame callback on the runtime. Game logic advances
// at a fixed 30 steps per second (the cadence the original was tuned for)
// while drawing runs every host frame; the host drives both via
// runtime.tick().

import type { PS2Runtime } from '../core/index.ts'
import {
  AtlasManager,
  FixedStep,
  SceneManager,
  Scheduler,
  TweenManager,
  Viewport,
} from '../toolkit/index.ts'
import {
  FPS,
  FRAME_MS,
  GH,
  GW,
  SCENE_ADV,
  SCENE_CONTINUE,
  SCENE_ENDING,
  SCENE_GAME,
  SCENE_TITLE,
  SCREEN_H,
  SCREEN_W,
} from './constants.ts'
import type { GameContext } from './context.ts'
import type { FirebaseLevelSource, GameOptions, ResolvedGameOptions } from './types.ts'
import { createGameState, loadSavedHighScore } from './state.ts'
import { createNullSound } from './sound.ts'
import { createInput } from './input.ts'
import { createGameFont } from './font.ts'
import { createHudState } from './hud.ts'
import { loadAllAssets } from './assets.ts'
import { createTitleScene } from './scenes/title.ts'
import { createAdvScene } from './scenes/adv.ts'
import { createGameScene } from './scenes/game.ts'
import { createContinueScene } from './scenes/continue.ts'
import { createEndingScene } from './scenes/ending.ts'

export interface GameHandle {
  ctx: GameContext
}

const DEFAULT_LEVEL: FirebaseLevelSource = {
  dataPath: 'assets/level_foo.json',
  atlasPngPath: 'assets/level_foo_atlas.png',
  atlasJsonPath: 'assets/level_foo_atlas.json',
}

export function createGame(rt: PS2Runtime, options: GameOptions = {}): GameHandle {
  const resolved: ResolvedGameOptions = {
    sound: options.sound ?? createNullSound(),
    level: options.level === undefined ? DEFAULT_LEVEL : options.level,
    startScene: options.startScene ?? SCENE_TITLE,
  }

  const vp = new Viewport({
    gameWidth: GW,
    gameHeight: GH,
    screenWidth: SCREEN_W,
    screenHeight: SCREEN_H,
  })
  const tweens = new TweenManager()
  const scheduler = new Scheduler()
  const atlas = new AtlasManager(rt)
  const scenes = new SceneManager({
    rt,
    screenWidth: SCREEN_W,
    screenHeight: SCREEN_H,
    beforeInit: () => {
      tweens.killAll()
      scheduler.clear()
    },
  })

  const ctx: GameContext = {
    rt,
    vp,
    atlas,
    tweens,
    scheduler,
    scenes,
    state: createGameState(),
    hud: createHudState(),
    input: createInput(rt),
    sound: resolved.sound,
    font: createGameFont(rt, vp),
  }

  ctx.state.highScore = loadSavedHighScore(rt)
  ctx.state.localHighScore = ctx.state.highScore

  ctx.sound.init()
  loadAllAssets(ctx, resolved)

  scenes.register(SCENE_TITLE, createTitleScene(ctx))
  scenes.register(SCENE_ADV, createAdvScene(ctx))
  scenes.register(SCENE_GAME, createGameScene(ctx))
  scenes.register(SCENE_CONTINUE, createContinueScene(ctx))
  scenes.register(SCENE_ENDING, createEndingScene(ctx))

  scenes.switchImmediate(resolved.startScene)

  const clock = rt.Timer.new()
  const step = new FixedStep({ fps: FPS, now: () => rt.Timer.getTime(clock) / 1000 })

  // original loop order: input, timers, tweens, scene transition + update
  rt.Screen.display(() => {
    step.tick(() => {
      ctx.input.update()
      ctx.scheduler.update(FRAME_MS)
      ctx.tweens.update(FRAME_MS)
      ctx.scenes.update()
    })
    ctx.scenes.draw()
    vp.drawLetterbox(rt)
  })

  return { ctx }
}
