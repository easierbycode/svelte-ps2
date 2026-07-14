// Title scene — scrolling background, eased title/logo intro, high-score
// belt, and a flashing PRESS START prompt. SELECT arms turbo mode; START
// or CROSS fades into the adventure cutscene.

import type { SceneHandlers } from '../../toolkit/index.ts'
import type { GameContext } from '../context.ts'
import { GCX, GH, GW, SCENE_ADV, SCREEN_W, SCREEN_H } from '../constants.ts'

interface TitleState {
  introTimer: number
  introDone: number
  startBtnVisible: number
  bgScrollX: number
}

export function createTitleScene(ctx: GameContext): SceneHandlers {
  const ts: TitleState = {
    introTimer: 0,
    introDone: 0,
    startBtnVisible: 0,
    bgScrollX: 0,
  }

  function init(): void {
    ts.introTimer = 0
    ts.introDone = 0
    ts.startBtnVisible = 0
    ts.bgScrollX = 0
    ctx.state.turboMode = 0
    ctx.sound.stopAllSounds()
  }

  function update(): void {
    ts.bgScrollX += 0.5

    if (!ts.introDone) {
      ts.introTimer++
      if (ts.introTimer >= 120) {
        ts.introDone = 1
        ts.startBtnVisible = 1
        ctx.sound.playSound('voice_titlecall')
      }
    }

    if (ts.startBtnVisible) {
      if (ctx.input.isSelectPressed()) {
        ctx.state.turboMode = 1
        ctx.sound.playSound('se_decision')
        ctx.scenes.switch(SCENE_ADV)
      } else if (ctx.input.isConfirmPressed()) {
        ctx.sound.playSound('se_decision')
        ctx.scenes.switch(SCENE_ADV)
      }
    }
  }

  function draw(): void {
    const { rt, vp, atlas, font } = ctx
    const white = rt.Color.new(255, 255, 255)
    const yellow = rt.Color.new(255, 255, 0)
    const black = rt.Color.new(0, 0, 0)

    // Background
    if (atlas.hasFrame('game_ui', 'title_bg')) {
      // Tile the title background
      atlas.drawFrameTL('game_ui', 'title_bg', 0, 0, SCREEN_W / 256, SCREEN_H / 480, 1.0)
    } else {
      rt.Draw.rect(0, 0, SCREEN_W, SCREEN_H, rt.Color.new(20, 10, 40))
    }

    // Title character
    const introT = Math.min(ts.introTimer / 90, 1.0)
    const eased = 1 - Math.pow(1 - introT, 5)

    if (atlas.hasFrame('game_ui', atlas.resolveFrameName('game_ui', 'titleG.gif'))) {
      const gFrame = atlas.resolveFrameName('game_ui', 'titleG.gif')
      const gx = SCREEN_W * 0.7 - (SCREEN_W * 0.7 - SCREEN_W / 2) * eased
      atlas.drawFrame('game_ui', gFrame, Math.floor(gx), vp.toY(60), vp.scale, vp.scale, eased, null)
    }

    // Logo
    if (atlas.hasFrame('game_ui', atlas.resolveFrameName('game_ui', 'logo.gif'))) {
      const logoFrame = atlas.resolveFrameName('game_ui', 'logo.gif')
      const logoScale = 2 - eased
      atlas.drawFrame(
        'game_ui',
        logoFrame,
        vp.toX(GCX),
        vp.toY(75),
        vp.scale * logoScale,
        vp.scale * logoScale,
        eased,
        null,
      )
    }

    // Subtitle
    if (atlas.hasFrame('game_ui', atlas.resolveFrameName('game_ui', 'subTitle.gif'))) {
      const subFrame = atlas.resolveFrameName('game_ui', 'subTitle.gif')
      atlas.drawFrame('game_ui', subFrame, vp.toX(GCX), vp.toY(130), vp.scale, vp.scale, eased, null)
    }

    // Bottom belt
    rt.Draw.rect(vp.toX(0), vp.toY(GH - 120), vp.toW(GW), vp.toH(120), black)

    // High score
    font.print(vp.toX(32), vp.toY(GH - 100), 'HI-SCORE', white)
    font.print(vp.toX(110), vp.toY(GH - 100), String(ctx.state.highScore || 0), yellow)

    // Start button (flashing)
    if (ts.startBtnVisible) {
      if (ctx.scenes.timer % 40 < 30) {
        font.print(vp.toX(GCX - 45), vp.toY(GH - 60), 'PRESS START', white)
      }
      font.print(vp.toX(GCX - 55), vp.toY(GH - 42), 'SELECT = TURBO MODE', rt.Color.new(255, 100, 0))
    }

    // Copyright
    font.print(vp.toX(10), vp.toY(GH - 20), '(C)CAPCOM', rt.Color.new(128, 128, 128))
  }

  return { init, update, draw }
}
