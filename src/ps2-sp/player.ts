// Player entity: smooth-follow movement toward a target point, three shot
// modes (normal/big/3way) with turbo fire, a timed barrier, damage flash,
// and death explosion. Update logic runs per fixed step; playerDraw is
// pure (animation state advances in playerLoop / playerExplosionUpdate).

import { GW, PLAYER_SMOOTHING } from './constants.ts'
import type { GameContext } from './context.ts'
import type { PlayerData, ShootData } from './types.ts'

export interface PlayerBullet {
  id: number
  x: number
  y: number
  rotation: number
  width: number
  height: number
  damage: number
  hp: number
  name: string
  dead: number
}

export interface Player {
  // Position (unit coords — top-left of sprite)
  x: number
  y: number
  // Target position for smooth movement
  targetX: number
  targetY: number
  // Sprite frames — cyber-liberty spritesheet (32x32, 2-frame idle)
  atlas: string
  frames: string[]
  animFrame: number
  animSpeed: number
  animCounter: number
  // Stats
  hp: number
  maxHp: number
  percent: number
  // Shoot
  shootOn: number
  shootMode: string
  shootSpeed: number
  shootInterval: number
  bulletFrameCnt: number
  bulletIdCnt: number
  bullets: PlayerBullet[]
  // Shoot data
  shootNormalData: ShootData
  shootBigData: ShootData
  shoot3wayData: ShootData
  // Barrier
  barrierFlg: number
  barrierAlpha: number
  barrierTimer: number
  barrierMaxTime: number
  barrierFrames: string[]
  barrierAnimFrame: number
  // Visual
  alpha: number
  visible: number
  damageAnimFlg: number
  damageAnimTimer: number
  tintFlash: number
  // Dimensions (cyber-liberty: 32x32)
  width: number
  height: number
  hitX: number
  hitY: number
  hitW: number
  hitH: number
  // Shadow
  shadowOffsetY: number
  // State
  dead: number
  explosionPlaying: number
  explosionFrame: number
  explosionTimer: number
  // Name
  name: string
}

export function createPlayer(data: PlayerData): Player {
  const p: Player = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    atlas: 'cyber-liberty',
    frames: ['0', '1'],
    animFrame: 0,
    animSpeed: 0.15, // slower cycle matching the source game: 250ms + 100ms
    animCounter: 0,
    hp: data.hp || 100,
    maxHp: data.maxHp || 100,
    percent: 1.0,
    shootOn: 0,
    shootMode: 'normal',
    shootSpeed: 0,
    shootInterval: 20,
    bulletFrameCnt: 0,
    bulletIdCnt: 0,
    bullets: [],
    shootNormalData: data.shootNormal || {},
    shootBigData: data.shootBig || {},
    shoot3wayData: data.shoot3way || {},
    barrierFlg: 0,
    barrierAlpha: 0,
    barrierTimer: 0,
    barrierMaxTime: 600, // ~10 seconds at 60fps (scaled to 30fps = 300 frames)
    barrierFrames: (data.barrier && data.barrier.texture) ? data.barrier.texture : [],
    barrierAnimFrame: 0,
    alpha: 1.0,
    visible: 1,
    damageAnimFlg: 0,
    damageAnimTimer: 0,
    tintFlash: 0,
    width: 32,
    height: 32,
    hitX: 9,
    hitY: 12,
    hitW: 14,
    hitH: 8,
    shadowOffsetY: 5,
    dead: 0,
    explosionPlaying: 0,
    explosionFrame: 0,
    explosionTimer: 0,
    name: data.name || '',
  }

  // Set initial shoot data
  if (p.shootNormalData.interval) {
    p.shootInterval = p.shootNormalData.interval
  }

  return p
}

export function playerSetUp(p: Player, hp: number, shootMode: string, shootSpeed: string): void {
  p.hp = hp
  p.percent = p.hp / p.maxHp
  p.shootMode = shootMode
  p.dead = 0
  p.explosionPlaying = 0
  p.visible = 1
  p.alpha = 1.0
  p.damageAnimFlg = 0

  switch (shootMode) {
    case 'normal':
      p.shootInterval = p.shootNormalData.interval || 20
      break
    case 'big':
      p.shootInterval = p.shootBigData.interval || 20
      break
    case '3way':
      p.shootInterval = p.shoot3wayData.interval || 20
      break
  }

  switch (shootSpeed) {
    case 'speed_high':
      p.shootSpeed = 15
      break
    default:
      p.shootSpeed = 0
      break
  }
}

export function playerLoop(ctx: GameContext, p: Player): void {
  if (p.dead) return

  // Smooth movement
  p.x += PLAYER_SMOOTHING * (p.targetX - (p.x + p.width / 2))
  p.y += PLAYER_SMOOTHING * (p.targetY - p.y)

  // Animate
  p.animCounter += p.animSpeed
  if (p.animCounter >= p.frames.length) {
    p.animCounter -= p.frames.length
  }
  p.animFrame = Math.floor(p.animCounter) % p.frames.length

  // Shooting
  p.bulletFrameCnt++
  let interval = p.shootInterval - p.shootSpeed
  if (ctx.state.turboMode) interval = Math.floor(interval / 2)
  if (interval < 1) interval = 1

  if (p.shootOn && p.bulletFrameCnt % interval === 0) {
    playerShoot(ctx, p)
  }

  // Update bullets
  const bulletMul = ctx.state.turboMode ? 2 : 1
  for (let i = p.bullets.length - 1; i >= 0; i--) {
    const b = p.bullets[i]
    b.x += 3.5 * bulletMul * Math.cos(b.rotation)
    b.y += 3.5 * bulletMul * Math.sin(b.rotation)

    if (b.y <= 40 || b.x <= -b.width || b.x >= GW) {
      p.bullets.splice(i, 1)
    }
  }

  // Damage animation
  if (p.damageAnimFlg) {
    p.damageAnimTimer++
    if (p.damageAnimTimer % 4 < 2) {
      p.tintFlash = 1
      p.alpha = 0.5
    } else {
      p.tintFlash = 0
      p.alpha = 1.0
    }
    if (p.damageAnimTimer > 30) {
      p.damageAnimFlg = 0
      p.damageAnimTimer = 0
      p.tintFlash = 0
      p.alpha = 1.0
    }
  }

  // Barrier countdown
  if (p.barrierFlg) {
    p.barrierTimer++
    // Flashing near end
    if (p.barrierTimer > p.barrierMaxTime * 0.7) {
      p.barrierAlpha = (p.barrierTimer % 6 < 3) ? 1.0 : 0.3
    } else {
      p.barrierAlpha = 1.0
    }
    if (p.barrierTimer >= p.barrierMaxTime) {
      p.barrierFlg = 0
      p.barrierAlpha = 0
      p.barrierTimer = 0
      ctx.sound.playSfx('se_barrier_end')
    }
    // Advance barrier animation (draw stays pure)
    if (p.barrierFlg && p.barrierFrames.length > 0) {
      p.barrierAnimFrame = (p.barrierAnimFrame + 0.15) % p.barrierFrames.length
    }
  }
}

export function playerShoot(ctx: GameContext, p: Player): void {
  const rad270 = 270 * Math.PI / 180
  const rad260 = 260 * Math.PI / 180
  const rad280 = 280 * Math.PI / 180

  switch (p.shootMode) {
    case 'normal': {
      const b = createPlayerBullet(p, rad270, 14, 11)
      b.name = 'normal'
      b.damage = p.shootNormalData.damage || 1
      b.hp = p.shootNormalData.hp || 1
      p.bullets.push(b)
      ctx.sound.playSfx('se_shoot')
      break
    }
    case 'big': {
      const b = createPlayerBullet(p, rad270, 10, 22)
      b.name = 'big'
      b.damage = p.shootBigData.damage || 2
      b.hp = p.shootBigData.hp || 3
      b.width = 16
      b.height = 16
      p.bullets.push(b)
      ctx.sound.playSfx('se_shoot_b')
      break
    }
    case '3way': {
      for (let i = 0; i < 3; i++) {
        const angle = i === 0 ? rad280 : (i === 1 ? rad270 : rad260)
        const ox = i === 0 ? 14 : (i === 1 ? 10 : 6)
        const b = createPlayerBullet(p, angle, ox, 11)
        b.name = '3way'
        b.damage = p.shootNormalData.damage || 1
        b.hp = p.shootNormalData.hp || 1
        p.bullets.push(b)
      }
      ctx.sound.playSfx('se_shoot')
      break
    }
  }
}

function createPlayerBullet(p: Player, rotation: number, offsetX: number, offsetY: number): PlayerBullet {
  return {
    id: p.bulletIdCnt++,
    x: p.x + 5 * Math.sin(rotation) + offsetX,
    y: p.y + 5 * Math.sin(rotation) + offsetY,
    rotation: rotation,
    width: 8,
    height: 8,
    damage: 1,
    hp: 1,
    name: 'normal',
    dead: 0,
  }
}

export function playerOnDamage(ctx: GameContext, p: Player, amount: number): void {
  if (p.barrierFlg || p.damageAnimFlg || p.dead) return

  p.hp -= amount
  if (p.hp <= 0) p.hp = 0
  p.percent = p.hp / p.maxHp

  if (p.hp <= 0) {
    p.dead = 1
    p.explosionPlaying = 1
    p.explosionFrame = 0
    p.explosionTimer = 0
    p.shootOn = 0
    ctx.sound.playSfx('se_explosion')
    ctx.sound.playSfx('g_continue_no_voice0')
  } else {
    p.damageAnimFlg = 1
    p.damageAnimTimer = 0
    ctx.sound.playSfx('g_damage_voice')
    ctx.sound.playSfx('se_damage')
  }
}

export function playerShootModeChange(ctx: GameContext, p: Player, mode: string): void {
  p.shootMode = mode
  switch (mode) {
    case 'normal':
      p.shootInterval = p.shootNormalData.interval || 20
      break
    case 'big':
      p.shootInterval = p.shootBigData.interval || 20
      break
    case '3way':
      p.shootInterval = p.shoot3wayData.interval || 20
      break
  }
  ctx.sound.playSfx('g_powerup_voice')
}

export function playerShootSpeedChange(ctx: GameContext, p: Player, speed: string): void {
  switch (speed) {
    case 'speed_high':
      p.shootSpeed = 15
      break
    default:
      p.shootSpeed = 0
      break
  }
  ctx.sound.playSfx('g_powerup_voice')
}

export function playerBarrierStart(ctx: GameContext, p: Player): void {
  p.barrierFlg = 1
  p.barrierAlpha = 1.0
  p.barrierTimer = 0
  ctx.sound.playSfx('se_barrier_start')
}

/** Advance the death explosion animation; runs once per fixed step while exploding. */
export function playerExplosionUpdate(p: Player): void {
  if (!p.explosionPlaying) return
  p.explosionTimer++
  if (p.explosionTimer % 3 === 0) p.explosionFrame++
  if (p.explosionFrame > 6) {
    p.explosionPlaying = 0
  }
}

export function playerDraw(ctx: GameContext, p: Player): void {
  if (!p.visible || p.alpha <= 0) return

  if (p.dead && p.explosionPlaying) {
    // Draw explosion animation
    const expFrame = 'explosion0' + String(Math.min(p.explosionFrame, 6)) + '.gif'
    ctx.atlas.drawFrame('game_asset', ctx.atlas.resolveFrameName('game_asset', expFrame),
      ctx.vp.toX(p.x + p.width / 2), ctx.vp.toY(p.y + p.height / 2),
      ctx.vp.scale, ctx.vp.scale, 1.0, null)
    return
  }

  if (p.dead) return

  // Draw shadow
  const playerAtlas = p.atlas || 'game_asset'
  const shadowFrame = p.frames.length > 0 ? ctx.atlas.resolveFrameName(playerAtlas, p.frames[p.animFrame]) : null
  if (shadowFrame) {
    // dark-grey shadow: 30 on the original GS 128-neutral basis -> 60 here (255-neutral)
    const shadowColor = ctx.rt.Color.new(60, 60, 60, 60)
    ctx.atlas.drawFrame(playerAtlas, shadowFrame,
      ctx.vp.toX(p.x + p.width / 2), ctx.vp.toY(p.y + p.height / 2 + p.shadowOffsetY),
      ctx.vp.scale, ctx.vp.scale, 0.3, shadowColor)
  }

  // Draw player
  if (p.frames.length > 0) {
    const frame = ctx.atlas.resolveFrameName(playerAtlas, p.frames[p.animFrame])
    let tint: number | null = null
    if (p.tintFlash) {
      tint = ctx.rt.Color.new(255, 80, 80, Math.floor(p.alpha * 128))
    } else if (p.alpha < 1.0) {
      tint = ctx.rt.Color.new(255, 255, 255, Math.floor(p.alpha * 128))
    }
    ctx.atlas.drawFrame(playerAtlas, frame,
      ctx.vp.toX(p.x + p.width / 2), ctx.vp.toY(p.y + p.height / 2),
      ctx.vp.scale, ctx.vp.scale, p.alpha, tint)
  }

  // Draw barrier
  if (p.barrierFlg && p.barrierAlpha > 0) {
    if (p.barrierFrames.length > 0) {
      const bFrame = ctx.atlas.resolveFrameName('game_asset', p.barrierFrames[Math.floor(p.barrierAnimFrame)])
      const bTint = ctx.rt.Color.new(255, 255, 255, Math.floor(p.barrierAlpha * 128))
      ctx.atlas.drawFrame('game_asset', bFrame,
        ctx.vp.toX(p.x + p.width / 2), ctx.vp.toY(p.y - 15 + 20),
        ctx.vp.scale, ctx.vp.scale, p.barrierAlpha, bTint)
    }
  }

  // Draw bullets
  for (let i = 0; i < p.bullets.length; i++) {
    const bullet = p.bullets[i]
    let bfName: string | null = null
    switch (bullet.name) {
      case 'big':
        bfName = p.shootBigData.texture ? p.shootBigData.texture[0] : null
        break
      default:
        bfName = p.shootNormalData.texture ? p.shootNormalData.texture[0] : null
        break
    }
    if (bfName) {
      bfName = ctx.atlas.resolveFrameName('game_asset', bfName)
      ctx.atlas.drawFrame('game_asset', bfName,
        ctx.vp.toX(bullet.x + bullet.width / 2),
        ctx.vp.toY(bullet.y + bullet.height / 2),
        ctx.vp.scale, ctx.vp.scale, 1.0, null)
    }
  }
}
