// Game scene — the main gameplay loop: player movement and shooting,
// enemy waves spawned from the stage recipe with item drops, the stage
// boss with entry animation and countdown timer, SP-gauge super fire,
// turbo mode with its blackout/impact activation effect, a pause menu,
// all collision passes, the scrolling stage background, and the
// ROUND / FIGHT! / K.O. / STAGE CLEAR! overlays.

import { hitTestAABB } from '../../toolkit/index.ts'
import type { SceneHandlers } from '../../toolkit/index.ts'
import type { GameContext } from '../context.ts'
import {
  GCX,
  GCY,
  GH,
  GW,
  PLAYER_MOVE_SPEED,
  SCENE_ADV,
  SCENE_CONTINUE,
  SCENE_ENDING,
  SCENE_TITLE,
  SCREEN_H,
  SCREEN_W,
} from '../constants.ts'
import type { NetService, StageData } from '../types.ts'
import {
  createPlayer,
  playerBarrierStart,
  playerDraw,
  playerExplosionUpdate,
  playerLoop,
  playerOnDamage,
  playerSetUp,
  playerShootModeChange,
  playerShootSpeedChange,
} from '../player.ts'
import type { Player } from '../player.ts'
import { createEnemy, enemyDead, enemyDraw, enemyExplosionUpdate, enemyLoop, enemyOnDamage } from '../enemy.ts'
import type { Enemy } from '../enemy.ts'
import {
  bossDraw,
  bossEntry,
  bossExplosionUpdate,
  bossLoop,
  bossOnDamage,
  createBoss,
} from '../boss.ts'
import type { Boss } from '../boss.ts'
import { createProjectile, projectileDraw, projectileLoop } from '../projectile.ts'
import type { Projectile } from '../projectile.ts'
import { hudDraw, hudLoop, hudOnEnemyKill, hudReset } from '../hud.ts'

interface GameItem {
  x: number
  y: number
  name: string
  frames: string[]
  animFrame: number
  animCounter: number
}

interface TurboImpact {
  x: number
  y: number
  frame: number
  timer: number
}

interface GameSceneState {
  waveInterval: number
  waveCount: number
  frameCnt: number
  enemyWaveFlg: number
  theWorldFlg: number
  enemies: Enemy[]
  projectiles: Projectile[]
  items: GameItem[]
  player: Player | null
  // Remote P2 ship (netplay guest). Non-null only while a guest holds the seat.
  player2: Player | null
  boss: Boss | null
  bossTimerStartFlg: number
  bossTimerCountDown: number
  bossTimerFrameCnt: number
  stageEnemyList: string[][]
  stageBgScrollY: number
  stageBgmName: string
  sceneSwitch: number
  // SP fire
  spLineH: number
  spFireActive: number
  spFireTimer: number
  // Stage clear / game over
  resultTimer: number
  // Turbo activation effect
  turboEffectActive: number
  turboImpacts: TurboImpact[]
  turboFlashAlpha: number
  turboBlackoutAlpha: number
}

export function createGameScene(ctx: GameContext, net: NetService | null = null): SceneHandlers {
  const gs: GameSceneState = {
    waveInterval: 80,
    waveCount: 0,
    frameCnt: 0,
    enemyWaveFlg: 0,
    theWorldFlg: 0,
    enemies: [],
    projectiles: [],
    items: [],
    player: null,
    player2: null,
    boss: null,
    bossTimerStartFlg: 0,
    bossTimerCountDown: 99,
    bossTimerFrameCnt: 0,
    stageEnemyList: [],
    stageBgScrollY: 0,
    stageBgmName: '',
    sceneSwitch: 0,
    // SP fire
    spLineH: 0,
    spFireActive: 0,
    spFireTimer: 0,
    // Stage clear / game over
    resultTimer: 0,
    // Turbo activation effect
    turboEffectActive: 0,
    turboImpacts: [],
    turboFlashAlpha: 0,
    turboBlackoutAlpha: 0,
  }

  function init(): void {
    ctx.state.paused = 0
    ctx.state.pauseCursor = 0
    ctx.scheduler.paused = false
    ctx.tweens.paused = false
    gs.waveCount = 0
    gs.frameCnt = 0
    gs.enemyWaveFlg = 0
    gs.theWorldFlg = 0
    gs.enemies = []
    gs.projectiles = []
    gs.items = []
    gs.player2 = null
    gs.boss = null
    gs.bossTimerStartFlg = 0
    gs.bossTimerCountDown = 99
    gs.bossTimerFrameCnt = 0
    gs.stageBgScrollY = 0
    gs.sceneSwitch = 0
    gs.spFireActive = 0
    gs.spFireTimer = 0
    gs.spLineH = 0
    gs.resultTimer = 0
    gs.turboEffectActive = 0
    gs.turboImpacts = []
    gs.turboFlashAlpha = 0
    gs.turboBlackoutAlpha = 0

    // Load stage enemy list from recipe
    const recipe = ctx.state.recipe
    if (recipe) {
      const stageKey = 'stage' + String(ctx.state.stageId)
      const stageData = recipe[stageKey] as StageData | undefined
      if (stageData && stageData.enemylist) {
        gs.stageEnemyList = stageData.enemylist.slice().reverse()
      } else {
        gs.stageEnemyList = []
      }
    }

    // Create player (cyber-liberty: 32x32, centered at GCX, GH-96)
    const playerData = recipe ? recipe.playerData : null
    if (playerData) {
      gs.player = createPlayer(playerData)
      playerSetUp(gs.player, ctx.state.playerMaxHp || playerData.maxHp || 0,
        ctx.state.shootMode || 'normal', ctx.state.shootSpeed || 'speed_normal')
      gs.player.x = GCX - gs.player.width / 2
      gs.player.y = GH - 96 - gs.player.height / 2
      gs.player.targetX = GCX
      gs.player.targetY = gs.player.y
    }

    // Boss BGM
    const bossData = recipe && recipe.bossData ? recipe.bossData['boss' + String(ctx.state.stageId)] : null
    if (bossData) {
      gs.stageBgmName = 'boss_' + bossData.name + '_bgm'
      ctx.sound.stopBgm()
      ctx.sound.playBgm(gs.stageBgmName)
    }

    hudReset(ctx.hud)
    ctx.hud.scoreCount = ctx.state.score || 0
    ctx.hud.highScore = ctx.state.highScore || 0
    ctx.hud.spgageCount = ctx.state.spgage || 0

    // Start wave spawning after intro delay
    ctx.scheduler.delayedCall(2600, () => {
      gs.enemyWaveFlg = 1
      if (gs.player) gs.player.shootOn = 1
      ctx.sound.playSound('g_stage_voice_' + String(ctx.state.stageId))
    })

    ctx.sound.playSound('voice_round' + String(Math.min(ctx.state.stageId, 3)))
    ctx.scheduler.delayedCall(800, () => {
      ctx.sound.playSound('voice_fight')
    })
  }

  function update(): void {
    // Publish the live scene to the netplay host each fixed step (no-op when
    // not hosting). The host throttles this into RTDB snapshots.
    net?.onSceneTick?.({
      player: gs.player,
      player2: gs.player2,
      enemies: gs.enemies,
      projectiles: gs.projectiles,
      boss: gs.boss,
      state: ctx.state,
    })

    const p = gs.player
    if (!p) return

    // Pause toggle
    if (ctx.input.isStartPressed()) {
      if (ctx.state.paused) {
        // Unpause: resume timers/tweens
        ctx.state.paused = 0
        ctx.scheduler.paused = false
        ctx.tweens.paused = false
      } else {
        // Pause: freeze timers/tweens, reset menu cursor
        ctx.state.paused = 1
        ctx.state.pauseCursor = 0
        ctx.scheduler.paused = true
        ctx.tweens.paused = true
      }
    }
    if (ctx.state.paused) {
      updatePauseMenu()
      return
    }

    // Turbo mode toggle: SELECT + DPAD_DOWN
    if (!gs.turboEffectActive && ctx.input.isTurboToggle()) {
      if (ctx.state.turboMode) {
        ctx.state.turboMode = 0
      } else {
        startTurboEffect()
      }
    }

    if (gs.theWorldFlg) {
      // Enemy explosions keep animating while the world is frozen (the
      // original advanced them in draw, which ran unconditionally). The enemy
      // update loop below is skipped here, so advance in-flight explosions
      // directly; culling happens once theWorldFlg clears and enemyLoop runs.
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        if (gs.enemies[i].explosionPlaying) enemyExplosionUpdate(gs.enemies[i])
      }

      // Turbo activation effect
      if (gs.turboEffectActive) {
        updateTurboEffect()
        return
      }
      // Check for stage clear / game over completion
      if (p.dead) {
        gs.resultTimer++
        playerExplosionUpdate(p)
        if (gs.resultTimer > 90) {
          ctx.state.score = ctx.hud.scoreCount
          ctx.scenes.switch(SCENE_CONTINUE)
        }
        return
      }

      // Boss dead sequence
      if (gs.boss && gs.boss.deadFlg) {
        const boss = gs.boss
        bossExplosionUpdate(ctx, boss)
        if (boss.dead) {
          gs.resultTimer++
        }
        if (gs.resultTimer > 75) {
          ctx.state.playerHp = p.hp
          ctx.state.spgage = ctx.hud.spgageCount
          ctx.state.score = ctx.hud.scoreCount
          ctx.state.stageId++
          if (ctx.state.stageId > 4) {
            ctx.scenes.switch(SCENE_ENDING)
          } else {
            ctx.scenes.switch(SCENE_ADV)
          }
        }
        return
      }

      // SP fire active
      if (gs.spFireActive) {
        updateSpFire()
      }
      return
    }

    // --- Player input ---
    if (ctx.input.isLeftHeld()) {
      p.targetX -= PLAYER_MOVE_SPEED
    }
    if (ctx.input.isRightHeld()) {
      p.targetX += PLAYER_MOVE_SPEED
    }
    // Clamp
    if (p.targetX < p.hitW / 2) p.targetX = p.hitW / 2
    if (p.targetX > GW - p.hitW / 2) p.targetX = GW - p.hitW / 2

    // SP fire
    if (ctx.input.isSpPressed() && ctx.hud.spBtnActive &&
      ctx.hud.spgageCount >= ctx.hud.spgageMax && !gs.spFireActive) {
      startSpFire()
    }

    // --- Update player ---
    playerLoop(ctx, p)

    // --- Remote P2 ship (netplay guest) ---
    updateRemotePlayer2()

    // Player bullet sources: P1 always, plus P2 while a guest holds the seat.
    const bulletArrays = gs.player2 ? [p.bullets, gs.player2.bullets] : [p.bullets]

    // --- Update HUD ---
    hudLoop(ctx.hud)
    ctx.hud.hpPercent = p.percent

    // --- Enemy waves ---
    if (gs.enemyWaveFlg) {
      gs.frameCnt += ctx.state.turboMode ? 2 : 1
      if (gs.frameCnt % gs.waveInterval === 0) {
        if (gs.waveCount >= gs.stageEnemyList.length) {
          // Boss time
          spawnBoss()
          gs.enemyWaveFlg = 0
        } else {
          spawnEnemyWave()
          gs.waveCount++
        }
      }
    }

    // --- Update enemies ---
    for (let i = gs.enemies.length - 1; i >= 0; i--) {
      const e = gs.enemies[i]
      const result = enemyLoop(ctx, e, p)

      if (result === 0) {
        // Remove enemy
        gs.enemies.splice(i, 1)
        continue
      }

      if (result === 'shoot' && e.projectileData) {
        // Enemy shoots
        const proj = createProjectile({
          x: e.x + e.width / 2,
          y: e.y + e.hitH / 2,
          rotX: 0,
          rotY: 1,
          speed: e.projectileData.speed || 2,
          damage: e.projectileData.damage || 1,
          hp: e.projectileData.hp || 1,
          name: e.projectileData.name || 'bullet',
          frames: e.projectileData.texture || [],
          atlas: e.projectileData.atlas || e.atlas || 'game_asset',
        })
        gs.projectiles.push(proj)
        ctx.sound.playSfx('se_shoot')
      }

      // Hit test: enemy vs player bullets (P1 + remote P2)
      if (!e.deadFlg && e.y >= 40 && e.x >= -e.width / 2 && e.x <= GW - e.width / 2) {
        for (const bullets of bulletArrays) {
          for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j]
            if (hitTestAABB(e.x + e.hitX, e.y + e.hitY, e.hitW, e.hitH,
              b.x, b.y, b.width, b.height)) {
              enemyOnDamage(ctx, e, b.damage)
              b.hp -= 1
              if (b.hp <= 0) {
                bullets.splice(j, 1)
              }
              ctx.sound.playSfx('se_damage')
              if (e.deadFlg) {
                hudOnEnemyKill(ctx.hud, e.score, e.spgage)
                // Drop item
                if (e.itemName) {
                  gs.items.push({
                    x: e.x,
                    y: e.y,
                    name: e.itemName,
                    frames: e.itemTexture || [],
                    animFrame: 0,
                    animCounter: 0,
                  })
                }
              }
            }
          }
        }
      }

      // Hit test: enemy vs player (collision damage)
      if (!e.deadFlg && !p.dead) {
        if (p.barrierFlg) {
          if (hitTestAABB(e.x + e.hitX, e.y + e.hitY, e.hitW, e.hitH,
            p.x + p.hitX, p.y - 15, p.hitW + 10, p.hitH + 20)) {
            enemyDead(ctx, e)
            hudOnEnemyKill(ctx.hud, e.score, e.spgage)
            ctx.sound.playSfx('se_guard')
          }
        } else if (hitTestAABB(e.x + e.hitX, e.y + e.hitY, e.hitW, e.hitH,
          p.x + p.hitX, p.y + p.hitY, p.hitW, p.hitH)) {
          gamePlayerDamage(1)
        }
      }
    }

    // --- Update boss ---
    if (gs.boss && !gs.boss.dead) {
      const boss = gs.boss
      bossLoop(ctx, boss)

      // Collect boss projectiles
      while (boss.pendingProjectiles.length > 0) {
        const pd = boss.pendingProjectiles.shift()
        if (pd) gs.projectiles.push(createProjectile(pd))
      }

      // Hit test: boss vs player bullets (P1 + remote P2)
      if (!boss.deadFlg && boss.entryDone) {
        for (const bullets of bulletArrays) {
          for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j]
            if (hitTestAABB(boss.x + boss.hitX, boss.y + boss.hitY,
              boss.hitW, boss.hitH, b.x, b.y, b.width, b.height)) {
              bossOnDamage(ctx, boss, b.damage)
              b.hp -= 1
              if (b.hp <= 0) {
                bullets.splice(j, 1)
              }
              ctx.sound.playSfx('se_damage')
              if (boss.deadFlg) {
                hudOnEnemyKill(ctx.hud, boss.score, boss.spgage)
                gs.theWorldFlg = 1
                gs.resultTimer = 0
                p.shootOn = 0
                ctx.hud.spBtnActive = 0
                ctx.sound.playSound('voice_ko')
              }
            }
          }
        }

        // Hit test: boss vs player
        if (!boss.deadFlg && !p.dead && !p.barrierFlg) {
          if (hitTestAABB(boss.x + boss.hitX, boss.y + boss.hitY,
            boss.hitW, boss.hitH,
            p.x + p.hitX, p.y + p.hitY, p.hitW, p.hitH)) {
            gamePlayerDamage(1)
          }
        }
      }

      // Boss timer
      if (gs.bossTimerStartFlg) {
        gs.bossTimerFrameCnt++
        if (gs.bossTimerFrameCnt % 30 === 0) {
          gs.bossTimerCountDown--
          ctx.hud.bossTimerCount = gs.bossTimerCountDown
          if (gs.bossTimerCountDown <= 0) {
            gs.bossTimerStartFlg = 0
            // Time over — player loses
            gamePlayerDamage(9999)
          }
        }
      }
    }

    // --- Update projectiles ---
    for (let i = gs.projectiles.length - 1; i >= 0; i--) {
      const proj = gs.projectiles[i]
      if (!projectileLoop(ctx, proj, p)) {
        gs.projectiles.splice(i, 1)
        continue
      }

      // Hit test: projectile vs player (P1 only — P2 is damage-immune in v1)
      if (!p.dead) {
        if (p.barrierFlg) {
          if (hitTestAABB(proj.x - proj.width / 2, proj.y - proj.height / 2,
            proj.width, proj.height,
            p.x + p.hitX, p.y - 15, p.hitW + 10, p.hitH + 20)) {
            proj.deadFlg = 1
            proj.dead = 1
            gs.projectiles.splice(i, 1)
            ctx.sound.playSfx('se_guard')
          }
        } else if (hitTestAABB(proj.x - proj.width / 2, proj.y - proj.height / 2,
          proj.width, proj.height,
          p.x + p.hitX, p.y + p.hitY, p.hitW, p.hitH)) {
          gamePlayerDamage(proj.damage)
          proj.deadFlg = 1
          proj.dead = 1
          gs.projectiles.splice(i, 1)
        }
      }
    }

    // --- Player bullets vs enemy projectiles ---
    for (let i = gs.projectiles.length - 1; i >= 0; i--) {
      const proj = gs.projectiles[i]
      for (let j = p.bullets.length - 1; j >= 0; j--) {
        const b = p.bullets[j]
        if (hitTestAABB(proj.x - proj.width / 2, proj.y - proj.height / 2,
          proj.width, proj.height, b.x, b.y, b.width, b.height)) {
          proj.hp = (proj.hp || 1) - b.damage
          b.hp -= 1
          if (b.hp <= 0) {
            p.bullets.splice(j, 1)
          }
          if (proj.hp <= 0) {
            gs.projectiles.splice(i, 1)
            break
          }
        }
      }
    }

    // --- Update items ---
    const tMul = ctx.state.turboMode ? 2 : 1
    for (let i = gs.items.length - 1; i >= 0; i--) {
      const item = gs.items[i]
      item.y += 1 * tMul
      item.animCounter += 0.08

      // Hit test: item vs player
      if (hitTestAABB(item.x, item.y, 16, 16,
        p.x + p.hitX, p.y + p.hitY, p.hitW, p.hitH)) {
        switch (item.name) {
          case 'speed_high':
            ctx.state.shootSpeed = item.name
            playerShootSpeedChange(ctx, p, ctx.state.shootSpeed)
            break
          case 'barrier':
            playerBarrierStart(ctx, p)
            break
          default:
            if (p.shootMode !== item.name) {
              ctx.state.shootSpeed = 'speed_normal'
              playerShootSpeedChange(ctx, p, ctx.state.shootSpeed)
            }
            ctx.state.shootMode = item.name
            playerShootModeChange(ctx, p, ctx.state.shootMode)
            break
        }
        gs.items.splice(i, 1)
        continue
      }

      if (item.y >= GH - 10) {
        gs.items.splice(i, 1)
      }
    }

    // --- Stage background scroll ---
    gs.stageBgScrollY += 0.7 * tMul
  }

  function draw(): void {
    const { Color, Draw } = ctx.rt

    // Stage background
    drawStageBg()

    // Items
    for (let i = 0; i < gs.items.length; i++) {
      const item = gs.items[i]
      if (item.frames && item.frames.length > 0) {
        const fi = Math.floor(item.animCounter) % item.frames.length
        // Check level_atlas first, then game_asset for item sprites
        const itemAtlas = ctx.atlas.hasFrame('level_atlas', ctx.atlas.resolveFrameName('level_atlas', item.frames[fi]))
          ? 'level_atlas'
          : 'game_asset'
        const fname = ctx.atlas.resolveFrameName(itemAtlas, item.frames[fi])
        ctx.atlas.drawFrame(itemAtlas, fname,
          ctx.vp.toX(item.x + 8), ctx.vp.toY(item.y + 8),
          ctx.vp.scale, ctx.vp.scale, 1.0, null)
      } else {
        // Fallback colored square
        Draw.rect(ctx.vp.toX(item.x), ctx.vp.toY(item.y), ctx.vp.toW(12), ctx.vp.toH(12),
          Color.new(255, 255, 0))
      }
    }

    // Enemies
    for (let i = 0; i < gs.enemies.length; i++) {
      enemyDraw(ctx, gs.enemies[i])
    }

    // Boss
    if (gs.boss) {
      bossDraw(ctx, gs.boss)
    }

    // Projectiles
    for (let i = 0; i < gs.projectiles.length; i++) {
      projectileDraw(ctx, gs.projectiles[i])
    }

    // Player
    if (gs.player) {
      playerDraw(ctx, gs.player)
    }

    // Remote P2 ship (netplay guest)
    if (gs.player2) {
      playerDraw(ctx, gs.player2)
    }

    // SP fire effect
    if (gs.spFireActive && gs.player) {
      const spColor = Color.new(255, 50, 50, 100)
      Draw.rect(ctx.vp.toX(gs.player.x + 12), ctx.vp.toY(gs.player.y - gs.spLineH),
        ctx.vp.toW(3), ctx.vp.toH(gs.spLineH), spColor)
    }

    // HUD
    hudDraw(ctx)

    // Stage/round title overlay
    if (ctx.scenes.timer < 90) {
      const titleAlpha = ctx.scenes.timer < 60 ? 1.0 : (1.0 - (ctx.scenes.timer - 60) / 30)
      const ta = Math.floor(titleAlpha * 128)
      const titleColor = Color.new(255, 255, 255, ta)
      ctx.font.print(ctx.vp.toX(GCX - 30), ctx.vp.toY(GCY - 40),
        'ROUND ' + String(ctx.state.stageId + 1), titleColor)
    }
    if (ctx.scenes.timer >= 40 && ctx.scenes.timer < 100) {
      const fightAlpha = ctx.scenes.timer < 80 ? 1.0 : (1.0 - (ctx.scenes.timer - 80) / 20)
      const fa = Math.floor(fightAlpha * 128)
      const fightColor = Color.new(255, 200, 0, fa)
      ctx.font.print(ctx.vp.toX(GCX - 20), ctx.vp.toY(GCY),
        'FIGHT!', fightColor)
    }

    // Game over text
    if (gs.player && gs.player.dead && gs.resultTimer > 30) {
      ctx.font.print(ctx.vp.toX(GCX - 20), ctx.vp.toY(GCY - 10),
        'K.O.', Color.new(255, 60, 60))
    }

    // Stage clear text
    if (gs.boss && gs.boss.dead && gs.resultTimer > 20) {
      ctx.font.print(ctx.vp.toX(GCX - 35), ctx.vp.toY(GCY - 10),
        'STAGE CLEAR!', Color.new(255, 255, 0))
    }

    // Turbo mode indicator
    if (ctx.state.turboMode && !gs.turboEffectActive) {
      const turboFlicker = (ctx.scenes.timer % 20 < 14) ? 1.0 : 0.5
      const tc = Color.new(255, 100, 0, Math.floor(turboFlicker * 128))
      ctx.font.print(ctx.vp.toX(GW - 52), ctx.vp.toY(GH - 18), 'TURBO', tc)
    }

    // Turbo activation effect overlay
    if (gs.turboEffectActive || gs.turboBlackoutAlpha > 0) {
      drawTurboEffect()
    }

    // Pause menu overlay
    if (ctx.state.paused) {
      drawPauseMenu()
    }
  }

  function drawStageBg(): void {
    // Draw tiled stage background
    const stageKey = 'stage_loop' + String(ctx.state.stageId)
    if (ctx.atlas.hasFrame('game_ui', stageKey)) {
      // Tile vertically with scroll
      const bgH = 480
      const scrollY = gs.stageBgScrollY % bgH
      ctx.atlas.drawFrameTL('game_ui', stageKey, ctx.vp.toX(0), ctx.vp.toY(-bgH + scrollY),
        ctx.vp.scale, ctx.vp.scale, 1.0)
      ctx.atlas.drawFrameTL('game_ui', stageKey, ctx.vp.toX(0), ctx.vp.toY(scrollY),
        ctx.vp.scale, ctx.vp.scale, 1.0)
    } else {
      // Solid color fallback per stage
      const { Color, Draw } = ctx.rt
      const bgColors = [
        Color.new(20, 20, 60),
        Color.new(40, 15, 15),
        Color.new(15, 40, 15),
        Color.new(30, 15, 40),
        Color.new(40, 30, 10),
      ]
      const bgColor = bgColors[ctx.state.stageId % bgColors.length]
      Draw.rect(ctx.vp.toX(0), ctx.vp.toY(0), ctx.vp.toW(GW), ctx.vp.toH(GH), bgColor)
    }
  }

  // --- Enemy wave spawning ---

  function spawnEnemyWave(): void {
    const recipe = ctx.state.recipe
    if (!recipe || !recipe.enemyData) return

    const row = gs.stageEnemyList[gs.waveCount] || []
    for (let i = 0; i < row.length; i++) {
      const code = String(row[i])
      if (code === '00') continue

      const enemyType = code[0]
      const itemCode = code.slice(1)
      const eData = recipe.enemyData['enemy' + enemyType]
      if (!eData) continue

      const enemy = createEnemy(ctx, eData)
      enemy.x = 32 * i
      enemy.y = -32

      // Assign item drop
      switch (itemCode) {
        case '1':
          enemy.itemName = 'big'
          enemy.itemTexture = ['powerupBig0.gif', 'powerupBig1.gif']
          break
        case '2':
          enemy.itemName = '3way'
          enemy.itemTexture = ['powerup3way0.gif', 'powerup3way1.gif']
          break
        case '3':
          enemy.itemName = 'speed_high'
          enemy.itemTexture = ['speedupItem0.gif', 'speedupItem1.gif']
          break
        case '9':
          enemy.itemName = 'barrier'
          enemy.itemTexture = ['barrierItem0.gif', 'barrierItem1.gif']
          break
      }

      gs.enemies.push(enemy)
    }
  }

  // --- Boss spawning ---

  function spawnBoss(): void {
    const recipe = ctx.state.recipe
    if (!recipe || !recipe.bossData) return

    const bossData = recipe.bossData['boss' + String(ctx.state.stageId)]
    if (!bossData) return

    const boss = createBoss(ctx, bossData, ctx.state.stageId)
    gs.boss = boss
    boss.x = GCX - boss.width / 2
    boss.moveTargetX = boss.x
    bossEntry(ctx, boss)

    // Start boss timer after entry
    ctx.scheduler.delayedCall(6000, () => {
      gs.bossTimerStartFlg = 1
      gs.bossTimerCountDown = 99
      gs.bossTimerFrameCnt = 0
      ctx.hud.bossTimerVisible = 1
      ctx.hud.bossTimerCount = 99
    })

    ctx.hud.spBtnActive = 1
    ctx.sound.playSound('voice_another_fighter')
  }

  // --- Remote P2 ship (netplay) ---

  // Lazily spawn the second ship offset to the right when a guest takes the
  // seat. Built from the same player recipe as P1 but damage-immune in v1.
  function ensurePlayer2(): void {
    const recipe = ctx.state.recipe
    const playerData = recipe ? recipe.playerData : null
    if (!playerData) return
    const p2 = createPlayer(playerData)
    playerSetUp(p2, ctx.state.playerMaxHp || playerData.maxHp || 0,
      ctx.state.shootMode || 'normal', ctx.state.shootSpeed || 'speed_normal')
    p2.x = GW * 0.65 - p2.width / 2
    p2.y = GH - 96 - p2.height / 2
    p2.targetX = GW * 0.65
    p2.targetY = p2.y
    p2.shootOn = 1
    gs.player2 = p2
  }

  function updateRemotePlayer2(): void {
    const frame = net?.remoteInput?.() ?? null
    if (!frame) {
      // Seat empty (or guest gone) — retire the ship.
      gs.player2 = null
      return
    }
    if (!gs.player2) ensurePlayer2()
    const p2 = gs.player2
    if (!p2) return
    if (frame.touchX != null) {
      p2.targetX = frame.touchX
    } else {
      if (frame.left) p2.targetX -= PLAYER_MOVE_SPEED
      if (frame.right) p2.targetX += PLAYER_MOVE_SPEED
    }
    // Clamp to the playfield (same bounds as player 1)
    if (p2.targetX < p2.hitW / 2) p2.targetX = p2.hitW / 2
    if (p2.targetX > GW - p2.hitW / 2) p2.targetX = GW - p2.hitW / 2
    p2.shootOn = frame.fire ? 1 : 0
    playerLoop(ctx, p2)
  }

  // --- Player damage ---

  function gamePlayerDamage(amount: number): void {
    const p = gs.player
    if (!p || p.dead) return
    playerOnDamage(ctx, p, amount)
    ctx.hud.hpPercent = p.percent
    if (p.dead) {
      gs.theWorldFlg = 1
      gs.resultTimer = 0
      ctx.state.score = ctx.hud.scoreCount
      ctx.hud.spBtnActive = 0
      if (gs.boss) gs.boss.theWorld = 1
    }
  }

  // --- SP fire ---

  function startSpFire(): void {
    gs.spFireActive = 1
    gs.spFireTimer = 0
    gs.spLineH = 0
    gs.theWorldFlg = 1
    ctx.hud.spFireFlg = 1
    ctx.hud.spgageCount = 0
    ctx.hud.spBtnActive = 0
    if (gs.boss) gs.boss.theWorld = 1
    ctx.sound.playSound('g_sp_voice')
    ctx.sound.playSound('se_sp')
  }

  function updateSpFire(): void {
    gs.spFireTimer++

    if (gs.spFireTimer < 30) {
      // Phase 1: beam extends (0-30)
      gs.spLineH = (gs.spFireTimer / 30) * GH
    } else if (gs.spFireTimer < 90) {
      // Phase 2: explosions (30-90)
      if (gs.spFireTimer % 4 === 0) {
        ctx.sound.playSound('se_sp_explosion')
      }
    } else if (gs.spFireTimer === 90) {
      // Phase 3: apply damage (90)
      const spDamage = ctx.state.spDamage || 50
      // Damage all enemies
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        enemyOnDamage(ctx, gs.enemies[i], spDamage)
        if (gs.enemies[i].deadFlg) {
          hudOnEnemyKill(ctx.hud, gs.enemies[i].score, gs.enemies[i].spgage)
        }
      }
      // Damage boss
      if (gs.boss && !gs.boss.deadFlg) {
        bossOnDamage(ctx, gs.boss, spDamage)
        if (gs.boss.deadFlg) {
          hudOnEnemyKill(ctx.hud, gs.boss.score, gs.boss.spgage)
          gs.resultTimer = 0
          ctx.sound.playSound('voice_ko')
        }
      }
      // Clear projectiles
      gs.projectiles = []
    } else if (gs.spFireTimer >= 120) {
      // Phase 4: end (120)
      gs.spFireActive = 0
      gs.spLineH = 0
      ctx.hud.spFireFlg = 0
      if (gs.boss && !gs.boss.deadFlg) {
        gs.theWorldFlg = 0
        gs.boss.theWorld = 0
      }
    }
  }

  // --- Turbo mode activation effect ---

  function startTurboEffect(): void {
    gs.turboEffectActive = 1
    gs.turboImpacts = []
    gs.turboFlashAlpha = 0
    gs.turboBlackoutAlpha = 0.8
    gs.theWorldFlg = 1
    if (gs.boss) gs.boss.theWorld = 1

    ctx.sound.playSfx('se_sp')

    // Schedule 10 hit impacts at 50ms intervals (matches goki enter)
    for (let i = 0; i < 10; i++) {
      ctx.scheduler.delayedCall(50 + 50 * i, () => {
        const ix = Math.random() * (GW - 60) + 30
        const iy = Math.random() * (GH - 200) + 80
        gs.turboImpacts.push({
          x: ix,
          y: iy,
          frame: 0,
          timer: 0,
        })
        gs.turboFlashAlpha = 0.2
        ctx.sound.playSfx('se_damage')
      })
      ctx.scheduler.delayedCall(50 + 50 * i + 60, () => {
        gs.turboFlashAlpha = 0
      })
    }

    // End effect after all impacts
    ctx.scheduler.delayedCall(700, () => {
      gs.turboBlackoutAlpha = 0
      gs.turboFlashAlpha = 0
      gs.turboEffectActive = 0
      gs.theWorldFlg = 0
      if (gs.boss) gs.boss.theWorld = 0
      ctx.state.turboMode = 1
    })
  }

  function updateTurboEffect(): void {
    // Update impact animations (5 frames at ~48fps = advance every ~2 game frames)
    for (let i = gs.turboImpacts.length - 1; i >= 0; i--) {
      const imp = gs.turboImpacts[i]
      imp.timer++
      if (imp.timer % 2 === 0) imp.frame++
      if (imp.frame > 4) {
        gs.turboImpacts.splice(i, 1)
      }
    }
  }

  function drawTurboEffect(): void {
    const { Color, Draw } = ctx.rt

    // Blackout overlay
    if (gs.turboBlackoutAlpha > 0) {
      const ba = Math.floor(gs.turboBlackoutAlpha * 128)
      Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 0, ba))
    }

    // Hit impact sprites
    for (let i = 0; i < gs.turboImpacts.length; i++) {
      const imp = gs.turboImpacts[i]
      const hitFrame = 'hit' + String(Math.min(imp.frame, 4)) + '.gif'
      const fname = ctx.atlas.resolveFrameName('game_asset', hitFrame)
      if (ctx.atlas.hasFrame('game_asset', fname)) {
        ctx.atlas.drawFrame('game_asset', fname,
          ctx.vp.toX(imp.x), ctx.vp.toY(imp.y),
          ctx.vp.scale * 1.5, ctx.vp.scale * 1.5, 1.0, null)
      }
    }

    // White flash overlay
    if (gs.turboFlashAlpha > 0) {
      const fa = Math.floor(gs.turboFlashAlpha * 128)
      Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(255, 255, 255, fa))
    }
  }

  // --- Pause menu ---

  function updatePauseMenu(): void {
    // Navigate cursor
    if (ctx.input.isUpPressed()) {
      ctx.state.pauseCursor--
      if (ctx.state.pauseCursor < 0) ctx.state.pauseCursor = 1
    }
    if (ctx.input.isDownPressed()) {
      ctx.state.pauseCursor++
      if (ctx.state.pauseCursor > 1) ctx.state.pauseCursor = 0
    }

    // Confirm selection
    if (ctx.input.isConfirmPressed()) {
      if (ctx.state.pauseCursor === 0) {
        // Resume
        ctx.state.paused = 0
        ctx.scheduler.paused = false
        ctx.tweens.paused = false
      } else {
        // Quit to title
        ctx.state.paused = 0
        ctx.scheduler.paused = false
        ctx.tweens.paused = false
        ctx.sound.stopAllSounds()
        ctx.scenes.switch(SCENE_TITLE)
      }
    }
  }

  function drawPauseMenu(): void {
    const { Color, Draw } = ctx.rt

    // Dim overlay
    Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 0, 80))

    const menuX = GCX - 40
    const menuY = GCY - 40
    const white = Color.new(255, 255, 255)
    const gray = Color.new(100, 100, 100)
    const yellow = Color.new(255, 255, 0)

    // Title
    ctx.font.print(ctx.vp.toX(menuX - 2), ctx.vp.toY(menuY), 'PAUSE', white)

    // Menu items
    const items = ['RESUME', 'QUIT']
    for (let i = 0; i < items.length; i++) {
      const iy = menuY + 30 + i * 20
      const col = (i === ctx.state.pauseCursor) ? yellow : gray
      // Cursor arrow
      if (i === ctx.state.pauseCursor) {
        ctx.font.print(ctx.vp.toX(menuX - 2), ctx.vp.toY(iy), '>', yellow)
      }
      ctx.font.print(ctx.vp.toX(menuX + 10), ctx.vp.toY(iy), items[i], col)
    }

    // Controls hint
    ctx.font.print(ctx.vp.toX(menuX - 10), ctx.vp.toY(menuY + 80),
      'START:BACK', Color.new(140, 140, 140))
  }

  return { init, update, draw }
}
