// Enemy entity: wave-spawned foes with per-type movement (soliderA homes
// on the player, soliderB hugs the screen edges), interval-based shoot
// signalling back to the game scene, a mirrored drop shadow, damage tint
// flash, and a 7-frame explosion death.

import type { GameContext } from './context.ts'
import type { EnemyData, ProjectileSpec } from './types.ts'
import { GH, GW } from './constants.ts'

export interface Enemy {
  name: string
  atlas: string
  frames: string[]
  animFrame: number
  animSpeed: number
  animCounter: number
  x: number
  y: number
  width: number
  height: number
  hitX: number
  hitY: number
  hitW: number
  hitH: number
  hp: number | 'infinity'
  speed: number
  score: number
  spgage: number
  interval: number
  projectileData: ProjectileSpec | null
  itemName: string | null
  itemTexture: string[] | null
  dead: number
  deadFlg: number
  shootFlg: number
  hardleFlg: number
  bulletFrameCnt: number
  posName: string
  // Shadow
  shadowReverse: number
  shadowOffsetY: number
  shadowVisible: number
  // Explosion
  explosionPlaying: number
  explosionFrame: number
  explosionTimer: number
  // Visual
  visible: number
  alpha: number
  tintFlash: number
  tintTimer: number
  // Big bullet tracking per enemy
  bulletTracking: Record<string, unknown>
}

export function createEnemy(ctx: GameContext, data: EnemyData): Enemy {
  const e: Enemy = {
    name: data.name || '',
    atlas: data.atlas || 'game_asset',
    frames: data.texture || [],
    animFrame: 0,
    animSpeed: 0.15,
    animCounter: 0,
    x: 0,
    y: -32,
    width: 32,
    height: 32,
    hitX: 0,
    hitY: 0,
    hitW: 32,
    hitH: 32,
    hp: data.hp || 1,
    speed: data.speed || 1,
    score: data.score || 0,
    spgage: data.spgage || 0,
    interval: data.interval || 0,
    projectileData: data.projectileData || null,
    itemName: data.itemName || null,
    itemTexture: data.itemTexture || null,
    dead: 0,
    deadFlg: 0,
    shootFlg: 1,
    hardleFlg: 0,
    bulletFrameCnt: 0,
    posName: '',
    // Shadow
    shadowReverse: data.shadowReverse !== undefined ? data.shadowReverse : 1,
    shadowOffsetY: data.shadowOffsetY || 0,
    shadowVisible: 1,
    // Explosion
    explosionPlaying: 0,
    explosionFrame: 0,
    explosionTimer: 0,
    // Visual
    visible: 1,
    alpha: 1.0,
    tintFlash: 0,
    tintTimer: 0,
    // Big bullet tracking per enemy
    bulletTracking: {},
  }

  if (e.interval <= -1) e.hardleFlg = 1

  // Adjust hit area per enemy type
  switch (data.name) {
    case 'baraA':
    case 'baraB':
      e.shadowVisible = 0
      break
    case 'drum':
      e.hitX = 7
      e.hitY = 2
      e.hitW = e.width - 14
      e.hitH = e.height - 2
      break
    case 'launchpad':
      e.hitX = 8
      e.hitY = 0
      e.hitW = e.width - 16
      e.hitH = e.height
      break
  }

  // Set dimensions from first frame if possible
  if (e.frames.length > 0) {
    const size = ctx.atlas.getFrameSize(e.atlas, ctx.atlas.resolveFrameName(e.atlas, e.frames[0]))
    if (size.w > 0) {
      e.width = size.w
      e.height = size.h
      if (e.hitW === 32) {
        e.hitW = size.w
        e.hitH = size.h
      }
    }
  }

  return e
}

export function enemyLoop(
  ctx: GameContext,
  e: Enemy,
  player: { x: number } | null,
): 0 | 1 | 'shoot' {
  if (e.explosionPlaying) enemyExplosionUpdate(e)

  if (e.dead) return 0 // signal to remove

  e.bulletFrameCnt++

  // Animate
  if (e.frames.length > 1) {
    e.animCounter += e.animSpeed
    if (e.animCounter >= e.frames.length) e.animCounter -= e.frames.length
    e.animFrame = Math.floor(e.animCounter) % e.frames.length
  }

  // Movement
  const eMul = ctx.state.turboMode ? 2 : 1
  e.y += e.speed * eMul

  switch (e.name) {
    case 'soliderA':
      if (e.y >= GH / 1.5 && player) {
        e.x += 0.005 * eMul * (player.x - e.x)
      }
      break
    case 'soliderB':
      if (e.y <= 10) {
        if (e.x >= GW / 2) {
          e.x = GW
          e.posName = 'right'
        } else {
          e.x = -e.width
          e.posName = 'left'
        }
      }
      if (e.y >= GH / 3) {
        if (e.posName === 'right') e.x -= 1 * eMul
        else if (e.posName === 'left') e.x += 1 * eMul
      }
      break
  }

  // Tint flash decay
  if (e.tintFlash > 0) {
    e.tintTimer++
    if (e.tintTimer > 6) {
      e.tintFlash = 0
      e.tintTimer = 0
    }
  }

  // Shooting
  let shouldShoot = 0
  const eInterval = ctx.state.turboMode ? Math.max(1, Math.floor(e.interval / 2)) : e.interval
  if (e.shootFlg && !e.hardleFlg && eInterval > 0 && e.bulletFrameCnt % eInterval === 0) {
    shouldShoot = 1
  }

  // Off-screen check
  if (e.x <= -50 || e.x >= GW + 33 || e.y <= -33 || e.y >= GH) {
    return 0 // remove
  }

  return shouldShoot ? 'shoot' : 1
}

export function enemyOnDamage(ctx: GameContext, e: Enemy, damage: number): void {
  if (e.hp === 'infinity') {
    e.tintFlash = 1
    e.tintTimer = 0
    return
  }
  if (e.deadFlg) return

  e.hp -= damage
  if (e.hp <= 0) {
    enemyDead(ctx, e)
  } else {
    e.tintFlash = 1
    e.tintTimer = 0
  }
}

export function enemyDead(ctx: GameContext, e: Enemy): void {
  if (e.hp === 'infinity') return
  e.deadFlg = 1
  e.shootFlg = 0
  e.explosionPlaying = 1
  e.explosionFrame = 0
  e.explosionTimer = 0
  ctx.sound.playSfx('se_explosion')
}

// Advances the explosion animation once per fixed step; when it finishes
// the enemy is flagged dead so the game scene culls it.
export function enemyExplosionUpdate(e: Enemy): void {
  if (!e.explosionPlaying) return
  e.explosionTimer++
  if (e.explosionTimer % 3 === 0) e.explosionFrame++
  if (e.explosionFrame > 6) {
    e.explosionPlaying = 0
    e.dead = 1
  }
}

export function enemyDraw(ctx: GameContext, e: Enemy): void {
  if (!e.visible || e.alpha <= 0) return
  const ea = e.atlas || 'game_asset'

  if (e.explosionPlaying) {
    // Explosions are always in the level atlas if available, else game_asset
    const expFrame = 'explosion0' + String(Math.min(e.explosionFrame, 6)) + '.gif'
    const expAtlas = ctx.atlas.hasFrame(ea, ctx.atlas.resolveFrameName(ea, expFrame))
      ? ea
      : 'game_asset'
    ctx.atlas.drawFrame(
      expAtlas,
      ctx.atlas.resolveFrameName(expAtlas, expFrame),
      ctx.vp.toX(e.x + e.width / 2),
      ctx.vp.toY(e.y + e.height / 2),
      ctx.vp.scale,
      ctx.vp.scale,
      1.0,
      null,
    )
    return
  }

  if (e.deadFlg) return

  // Draw shadow
  if (e.shadowVisible && e.frames.length > 0) {
    const frame = ctx.atlas.resolveFrameName(ea, e.frames[e.animFrame])
    // dark-grey shadow: 30 on the original GS 128-neutral basis -> 60 here (255-neutral)
    const shadowColor = ctx.rt.Color.new(60, 60, 60, 60)
    const shadowY = e.shadowReverse
      ? (e.y + e.height / 2 - e.shadowOffsetY)
      : (e.y + e.height / 2 + e.shadowOffsetY)
    ctx.atlas.drawFrame(
      ea,
      frame,
      ctx.vp.toX(e.x + e.width / 2),
      ctx.vp.toY(shadowY),
      ctx.vp.scale,
      e.shadowReverse ? -ctx.vp.scale : ctx.vp.scale,
      0.3,
      shadowColor,
    )
  }

  // Draw enemy
  if (e.frames.length > 0) {
    const frame = ctx.atlas.resolveFrameName(ea, e.frames[e.animFrame])
    let tint: number | null = null
    if (e.tintFlash) {
      tint = ctx.rt.Color.new(255, 80, 80, 128)
    }
    ctx.atlas.drawFrame(
      ea,
      frame,
      ctx.vp.toX(e.x + e.width / 2),
      ctx.vp.toY(e.y + e.height / 2),
      ctx.vp.scale,
      ctx.vp.scale,
      e.alpha,
      tint,
    )
  }
}
