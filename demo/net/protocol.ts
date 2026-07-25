// Crossplatform netplay protocol over Firebase RTDB (plain REST + SSE).
// KEEP IN SYNC with C:/CODE/5velte-ps2/demo/net/protocol.ts — both games speak
// exactly this schema. Whoever starts a game first hosts their own game;
// a second player starting a game on any platform takes the remote P2 seat;
// everyone else is view-only and may queue a quarter for the next game.

export const RTDB_URL = 'https://evil-invaders-default-rtdb.firebaseio.com'
export const ROOM_PATH = 'netplay/rooms/main'
export const sessionPath = (id: string) => `netplay/sessions/${id}`

export const HEARTBEAT_MS = 3000 // host bumps meta.t at least this often
export const STALE_MS = 12000 // room/meta older than this = dead session
export const SNAP_INTERVAL_MS = 100 // host snapshot cadence (10Hz)
export const INPUT_INTERVAL_MS = 50 // guest input cadence (20Hz)

export type GameKind = 'ei95' | 'ps2sp'
export type NetRole = 'offline' | 'host' | 'guest' | 'spectator'

export interface RoomDoc {
  sessionId: string
  game: GameKind
  hostId: string
  status: 'open' | 'ended'
  t: number // host heartbeat, ms epoch
}

export interface SessionMeta {
  game: GameKind
  hostId: string
  created: number
  status: 'open' | 'ended'
  p2: string | null // clientId holding the remote P2 seat
  t: number // host heartbeat
}

// Guest -> host. touchX is in the HOST game's world coordinates (the guest
// converts using the streamed playfield width); null = touch inactive.
export interface InputFrame {
  seq: number
  left: boolean
  right: boolean
  fire: boolean
  touchX: number | null
  t: number
}

export interface SnapPlayer {
  i: 1 | 2
  x: number
  y: number
  dead: boolean
  invuln: boolean
}

// k = host-local texture key, a = host-local animation key (may be missing).
// Clients that don't have those assets map k/a to their nearest local art.
export interface SnapEntity {
  id: number
  k: string
  a?: string
  f?: string | number // current frame name/index when not animated
  x: number
  y: number
  r?: number // angle degrees
  s?: number // scale
  fx?: boolean // flipX
  vx?: number
  vy?: number
}

export interface SnapHud {
  status: 'title' | 'playing' | 'gameover'
  level: number
  msg: string
  s1: number
  s2: number
  l1: number
  l2: number
  p2: boolean
}

export interface Snapshot {
  seq: number
  t: number
  w: number // host playfield width (world coords)
  h: number // host playfield height
  hud: SnapHud
  players: SnapPlayer[]
  enemies: SnapEntity[]
  bullets: SnapEntity[]
  fx: SnapEntity[]
  quarters: string[] // clientIds in line, first = next up
}

export function freshRoom(room: RoomDoc | null, now = Date.now()): room is RoomDoc {
  return !!room && room.status === 'open' && now - room.t < STALE_MS
}

export function makeClientId(storage: { getItem(k: string): string | null; setItem(k: string, v: string): void }, key: string): string {
  let id = storage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    storage.setItem(key, id)
  }
  return id
}
