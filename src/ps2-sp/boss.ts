// Boss entity: quint-eased entry drop, three-point side-to-side drift,
// five per-stage attack patterns (straight / spread / radial shots) queued
// into pendingProjectiles for the game scene to spawn, a theWorld freeze
// flag, damage tint flash, and a staggered multi-explosion death.

import type { GameContext } from './context.ts'
import type { BossData, ProjectileSpec } from './types.ts'
import type { ProjectileInit } from './projectile.ts'
import { GCX, GW } from './constants.ts'

export interface Boss {
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
  hp: number
  maxHp: number
  score: number
  spgage: number
  speed: number
  // Attack pattern
  stageId: number
  projectileData: ProjectileSpec | null
  projectileDataA: ProjectileSpec | null
  projectileDataB: ProjectileSpec | null
  projectileDataC: ProjectileSpec | null
  shootFlg: number
  patternTimer: number
  patternPhase: number
  attackCooldown: number
  // State
  dead: number
  deadFlg: number
  theWorld: number
  visible: number
  alpha: number
  toujouFlg: number
  // Shadow
  shadowReverse: number
  shadowOffsetY: number
  shadowVisible: number
  // Explosion
  explosionPlaying: number
  explosionFrame: number
  explosionTimer: number
  explosionCount: number
  // Visual effects
  tintFlash: number
  tintTimer: number
  // Entry animation
  entryDone: number
  entryTimer: number
  entryStartY: number
  entryEndY: number
  // Projectiles spawned (returned to game scene for hit testing)
  pendingProjectiles: ProjectileInit[]
  // Movement pattern
  moveTimer: number
  moveTargetX: number
  movePhase: number
  // Goki special
  gokiFlg: number
  akebonoFlg: number
}

export function createBoss(ctx: GameContext, data: BossData, stageId: number): Boss {
  const b: Boss = {
    name: data.name || '',
    atlas: 'game_asset',
    frames: data.texture || [],
    animFrame: 0,
    animSpeed: 0.15,
    animCounter: 0,
    x: 0,
    y: -64,
    width: 64,
    height: 64,
    hitX: 0,
    hitY: 0,
    hitW: 64,
    hitH: 64,
    hp: data.hp || 100,
    maxHp: data.hp || 100,
    score: data.score || 1000,
    spgage: data.spgage || 50,
    speed: data.speed || 1,
    // Attack pattern
    stageId: stageId,
    projectileData: data.projectileData || null,
    projectileDataA: data.projectileDataA || null,
    projectileDataB: data.projectileDataB || null,
    projectileDataC: data.projectileDataC || null,
    shootFlg: 0,
    patternTimer: 0,
    patternPhase: 0,
    attackCooldown: 0,
    // State
    dead: 0,
    deadFlg: 0,
    theWorld: 0,
    visible: 1,
    alpha: 1.0,
    toujouFlg: 0,
    // Shadow
    shadowReverse: 1,
    shadowOffsetY: 0,
    shadowVisible: 1,
    // Explosion
    explosionPlaying: 0,
    explosionFrame: 0,
    explosionTimer: 0,
    explosionCount: 0,
    // Visual effects
    tintFlash: 0,
    tintTimer: 0,
    // Entry animation
    entryDone: 0,
    entryTimer: 0,
    entryStartY: -64,
    entryEndY: 60,
    // Projectiles spawned (returned to game scene for hit testing)
    pendingProjectiles: [],
    // Movement pattern
    moveTimer: 0,
    moveTargetX: 0,
    movePhase: 0,
    // Goki special
    gokiFlg: data.gokiFlg || 0,
    akebonoFlg: 0,
  }

  // Set dimensions from first frame
  if (b.frames.length > 0) {
    const size = ctx.atlas.getFrameSize(
      'game_asset',
      ctx.atlas.resolveFrameName('game_asset', b.frames[0]),
    )
    if (size.w > 0) {
      b.width = size.w
      b.height = size.h
      b.hitW = size.w
      b.hitH = size.h
    }
  }

  return b
}

export function bossEntry(ctx: GameContext, b: Boss): void {
  b.entryDone = 0
  b.entryTimer = 0
  b.y = b.entryStartY
  ctx.sound.playSfx('boss_' + b.name + '_voice_add')
}

export function bossLoop(ctx: GameContext, b: Boss): void {
  if (b.dead || b.theWorld) return

  // Entry animation
  if (!b.entryDone) {
    b.entryTimer++
    const t = Math.min(b.entryTimer / 60, 1.0)
    const eased = 1 - Math.pow(1 - t, 5) // quint ease out
    b.y = b.entryStartY + (b.entryEndY - b.entryStartY) * eased
    if (t >= 1.0) {
      b.entryDone = 1
      b.shootFlg = 1
    }
    return
  }

  // Animate
  if (b.frames.length > 1) {
    b.animCounter += b.animSpeed
    if (b.animCounter >= b.frames.length) b.animCounter -= b.frames.length
    b.animFrame = Math.floor(b.animCounter) % b.frames.length
  }

  // Movement pattern — side-to-side
  const bMul = ctx.state.turboMode ? 2 : 1
  b.moveTimer += bMul
  if (b.moveTimer % 120 === 0) {
    b.movePhase = (b.movePhase + 1) % 3
    switch (b.movePhase) {
      case 0:
        b.moveTargetX = GCX - b.width / 2
        break
      case 1:
        b.moveTargetX = GW * 0.2
        break
      case 2:
        b.moveTargetX = GW * 0.6
        break
    }
  }
  b.x += 0.03 * bMul * (b.moveTargetX - b.x)

  // Attack pattern
  if (b.shootFlg) {
    b.patternTimer++
    b.attackCooldown -= bMul

    if (b.attackCooldown <= 0) {
      bossAttack(ctx, b)
    }
  }

  // Tint flash decay
  if (b.tintFlash > 0) {
    b.tintTimer++
    if (b.tintTimer > 6) {
      b.tintFlash = 0
      b.tintTimer = 0
    }
  }
}

function bossAttack(ctx: GameContext, b: Boss): void {
  const projData = b.projectileData
  if (!projData) {
    b.attackCooldown = 60
    return
  }

  switch (b.stageId) {
    case 0: // Bison — straight shots + psycho field
      if (b.patternPhase % 3 < 2) {
        // Straight shots
        bossShootStraight(b, projData)
        b.attackCooldown = 30
      } else {
        // Radial burst
        bossShootRadial(b, projData, 12)
        b.attackCooldown = 90
      }
      b.patternPhase++
      break

    case 1: // Barlog — fast dashes + projectiles
      bossShootStraight(b, projData)
      if (b.patternPhase % 4 === 0 && b.projectileDataA) {
        bossShootSpread(b, b.projectileDataA, 3)
      }
      b.attackCooldown = 25
      b.patternPhase++
      break

    case 2: // Sagat — tiger shots + upper
      if (b.patternPhase % 2 === 0) {
        bossShootStraight(b, projData)
      } else {
        bossShootSpread(b, projData, 2)
      }
      b.attackCooldown = 35
      b.patternPhase++
      break

    case 3: // Vega — teleport + claw swipes
      bossShootStraight(b, projData)
      if (b.patternPhase % 5 === 0) {
        bossShootRadial(b, projData, 8)
      }
      b.attackCooldown = 28
      b.patternPhase++
      break

    case 4: // Fang — poison beams + spread
      if (b.patternPhase % 3 === 0) {
        bossShootRadial(b, projData, 16)
        b.attackCooldown = 60
      } else {
        bossShootSpread(b, projData, 3)
        b.attackCooldown = 25
      }
      b.patternPhase++
      break

    default:
      bossShootStraight(b, projData)
      b.attackCooldown = 40
      break
  }

  ctx.sound.playSfx('se_shoot')
}

function bossShootStraight(b: Boss, data: ProjectileSpec): void {
  b.pendingProjectiles.push({
    x: b.x + b.hitW / 2,
    y: b.y + b.hitH,
    rotX: 0,
    rotY: 1,
    speed: data.speed || 2,
    damage: data.damage || 1,
    hp: data.hp || 1,
    name: data.name || 'bullet',
    frames: data.texture || [],
    width: 8,
    height: 8,
  })
}

function bossShootSpread(b: Boss, data: ProjectileSpec, count: number): void {
  const baseAngle = 80
  const spread = 20
  const step = count > 1 ? spread / (count - 1) : 0
  const startAngle = baseAngle - spread / 2

  for (let i = 0; i < count; i++) {
    const deg = startAngle + step * i
    const rad = deg * Math.PI / 180
    b.pendingProjectiles.push({
      x: b.x + b.hitW / 2,
      y: b.y + b.hitH,
      rotX: Math.cos(rad),
      rotY: Math.sin(rad),
      speed: data.speed || 2,
      damage: data.damage || 1,
      hp: data.hp || 1,
      name: data.name || 'bullet',
      frames: data.texture || [],
      width: 8,
      height: 8,
    })
  }
}

function bossShootRadial(b: Boss, data: ProjectileSpec, count: number): void {
  for (let i = 0; i < count; i++) {
    const deg = (i / count) * 360
    const rad = deg * Math.PI / 180
    b.pendingProjectiles.push({
      x: b.x + b.hitW / 2,
      y: b.y + b.hitH / 2,
      rotX: Math.cos(rad),
      rotY: Math.sin(rad),
      speed: data.speed || 1.5,
      damage: data.damage || 1,
      hp: data.hp || 1,
      name: data.name || 'bullet',
      frames: data.texture || [],
      width: 8,
      height: 8,
    })
  }
}

export function bossOnDamage(ctx: GameContext, b: Boss, damage: number): void {
  if (b.deadFlg || b.dead) return

  b.hp -= damage
  b.tintFlash = 1
  b.tintTimer = 0

  if (b.hp <= 0) {
    b.hp = 0
    bossDead(ctx, b)
  }
}

export function bossDead(ctx: GameContext, b: Boss): void {
  b.deadFlg = 1
  b.shootFlg = 0
  b.explosionPlaying = 1
  b.explosionFrame = 0
  b.explosionTimer = 0
  b.explosionCount = 0
  ctx.sound.playSfx('se_explosion')
  ctx.sound.playSfx('boss_' + b.name + '_voice_ko')
}

// Advances the staggered explosion chain once per fixed step; returns 1
// exactly once, on the step the sequence completes and the boss dies.
export function bossExplosionUpdate(ctx: GameContext, b: Boss): 0 | 1 {
  if (!b.explosionPlaying) return 0

  b.explosionTimer++
  if (b.explosionTimer % 8 === 0) {
    b.explosionCount++
    if (b.explosionCount > 5) {
      b.explosionPlaying = 0
      b.dead = 1
      return 1 // dead complete
    }
    ctx.sound.playSfx('se_explosion')
  }
  return 0
}

export function bossDraw(ctx: GameContext, b: Boss): void {
  if (!b.visible || b.alpha <= 0) return

  if (b.explosionPlaying) {
    // Multiple staggered explosions
    for (let i = 0; i <= b.explosionCount; i++) {
      const ox = Math.sin(i * 2.5) * 20
      const oy = Math.cos(i * 3.1) * 15
      const ef = Math.min((b.explosionTimer + i * 3) % 21 / 3, 6)
      const expFrame = 'explosion0' + String(Math.floor(ef)) + '.gif'
      ctx.atlas.drawFrame(
        'game_asset',
        ctx.atlas.resolveFrameName('game_asset', expFrame),
        ctx.vp.toX(b.x + b.width / 2 + ox),
        ctx.vp.toY(b.y + b.height / 2 + oy),
        ctx.vp.scale,
        ctx.vp.scale,
        1.0,
        null,
      )
    }
    return
  }

  if (b.deadFlg) return

  // Draw shadow
  if (b.shadowVisible && b.frames.length > 0) {
    const frame = ctx.atlas.resolveFrameName('game_asset', b.frames[b.animFrame])
    // dark-grey shadow: 30 on the original GS 128-neutral basis -> 60 here (255-neutral)
    const shadowColor = ctx.rt.Color.new(60, 60, 60, 60)
    ctx.atlas.drawFrame(
      'game_asset',
      frame,
      ctx.vp.toX(b.x + b.width / 2),
      ctx.vp.toY(b.y + b.height / 2 + 5),
      ctx.vp.scale,
      -ctx.vp.scale,
      0.3,
      shadowColor,
    )
  }

  // Draw boss
  if (b.frames.length > 0) {
    const frame = ctx.atlas.resolveFrameName('game_asset', b.frames[b.animFrame])
    let tint: number | null = null
    if (b.tintFlash) {
      tint = ctx.rt.Color.new(255, 80, 80, 128)
    }
    ctx.atlas.drawFrame(
      'game_asset',
      frame,
      ctx.vp.toX(b.x + b.width / 2),
      ctx.vp.toY(b.y + b.height / 2),
      ctx.vp.scale,
      ctx.vp.scale,
      b.alpha,
      tint,
    )
  }
}
