// Remote view for the ps2-sp browser demo (guest + spectator roles). When
// boot discovery finds a live FOREIGN session, main.ts starts this instead of
// createGame: it registers its own immediate-mode display callback that reads
// the latest streamed Snapshot from session.ts and draws it with the PS2Runtime
// draw/atlas/font APIs — no game logic, physics, or AI.
//
// The host may be either game (ps2-sp or Evil Invaders '95), so entity kinds we
// don't recognise fall back to nearest local art. Guests additionally sample
// the pad each frame to drive their remote P2 ship; spectators can take a free
// P2 seat or queue a quarter with START.

import { PAD_BUTTONS, type PS2Runtime } from '../../src/core/index.ts'
import { GCX, GCY, GH, GW, SCREEN_H, SCREEN_W } from '../../src/ps2-sp/index.ts'
import { AtlasManager, Viewport } from '../../src/toolkit/index.ts'
import { createGameFont } from '../../src/ps2-sp/font.ts'
import { createInput } from '../../src/ps2-sp/input.ts'
import type { SnapEntity } from './protocol.ts'
import { guestInput, insertQuarter, joinAsGuest, net } from './session.ts'

// Fallback frames that live in level_foo_atlas (loaded here as 'level_atlas').
const SHIP_ATLAS = 'cyber-liberty'
const SILVER = 'invaderSilver0.png'
const GOLD = 'invaderGold0.png'
const EYE = 'evilEye0.png'
const BULLET = 'invaderBullet0.png'

export function startNetView(rt: PS2Runtime): void {
  const vp = new Viewport({
    gameWidth: GW,
    gameHeight: GH,
    screenWidth: SCREEN_W,
    screenHeight: SCREEN_H,
  })
  const atlas = new AtlasManager(rt)
  // Load only what the view draws: the two shared atlases, the ship sheet, and
  // the level atlas that holds the crossplatform enemy/bullet fallback frames.
  atlas.loadAtlas('game_asset', 'assets/game_asset.png', 'assets/game_asset.json')
  atlas.loadAtlas('level_atlas', 'assets/level_foo_atlas.png', 'assets/level_foo_atlas.json')
  atlas.loadSpritesheet(SHIP_ATLAS, 'assets/cyber_liberty.png', 32, 32)
  const font = createGameFont(rt, vp)
  const input = createInput(rt)

  const { Color, Draw } = rt
  const WHITE = Color.new(255, 255, 255)
  const YELLOW = Color.new(255, 204, 34)
  const GREEN = Color.new(68, 255, 136)
  const BLUE = Color.new(136, 136, 255)

  // Resolve an enemy kind to a concrete atlas frame. Prefer a direct hit (a
  // ps2-sp host names its own level_atlas / game_asset frames); otherwise map
  // the foreign key to nearest local art by name heuristic.
  function resolveEnemy(k: string): { atlas: string; frame: string } {
    const lv = atlas.resolveFrameName('level_atlas', k)
    if (atlas.hasFrame('level_atlas', lv)) return { atlas: 'level_atlas', frame: lv }
    const ga = atlas.resolveFrameName('game_asset', k)
    if (atlas.hasFrame('game_asset', ga)) return { atlas: 'game_asset', frame: ga }
    const kl = (k || '').toLowerCase()
    let frame = EYE
    if (kl.includes('bunny')) frame = SILVER
    else if (kl.includes('gold') || kl.includes('girl')) frame = GOLD
    return { atlas: 'level_atlas', frame }
  }

  function drawSprite(atlasName: string, frame: string, gx: number, gy: number, alpha: number): void {
    const fname = atlas.resolveFrameName(atlasName, frame)
    if (!atlas.hasFrame(atlasName, fname)) return
    atlas.drawFrame(atlasName, fname, vp.toX(gx), vp.toY(gy), vp.scale, vp.scale, alpha, null)
  }

  function render(): void {
    input.update()

    const snap = net.snapshot
    if (!snap) {
      const msg = net.role === 'offline' ? 'SESSION ENDED' : 'CONNECTING...'
      font.print(vp.toX(GCX - 40), vp.toY(GH * 0.45), msg, WHITE)
      return
    }

    // Scale the foreign playfield into our 256x480 world, then to the screen.
    const sx = GW / snap.w
    const sy = GH / snap.h

    const enemies = snap.enemies ?? []
    const bullets = snap.bullets ?? []
    const fx = snap.fx ?? []
    const players = snap.players ?? []
    const quarters = snap.quarters ?? []

    // Enemies (incl. any boss the host packs in)
    for (const e of enemies) {
      const r = resolveEnemy(e.k)
      drawSprite(r.atlas, r.frame, e.x * sx, e.y * sy, 1.0)
    }

    // Bullets
    for (const b of bullets) {
      drawSprite('level_atlas', BULLET, b.x * sx, b.y * sy, 1.0)
    }

    // One-shot fx: a small flash
    for (const f of fx) {
      Draw.rect(vp.toX(f.x * sx) - 3, vp.toY(f.y * sy) - 3, vp.toW(6), vp.toH(6), Color.new(255, 240, 160, 100))
    }

    // Players -> cyber-liberty ship
    for (const pl of players) {
      drawSprite(SHIP_ATLAS, '0', pl.x * sx, pl.y * sy, pl.invuln ? 0.5 : 1.0)
    }

    // HUD from the streamed snapshot
    const hud = snap.hud
    font.print(vp.toX(4), vp.toY(4), 'P1 ' + String(hud.s1), WHITE)
    if (hud.p2) font.print(vp.toX(4), vp.toY(16), 'P2 ' + String(hud.s2), WHITE)
    font.print(vp.toX(GW - 60), vp.toY(4), 'LEVEL ' + String(hud.level), WHITE)
    if (hud.msg) font.print(vp.toX(GCX - hud.msg.length * 3), vp.toY(GCY - 40), hud.msg, YELLOW)

    // Quarter row: one small yellow coin per queued client, near the bottom
    for (let i = 0; i < quarters.length; i++) {
      const qx = GCX - (quarters.length - 1) * 7 + i * 14
      Draw.rect(vp.toX(qx) - 3, vp.toY(GH - 18), vp.toW(6), vp.toH(6), YELLOW)
    }

    // Role call-to-action + input
    const seatFree = !net.meta?.p2
    if (net.role === 'spectator') {
      font.print(vp.toX(GCX - 55), vp.toY(GH - 48), seatFree ? 'START = TAKE P2 SEAT' : 'START = INSERT QUARTER', seatFree ? GREEN : YELLOW)
      font.print(vp.toX(GCX - 48), vp.toY(GH - 34), 'WATCHING LIVE GAME', BLUE)
      if (input.isStartPressed()) {
        if (seatFree) void joinAsGuest()
        else void insertQuarter()
      }
    } else if (net.role === 'guest') {
      font.print(vp.toX(GCX - 24), vp.toY(GH - 34), 'YOU ARE P2', GREEN)
      // Sample the pad each frame; session.ts streams it at its own cadence.
      guestInput.left = input.isLeftHeld()
      guestInput.right = input.isRightHeld()
      guestInput.fire = input.isDown(PAD_BUTTONS.CROSS)
      guestInput.touchX = null
    }
  }

  rt.Screen.display(render)
}
