// Adventure scene — the pre-stage cutscene: a black screen that fades
// "STAGE N / GET READY!" text in and out over ~8 seconds, then drops
// into gameplay. Confirm skips ahead once the text has begun showing.

import type { SceneHandlers } from '../../toolkit/index.ts'
import type { GameContext } from '../context.ts'
import { GCX, GCY, SCENE_GAME, SCREEN_W, SCREEN_H } from '../constants.ts'

interface AdvState {
  timer: number
  phase: number
  textAlpha: number
}

export function createAdvScene(ctx: GameContext): SceneHandlers {
  const as: AdvState = {
    timer: 0,
    phase: 0,
    textAlpha: 0,
  }

  function init(): void {
    as.timer = 0
    as.phase = 0
    as.textAlpha = 0
    ctx.sound.playBgm('adventure_bgm')
    ctx.sound.playSound('g_adbenture_voice0')
  }

  function update(): void {
    as.timer++

    if (as.timer < 60) {
      as.textAlpha = as.timer / 60
    } else if (as.timer < 180) {
      as.textAlpha = 1.0
    } else if (as.timer < 240) {
      as.textAlpha = 1.0 - (as.timer - 180) / 60
    } else {
      // Transition to game
      ctx.sound.stopBgm()
      ctx.scenes.switch(SCENE_GAME)
    }

    if (ctx.input.isConfirmPressed() && as.timer > 30) {
      ctx.sound.stopBgm()
      ctx.scenes.switch(SCENE_GAME)
    }
  }

  function draw(): void {
    const { rt, vp, font } = ctx
    const black = rt.Color.new(0, 0, 0)

    rt.Draw.rect(0, 0, SCREEN_W, SCREEN_H, black)

    const a = Math.floor(as.textAlpha * 128)
    const textColor = rt.Color.new(255, 255, 255, a)

    font.print(vp.toX(GCX - 60), vp.toY(GCY - 20), 'STAGE ' + String(ctx.state.stageId + 1), textColor)

    font.print(vp.toX(GCX - 50), vp.toY(GCY + 10), 'GET READY!', textColor)
  }

  return { init, update, draw }
}
