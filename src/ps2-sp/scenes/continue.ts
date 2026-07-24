// Continue / game-over scene: a 9-to-0 countdown (one tick every 40 steps)
// over a YES/NO prompt. YES restores the player's stats from the recipe and
// re-enters the game with score reset to the continue count (the arcade
// penalty); NO — or letting the countdown expire — shows the game-over
// results screen, saves the high score, and waits for START to return to
// the title.

import type { SceneHandlers } from '../../toolkit/index.ts'
import type { GameContext } from '../context.ts'
import { GCX, GCY, GH, SCENE_GAME, SCENE_TITLE, SCREEN_H, SCREEN_W } from '../constants.ts'
import { saveHighScore } from '../state.ts'

interface ContinueState {
  countDown: number
  countDownTimer: number
  selection: number // -1 = none, 0 = yes, 1 = no
  cursorPos: number
  gameOverShown: number
  gameOverTimer: number
}

export function createContinueScene(ctx: GameContext): SceneHandlers {
  const cs: ContinueState = {
    countDown: 9,
    countDownTimer: 0,
    selection: -1,
    cursorPos: 0,
    gameOverShown: 0,
    gameOverTimer: 0,
  }

  function init(): void {
    cs.countDown = 9
    cs.countDownTimer = 0
    cs.selection = -1
    cs.cursorPos = 0
    cs.gameOverShown = 0
    cs.gameOverTimer = 0
    ctx.sound.stopAllSounds()
    ctx.sound.playBgm('bgm_continue')
  }

  function continueSelectYes(): void {
    cs.selection = 0

    const voiceIdx = Math.floor(Math.random() * 3)
    ctx.sound.playSound('g_continue_yes_voice' + String(voiceIdx))
    ctx.sound.stopBgm()

    // Reset player state and go to game
    const recipe = ctx.state.recipe
    const playerData = recipe ? recipe.playerData : null
    if (playerData) {
      ctx.state.playerMaxHp = playerData.maxHp ?? 0
      ctx.state.playerHp = ctx.state.playerMaxHp
      ctx.state.shootMode = playerData.defaultShootName || 'normal'
      ctx.state.shootSpeed = playerData.defaultShootSpeed || 'speed_normal'
    }
    ctx.state.continueCnt++
    ctx.state.score = ctx.state.continueCnt

    ctx.scenes.switch(SCENE_GAME)
  }

  function continueSelectNo(): void {
    cs.selection = 1
    cs.gameOverShown = 1
    cs.gameOverTimer = 0

    ctx.sound.playSound('voice_gameover')
    ctx.sound.playSound('bgm_gameover')

    // Save high score
    if (ctx.state.score > ctx.state.highScore) {
      ctx.state.highScore = ctx.state.score
    }
    saveHighScore(ctx)

    const voiceIdx = Math.floor(Math.random() * 2)
    ctx.sound.playSound('g_continue_no_voice' + String(voiceIdx))
  }

  function update(): void {
    if (cs.gameOverShown) {
      cs.gameOverTimer++
      // Wait for input to return to title
      if (cs.gameOverTimer > 90 && ctx.input.isConfirmPressed()) {
        ctx.scenes.switch(SCENE_TITLE)
      }
      return
    }

    // Countdown
    cs.countDownTimer++
    if (cs.countDownTimer % 40 === 0 && cs.countDown >= 0) {
      ctx.sound.playSound('voice_countdown' + String(cs.countDown))
      cs.countDown--
    }

    // Time's up — auto select No
    if (cs.countDown < 0 && cs.selection === -1) {
      continueSelectNo()
      return
    }

    // D-pad navigation (held, not pressed — original behavior)
    if (ctx.input.isLeftHeld() || ctx.input.isRightHeld()) {
      cs.cursorPos = cs.cursorPos === 0 ? 1 : 0
    }

    // Confirm selection
    if (ctx.input.isConfirmPressed()) {
      if (cs.cursorPos === 0) {
        continueSelectYes()
      } else {
        continueSelectNo()
      }
    }
  }

  function draw(): void {
    const { Color, Draw } = ctx.rt
    const black = Color.new(0, 0, 0)
    const white = Color.new(255, 255, 255)
    const yellow = Color.new(255, 255, 0)
    const red = Color.new(255, 60, 60)
    const gray = Color.new(128, 128, 128)

    Draw.rect(0, 0, SCREEN_W, SCREEN_H, black)

    if (cs.gameOverShown) {
      // Game Over screen
      ctx.font.print(ctx.vp.toX(GCX - 40), ctx.vp.toY(GCY - 60), 'GAME OVER', red)

      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(GCY), 'SCORE', white)
      ctx.font.print(ctx.vp.toX(100), ctx.vp.toY(GCY), String(ctx.state.score), yellow)

      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(GCY + 20), 'HI-SCORE', white)
      ctx.font.print(ctx.vp.toX(120), ctx.vp.toY(GCY + 20), String(ctx.state.highScore), yellow)

      ctx.font.print(ctx.vp.toX(40), ctx.vp.toY(GCY + 40), 'MAX COMBO', white)
      ctx.font.print(ctx.vp.toX(130), ctx.vp.toY(GCY + 40), String(ctx.hud.maxCombo), yellow)

      if (cs.gameOverTimer > 90) {
        if (ctx.scenes.timer % 40 < 30) {
          ctx.font.print(ctx.vp.toX(GCX - 50), ctx.vp.toY(GH - 60), 'PRESS START', white)
        }
      }
      return
    }

    // Continue screen
    // Title
    if (ctx.atlas.hasFrame('game_ui', ctx.atlas.resolveFrameName('game_ui', 'continueTitle.gif'))) {
      ctx.atlas.drawFrame('game_ui', ctx.atlas.resolveFrameName('game_ui', 'continueTitle.gif'),
        ctx.vp.toX(GCX), ctx.vp.toY(90), ctx.vp.scale, ctx.vp.scale, 1.0, null)
    } else {
      ctx.font.print(ctx.vp.toX(GCX - 40), ctx.vp.toY(70), 'CONTINUE?', white)
    }

    // Face
    if (ctx.atlas.hasFrame('game_ui', ctx.atlas.resolveFrameName('game_ui', 'continueFace0.gif'))) {
      const faceFrame = (ctx.scenes.timer % 20 < 10) ? 'continueFace0.gif' : 'continueFace1.gif'
      ctx.atlas.drawFrame('game_ui', ctx.atlas.resolveFrameName('game_ui', faceFrame),
        ctx.vp.toX(60), ctx.vp.toY(180), ctx.vp.scale, ctx.vp.scale, 1.0, null)
    }

    // Countdown
    const countStr = cs.countDown >= 0 ? String(cs.countDown) : '0'
    ctx.font.print(ctx.vp.toX(160), ctx.vp.toY(160), countStr,
      cs.countDown <= 3 ? red : yellow)

    // Yes / No buttons
    const yesColor = cs.cursorPos === 0 ? yellow : gray
    const noColor = cs.cursorPos === 1 ? yellow : gray

    ctx.font.print(ctx.vp.toX(GCX - 60), ctx.vp.toY(GCY + 50), 'YES', yesColor)
    ctx.font.print(ctx.vp.toX(GCX + 30), ctx.vp.toY(GCY + 50), 'NO', noColor)

    // Cursor indicator
    const cursorX = cs.cursorPos === 0 ? (GCX - 70) : (GCX + 20)
    ctx.font.print(ctx.vp.toX(cursorX), ctx.vp.toY(GCY + 50), '>', white)
  }

  return { init, update, draw }
}
