// HUD (heads-up display): score, high score, HP bar, SP gauge with ready
// indicator, combo counter with 2-second decay timer, and boss timer.

import type { GameContext } from './context.ts'
import type { HudState } from './types.ts'
import { GCX, GH, GW } from './constants.ts'

export function createHudState(): HudState {
  return {
    scoreCount: 0,
    highScore: 0,
    comboCount: 0,
    maxCombo: 0,
    comboTimeCnt: 0,
    spgageCount: 0,
    spgageMax: 100,
    spFireFlg: 0,
    spBtnActive: 0,
    hpPercent: 1.0,
    bossTimerVisible: 0,
    bossTimerCount: 99,
  }
}

export function hudReset(hud: HudState): void {
  hud.scoreCount = 0
  hud.comboCount = 0
  hud.maxCombo = 0
  hud.comboTimeCnt = 0
  hud.spgageCount = 0
  hud.spFireFlg = 0
  hud.spBtnActive = 0
  hud.hpPercent = 1.0
  hud.bossTimerVisible = 0
  hud.bossTimerCount = 99
}

export function hudOnDamage(hud: HudState, percent: number): void {
  hud.hpPercent = percent
}

export function hudOnEnemyKill(hud: HudState, score: number, spgage: number): void {
  hud.comboCount++
  hud.scoreCount += score * hud.comboCount
  hud.spgageCount += spgage
  if (hud.spgageCount > hud.spgageMax) {
    hud.spgageCount = hud.spgageMax
  }
  hud.comboTimeCnt = 60 // 2 seconds at 30fps
  if (hud.comboCount > hud.maxCombo) {
    hud.maxCombo = hud.comboCount
  }
}

export function hudLoop(hud: HudState): void {
  // Combo timer
  if (hud.comboTimeCnt > 0) {
    hud.comboTimeCnt--
    if (hud.comboTimeCnt <= 0) {
      hud.comboCount = 0
    }
  }
}

export function hudDraw(ctx: GameContext): void {
  const hud = ctx.hud
  const white = ctx.rt.Color.new(255, 255, 255)
  const yellow = ctx.rt.Color.new(255, 255, 0)
  const red = ctx.rt.Color.new(255, 60, 60)
  const green = ctx.rt.Color.new(60, 255, 60)
  const cyan = ctx.rt.Color.new(60, 200, 255)
  const barBg = ctx.rt.Color.new(40, 40, 40)

  const lx = ctx.vp.toX(4)
  const topY = ctx.vp.toY(4)

  // Score
  ctx.font.print(lx, topY, 'SCORE', white)
  ctx.font.print(lx + 50, topY, String(hud.scoreCount), yellow)

  // High Score
  ctx.font.print(lx, topY + 14, 'HI', white)
  ctx.font.print(lx + 20, topY + 14, String(hud.highScore), white)

  // HP Bar
  const barX = ctx.vp.toX(4)
  const barY = ctx.vp.toY(GH - 18)
  const barW = ctx.vp.toW(GW - 8)
  const barH = ctx.vp.toH(6)
  ctx.rt.Draw.rect(barX, barY, barW, barH, barBg)

  const hpW = Math.floor(barW * hud.hpPercent)
  const hpColor = hud.hpPercent > 0.3 ? green : red
  if (hpW > 0) {
    ctx.rt.Draw.rect(barX, barY, hpW, barH, hpColor)
  }

  // SP Gauge
  const spY = ctx.vp.toY(GH - 10)
  const spW = ctx.vp.toW(GW - 8)
  const spH = ctx.vp.toH(4)
  ctx.rt.Draw.rect(barX, spY, spW, spH, barBg)

  const spFill = Math.floor(spW * (hud.spgageCount / hud.spgageMax))
  if (spFill > 0) {
    ctx.rt.Draw.rect(barX, spY, spFill, spH, cyan)
  }

  // SP ready indicator
  if (hud.spgageCount >= hud.spgageMax && hud.spBtnActive) {
    ctx.font.print(ctx.vp.toX(GCX - 20), ctx.vp.toY(GH - 28), 'SP READY!', cyan)
  }

  // Combo
  if (hud.comboCount > 1) {
    ctx.font.print(ctx.vp.toX(GCX - 20), ctx.vp.toY(50), String(hud.comboCount) + ' COMBO!', yellow)
  }

  // Boss timer
  if (hud.bossTimerVisible) {
    ctx.font.print(ctx.vp.toX(GCX - 10), ctx.vp.toY(58), 'TIME', white)
    ctx.font.print(ctx.vp.toX(GCX + 15), ctx.vp.toY(58), String(hud.bossTimerCount), yellow)
  }
}
