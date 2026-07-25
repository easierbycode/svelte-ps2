// Host side of crossplatform netplay for the ps2-sp browser demo. When the
// local demo runs a game and no foreign session is live, main.ts becomes the
// host (session.becomeHost) and wires this NetService into createGame. Each
// fixed step the game scene hands out its live view; here we turn it into a
// wire Snapshot (throttled to SNAP_INTERVAL_MS) and publish it to RTDB, poll
// the quarter queue, feed the remote P2 input frame back to the scene, and
// rotate the queue on a post-gameover retry.
//
// The Snapshot schema is shared verbatim with the Evil Invaders '95 web game
// (demo/net/protocol.ts), so an ei95 client can spectate or take the P2 seat.

import { GW, GH, type NetService } from '../../src/ps2-sp/index.ts'
import {
  SNAP_INTERVAL_MS,
  type SnapEntity,
  type SnapHud,
  type SnapPlayer,
  type Snapshot,
} from './protocol.ts'
import { getQuarterIds, net, publishSnapshot, remoteP2Input, takeNextQuarter } from './session.ts'

// Structural views of the scene entities — only the fields the snapshot reads.
interface ViewBullet {
  x: number
  y: number
  width: number
  height: number
}

interface ViewPlayer {
  x: number
  y: number
  width: number
  height: number
  dead: number
  hp: number
  damageAnimFlg: number
  barrierFlg: number
  bullets: ViewBullet[]
}

interface ViewEnemy {
  x: number
  y: number
  width: number
  height: number
  name: string
  frames: string[]
  animFrame: number
  dead: number
}

interface ViewProjectile {
  x: number
  y: number
  dead: number
  deadFlg: number
}

interface ViewBoss {
  x: number
  y: number
  width: number
  height: number
  name: string
  dead: number
}

interface SceneView {
  player: ViewPlayer | null
  player2: ViewPlayer | null
  enemies: ViewEnemy[]
  projectiles: ViewProjectile[]
  boss: ViewBoss | null
  state: { score: number; stageId: number }
}

export function createHostNet(): NetService {
  let seq = 0
  let lastSnap = 0
  let quarterPoll = 0
  let nidCounter = 0
  // Stable per-entity ids: assigned on first sight, GC'd with the entity.
  const nidMap = new WeakMap<object, number>()
  let prevStatus: SnapHud['status'] = 'playing'

  const nid = (obj: object): number => {
    let id = nidMap.get(obj)
    if (id === undefined) {
      id = ++nidCounter
      nidMap.set(obj, id)
    }
    return id
  }

  const packPlayer = (i: 1 | 2, p: ViewPlayer): SnapPlayer => ({
    i,
    x: Math.round(p.x + p.width / 2),
    y: Math.round(p.y + p.height / 2),
    dead: !!p.dead,
    invuln: !!(p.damageAnimFlg || p.barrierFlg),
  })

  function onSceneTick(raw: unknown): void {
    if (net.role !== 'host') return
    const now = Date.now()
    if (now - lastSnap < SNAP_INTERVAL_MS) return
    lastSnap = now

    const view = raw as SceneView

    // Poll the quarter queue roughly every 2s (10Hz snapshots -> every 20th).
    quarterPoll += 1
    if (quarterPoll >= 20) {
      quarterPoll = 0
      void getQuarterIds().then((ids) => {
        net.quarters = ids
      })
    }

    const players: SnapPlayer[] = []
    if (view.player) players.push(packPlayer(1, view.player))
    if (view.player2) players.push(packPlayer(2, view.player2))

    const enemies: SnapEntity[] = []
    for (const e of view.enemies) {
      if (e.dead) continue
      const frame = e.frames && e.frames.length > 0
        ? e.frames[Math.min(e.animFrame, e.frames.length - 1)]
        : (e.name || 'enemy')
      enemies.push({
        id: nid(e),
        k: frame,
        x: Math.round(e.x + e.width / 2),
        y: Math.round(e.y + e.height / 2),
      })
    }
    if (view.boss && !view.boss.dead) {
      enemies.push({
        id: nid(view.boss),
        k: view.boss.name || 'boss',
        x: Math.round(view.boss.x + view.boss.width / 2),
        y: Math.round(view.boss.y + view.boss.height / 2),
      })
    }

    const bullets: SnapEntity[] = []
    for (const proj of view.projectiles) {
      if (proj.dead || proj.deadFlg) continue
      bullets.push({ id: nid(proj), k: 'invaderBullet', x: Math.round(proj.x), y: Math.round(proj.y) })
    }
    for (const src of [view.player, view.player2]) {
      if (!src) continue
      for (const b of src.bullets) {
        bullets.push({
          id: nid(b),
          k: 'playerBullet',
          x: Math.round(b.x + b.width / 2),
          y: Math.round(b.y + b.height / 2),
        })
      }
    }

    const alive = !!view.player && !view.player.dead && view.player.hp > 0
    const status: SnapHud['status'] = alive ? 'playing' : 'gameover'

    // Host retry: a gameover -> playing transition means a new round started,
    // so the first queued quarter takes the P2 seat (no-op if the queue is
    // empty, which keeps the current guest).
    if (prevStatus === 'gameover' && status === 'playing') void takeNextQuarter()
    prevStatus = status

    const hud: SnapHud = {
      status,
      level: view.state.stageId,
      msg: alive ? '' : 'GAME OVER',
      s1: view.state.score,
      s2: 0,
      l1: alive ? 1 : 0,
      l2: view.player2 ? 1 : 0,
      p2: !!view.player2,
    }

    const snap: Snapshot = {
      seq: ++seq,
      t: now,
      w: GW,
      h: GH,
      hud,
      players,
      enemies,
      bullets,
      fx: [],
      quarters: net.quarters,
    }
    void publishSnapshot(snap)
  }

  function remoteInput(): { left: boolean; right: boolean; fire: boolean; touchX: number | null } | null {
    if (net.role !== 'host') return null
    // Only drive P2 while a guest actually holds the seat.
    if (!net.meta?.p2) return null
    const f = remoteP2Input.frame
    if (!f) return null
    // Retire the seat if the guest stopped streaming (tab closed / dropped).
    if (Date.now() - f.t > 3000) return null
    return { left: f.left, right: f.right, fire: f.fire, touchX: f.touchX }
  }

  function onRetry(): void {
    void takeNextQuarter()
  }

  return { onSceneTick, remoteInput, onRetry }
}
