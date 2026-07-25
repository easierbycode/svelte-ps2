// Netplay session management for the ps2-sp browser demo — a framework-free
// port of C:/CODE/95-demo-sp/src/net/session.ts (same negotiation flow, plain
// state + callbacks instead of svelte stores). Roles: host (runs the real
// game, publishes snapshots), guest (holds the remote P2 seat: sends inputs,
// renders snapshots), spectator (renders snapshots, may queue a quarter for
// the next game).
import {
  HEARTBEAT_MS,
  INPUT_INTERVAL_MS,
  ROOM_PATH,
  STALE_MS,
  freshRoom,
  makeClientId,
  sessionPath,
  type GameKind,
  type InputFrame,
  type NetRole,
  type RoomDoc,
  type SessionMeta,
  type Snapshot,
} from './protocol.ts'
import { dbDelete, dbGet, dbPatch, dbPut, dbPutIfMatch, dbStream } from './rtdb.ts'

// sessionStorage: per-TAB identity, so a second tab in the same browser is a
// distinct netplay client (localStorage would make every tab "the host")
export const clientId = makeClientId(sessionStorage, 'ps2sp-netplay-id')

// Plain mutable state, mirrored by emit() to subscribers. Read net.* directly
// per-frame; subscribe via onNetChange for role transitions.
export interface NetState {
  role: NetRole
  snapshot: Snapshot | null
  meta: SessionMeta | null
  // quarter queue (clientIds, first = next up) — host polls it, remotes get
  // it from snapshots; everyone renders the same coin row from this list
  quarters: string[]
  // true while a live remote session exists that this client could join/watch
  remoteLive: boolean
  seatFree: boolean
}

export const net: NetState = {
  role: 'offline',
  snapshot: null,
  meta: null,
  quarters: [],
  remoteLive: false,
  seatFree: false,
}

type NetListener = (state: NetState) => void
const listeners: NetListener[] = []

export function onNetChange(fn: NetListener): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

function emit(): void {
  for (const fn of listeners.slice()) fn(net)
}

// Latest remote-P2 input frame, read by the host's game scene each step
// (plain object on purpose — read per-frame, not reactive).
export const remoteP2Input: { frame: InputFrame | null } = { frame: null }

let sessionId: string | null = null
let stopStreams: Array<() => void> = []
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function cleanup() {
  stopStreams.forEach((s) => s())
  stopStreams = []
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
  remoteP2Input.frame = null
}

// ---- discovery ------------------------------------------------------------

export async function checkRemoteSession(): Promise<void> {
  const room = await dbGet<RoomDoc>(ROOM_PATH)
  if (freshRoom(room) && room.hostId !== clientId) {
    const meta = await dbGet<SessionMeta>(sessionPath(room.sessionId) + '/meta')
    const live = !!meta && meta.status === 'open' && Date.now() - meta.t < STALE_MS
    net.remoteLive = live
    net.seatFree = live && !meta!.p2
    if (live) sessionId = room.sessionId
  } else {
    net.remoteLive = false
    net.seatFree = false
  }
  emit()
}

// ---- host -----------------------------------------------------------------

export async function becomeHost(game: GameKind = 'ps2sp'): Promise<void> {
  // Never host over a live foreign session — "a second player starting a game
  // joins the existing player's game": take the P2 seat if free, else watch.
  const room = await dbGet<RoomDoc>(ROOM_PATH)
  if (freshRoom(room) && room.hostId !== clientId) {
    const meta = await dbGet<SessionMeta>(sessionPath(room.sessionId) + '/meta')
    if (meta && meta.status === 'open') {
      sessionId = room.sessionId
      net.remoteLive = true
      emit()
      if (!meta.p2 && (await joinAsGuest())) return
      await spectate()
      return
    }
  }
  cleanup()
  sessionId = `${game}-${Date.now().toString(36)}-${clientId}`
  const now = Date.now()
  const meta: SessionMeta = { game, hostId: clientId, created: now, status: 'open', p2: null, t: now }
  await dbPut(sessionPath(sessionId), { meta })
  await dbPut(ROOM_PATH, { sessionId, game, hostId: clientId, status: 'open', t: now } satisfies RoomDoc)
  net.role = 'host'
  emit()

  // guest inputs + seat/quarters stream
  stopStreams.push(
    dbStream<{ meta?: SessionMeta; inputs?: { p2?: InputFrame } }>(sessionPath(sessionId), (v) => {
      if (!v) return
      if (v.inputs?.p2) remoteP2Input.frame = v.inputs.p2
      if (v.meta) {
        net.meta = v.meta
        emit()
      }
    }),
  )

  heartbeatTimer = setInterval(() => {
    const t = Date.now()
    void dbPatch(sessionPath(sessionId!) + '/meta', { t })
    void dbPatch(ROOM_PATH, { t })
  }, HEARTBEAT_MS)

  window.addEventListener('beforeunload', endHosting)
}

export function endHosting(): void {
  if (net.role !== 'host' || !sessionId) return
  const body = JSON.stringify({ status: 'ended' })
  navigator.sendBeacon?.(`${sessionPath(sessionId)}/meta.json`, body)
  void dbPatch(sessionPath(sessionId) + '/meta', { status: 'ended' })
  void dbPatch(ROOM_PATH, { status: 'ended' })
  cleanup()
  net.role = 'offline'
  emit()
}

export async function publishSnapshot(snap: Snapshot): Promise<void> {
  if (!sessionId) return
  await dbPut(sessionPath(sessionId) + '/snap', snap)
}

// Host: read + consume the quarter queue (ordered by push key).
export async function takeNextQuarter(): Promise<string | null> {
  if (!sessionId) return null
  const q = await dbGet<Record<string, { id: string }>>(sessionPath(sessionId) + '/quarters')
  if (!q) return null
  const keys = Object.keys(q).sort()
  if (keys.length === 0) return null
  const first = q[keys[0]]
  await dbDelete(sessionPath(sessionId) + `/quarters/${keys[0]}`)
  await dbPatch(sessionPath(sessionId) + '/meta', { p2: first.id })
  return first.id
}

export async function getQuarterIds(): Promise<string[]> {
  if (!sessionId) return []
  const q = await dbGet<Record<string, { id: string }>>(sessionPath(sessionId) + '/quarters')
  if (!q) return []
  return Object.keys(q)
    .sort()
    .map((k) => q[k].id)
}

export async function clearRemoteSeat(): Promise<void> {
  if (!sessionId) return
  await dbPatch(sessionPath(sessionId) + '/meta', { p2: null })
}

// ---- guest / spectator ----------------------------------------------------

async function watchSession(role: 'guest' | 'spectator'): Promise<boolean> {
  if (!sessionId) return false
  cleanup()
  net.role = role
  emit()
  stopStreams.push(
    dbStream<{ meta?: SessionMeta; snap?: Snapshot }>(sessionPath(sessionId), (v) => {
      if (!v) return
      if (v.snap) {
        net.snapshot = v.snap
        // Firebase strips empty arrays — always default the collections
        net.quarters = v.snap.quarters ?? []
        emit()
      }
      if (v.meta) {
        net.meta = v.meta
        emit()
        const me = net.role
        // host gave the seat to this client (quarter promotion)
        if (me === 'spectator' && v.meta.p2 === clientId) upgradeToGuest()
        // seat went to someone else (quarter rotation) -> back to watching
        if (me === 'guest' && v.meta.p2 !== clientId) downgradeToSpectator()
        // leave only on explicit end or a truly dead host (60s) — transient
        // staleness (throttled background host tab) must not drop the room
        if (v.meta.status === 'ended' || Date.now() - v.meta.t > 60_000) leaveRemote()
      }
    }),
  )
  return true
}

function downgradeToSpectator(): void {
  net.role = 'spectator'
  if (inputTimer) clearInterval(inputTimer)
  inputTimer = null
  emit()
}

let inputSeq = 0
let inputTimer: ReturnType<typeof setInterval> | null = null
// current local input state, written by the guest input collector (netview)
export const guestInput = { left: false, right: false, fire: false, touchX: null as number | null }

function resetGuestInput(): void {
  guestInput.left = false
  guestInput.right = false
  guestInput.fire = false
  guestInput.touchX = null
}

export async function joinAsGuest(): Promise<boolean> {
  if (!sessionId) return false
  const claimed = await dbPutIfMatch(sessionPath(sessionId) + '/meta/p2', clientId, null)
  if (!claimed) return false
  resetGuestInput()
  await watchSession('guest')
  startInputSender()
  return true
}

function upgradeToGuest(): void {
  resetGuestInput()
  net.role = 'guest'
  startInputSender()
  emit()
}

function startInputSender(): void {
  if (inputTimer) clearInterval(inputTimer)
  inputTimer = setInterval(() => {
    if (net.role !== 'guest' || !sessionId) return
    const frame: InputFrame = { seq: ++inputSeq, ...guestInput, t: Date.now() }
    void dbPut(sessionPath(sessionId) + '/inputs/p2', frame)
  }, INPUT_INTERVAL_MS)
  stopStreams.push(() => {
    if (inputTimer) clearInterval(inputTimer)
    inputTimer = null
  })
}

export async function spectate(): Promise<boolean> {
  return watchSession('spectator')
}

export async function insertQuarter(): Promise<void> {
  if (!sessionId) return
  // push-style unique key: timestamp + client id keeps FIFO order
  const key = `${Date.now().toString().padStart(15, '0')}-${clientId}`
  await dbPut(sessionPath(sessionId) + `/quarters/${key}`, { id: clientId, t: Date.now() })
}

export function leaveRemote(): void {
  cleanup()
  net.role = 'offline'
  net.snapshot = null
  net.meta = null
  net.remoteLive = false
  emit()
  void checkRemoteSession()
}

// DEV console access for netplay debugging
if (typeof window !== 'undefined') {
  ;(window as unknown as { __net: unknown }).__net = {
    clientId,
    net,
    remoteP2Input,
    guestInput,
    joinAsGuest,
    spectate,
    insertQuarter,
    checkRemoteSession,
    leaveRemote,
  }
}
