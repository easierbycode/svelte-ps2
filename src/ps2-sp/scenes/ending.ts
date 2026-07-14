// Ending / congratulations scene: fades in CONGRATULATIONS!, reveals the
// final score / max combo / continue count, scrolls the credits, then
// returns to the title (on confirm after 600 steps, or automatically at
// 900) after resetting the game state for the next run.

import type { SceneHandlers } from '../../toolkit/index.ts'
import type { GameContext } from '../context.ts'
import { GCX, GH, SCENE_TITLE, SCREEN_H, SCREEN_W } from '../constants.ts'
import { resetGameState } from '../state.ts'

interface EndingState {
  timer: number
  scrollY: number
  phase: number
}

export function createEndingScene(ctx: GameContext): SceneHandlers {
  const es: EndingState = {
    timer: 0,
    scrollY: 0,
    phase: 0,
  }

  function init(): void {
    es.timer = 0
    es.scrollY = 0
    es.phase = 0
    ctx.sound.stopAllSounds()
    ctx.sound.playSound('voice_congra')
  }

  function update(): void {
    es.timer++
    es.scrollY += 0.5

    // After credits, return to title
    if (es.timer > 600 && ctx.input.isConfirmPressed()) {
      resetGameState(ctx.state)
      ctx.scenes.switch(SCENE_TITLE)
    }

    if (es.timer > 900) {
      resetGameState(ctx.state)
      ctx.scenes.switch(SCENE_TITLE)
    }
  }

  function draw(): void {
    const { Color, Draw } = ctx.rt
    const black = Color.new(0, 0, 0)
    const white = Color.new(255, 255, 255)
    const yellow = Color.new(255, 255, 0)

    Draw.rect(0, 0, SCREEN_W, SCREEN_H, black)

    // Congratulations
    const congAlpha = Math.min(es.timer / 60, 1.0)
    const ca = Math.floor(congAlpha * 128)
    const congColor = Color.new(255, 255, 0, ca)

    ctx.font.print(ctx.vp.toX(GCX - 60), ctx.vp.toY(40), 'CONGRATULATIONS!', congColor)

    // Score summary
    if (es.timer > 60) {
      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(100), 'FINAL SCORE', white)
      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(120), String(ctx.state.score), yellow)

      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(150), 'MAX COMBO', white)
      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(170), String(ctx.hud.maxCombo), yellow)

      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(200), 'CONTINUES', white)
      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(220), String(ctx.state.continueCnt), yellow)
    }

    // Credits scroll
    if (es.timer > 180) {
      const credY = 300 - es.scrollY + 90
      const credits = [
        'ORIGINAL GAME',
        'CAPCOM',
        '',
        'PS2 PORT',
        'AthenaEnv v4',
        '',
        'PROGRAMMING',
        'Claude Code',
        '',
        'SPECIAL THANKS',
        'Seamus McNamara',
        '',
        'THANK YOU',
        'FOR PLAYING!',
      ]

      for (let i = 0; i < credits.length; i++) {
        const cy = ctx.vp.toY(credY + i * 20)
        if (cy > 0 && cy < SCREEN_H) {
          ctx.font.print(ctx.vp.toX(GCX - 50), cy, credits[i], white)
        }
      }
    }

    // Press start to continue
    if (es.timer > 600) {
      if (ctx.scenes.timer % 40 < 30) {
        ctx.font.print(ctx.vp.toX(GCX - 50), ctx.vp.toY(GH - 40), 'PRESS START', white)
      }
    }
  }

  return { init, update, draw }
}
