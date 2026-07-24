// Enemy/boss projectile entity: straight-line bullets plus the meka
// homing pattern (drifts toward the player's x captured once after a
// startup delay, with a cosine wobble on y).

import type { GameContext } from './context.ts'
import { GH, GW } from './constants.ts'

export interface Projectile {
  x: number
  y: number
  rotX: number
  rotY: number
  speed: number
  damage: number
  hp: number
  name: string
  atlas: string
  frames: string[]
  animFrame: number
  animCounter: number
  width: number
  height: number
  dead: number
  deadFlg: number
  // For meka-type homing
  cont: number
  start: number
  targetX: number | null
}

export interface ProjectileInit {
  x?: number
  y?: number
  rotX?: number
  rotY?: number
  speed?: number
  damage?: number
  hp?: number
  name?: string
  atlas?: string
  frames?: string[]
  width?: number
  height?: number
  start?: number
}

export function createProjectile(data: ProjectileInit): Projectile {
  return {
    x: data.x || 0,
    y: data.y || 0,
    rotX: data.rotX || 0,
    rotY: data.rotY || 1,
    speed: data.speed || 2,
    damage: data.damage || 1,
    hp: data.hp || 1,
    name: data.name || 'bullet',
    atlas: data.atlas || 'game_asset',
    frames: data.frames || [],
    animFrame: 0,
    animCounter: 0,
    width: data.width || 8,
    height: data.height || 8,
    dead: 0,
    deadFlg: 0,
    // For meka-type homing
    cont: 0,
    start: data.start || 0,
    targetX: null,
  }
}

export function projectileLoop(
  ctx: GameContext,
  proj: Projectile,
  player: { x: number } | null,
): boolean {
  if (proj.deadFlg) return false

  const pMul = ctx.state.turboMode ? 2 : 1
  if (proj.rotX !== 0 || proj.name !== 'meka') {
    proj.x += proj.rotX * proj.speed * pMul
    proj.y += proj.rotY * proj.speed * pMul
  } else if (proj.name === 'meka') {
    proj.cont++
    if (proj.cont >= proj.start) {
      if (!proj.targetX && player) {
        proj.targetX = player.x
      }
      if (proj.targetX) {
        proj.x += 0.009 * pMul * (proj.targetX - proj.x)
      }
      proj.y += (Math.cos(proj.cont / 5) + 2.5 * proj.speed) * pMul
    }
  }

  // Animate
  if (proj.frames && proj.frames.length > 1) {
    proj.animCounter += 0.15
    if (proj.animCounter >= proj.frames.length) proj.animCounter -= proj.frames.length
    proj.animFrame = Math.floor(proj.animCounter) % proj.frames.length
  }

  // Off-screen removal
  if (proj.x < -30 || proj.x > GW + 30 || proj.y < -30 || proj.y > GH + 30) {
    return false
  }

  return true
}

export function projectileOnDamage(proj: Projectile, damage: number): void {
  if (proj.deadFlg) return
  proj.hp -= damage
  if (proj.hp <= 0) {
    proj.deadFlg = 1
    proj.dead = 1
  }
}

export function projectileDraw(ctx: GameContext, proj: Projectile): void {
  if (proj.deadFlg || proj.dead) return
  const pa = proj.atlas || 'game_asset'

  let frame: string | null = null
  if (proj.frames && proj.frames.length > 0) {
    frame = ctx.atlas.resolveFrameName(pa, proj.frames[proj.animFrame])
  }

  if (frame) {
    ctx.atlas.drawFrame(
      pa,
      frame,
      ctx.vp.toX(proj.x),
      ctx.vp.toY(proj.y),
      ctx.vp.scale,
      ctx.vp.scale,
      1.0,
      null,
    )
  } else {
    // Fallback: draw a small colored rectangle
    const color = ctx.rt.Color.new(255, 100, 100)
    ctx.rt.Draw.rect(
      ctx.vp.toX(proj.x - 3),
      ctx.vp.toY(proj.y - 3),
      ctx.vp.toW(6),
      ctx.vp.toH(6),
      color,
    )
  }
}
