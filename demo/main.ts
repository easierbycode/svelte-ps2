// Browser demo: boots Phaser 4, preloads the game's atlases and JSON,
// builds the 5velte-ps2 runtime over the Phaser host, and runs the ps2-sp
// game. URL params: ?scene=game|adventure|continue|ending skips the title,
// ?level=2028 swaps the Firebase level (default foo).

import Phaser from 'phaser'
import { createRuntime, type PS2Runtime } from '../src/core/index.ts'
import { createPhaserHost, registerCanvasBitmapFont } from '../src/phaser/index.ts'
import { createGame, type GameOptions } from '../src/ps2-sp/index.ts'
import { createKeyboardPads } from './pads.ts'
import { createHostNet } from './net/host.ts'
import { startNetView } from './net/netview.ts'
import { becomeHost, checkRemoteSession, net, spectate } from './net/session.ts'

// Discovery may hang on a flaky network — cap it so local play always boots.
const NET_DISCOVERY_TIMEOUT_MS = 2500

const TEXTURES: Record<string, string> = {
  'assets/game_ui.png': 'game_ui',
  'assets/game_asset.png': 'game_asset',
  'assets/cyber_liberty.png': 'cyber_liberty',
  'assets/level_foo_atlas.png': 'level_atlas',
  'assets/level_2028_atlas.png': 'level_atlas_2028',
}

const TEXT_FILES = [
  'assets/game.json',
  'assets/game_ui.json',
  'assets/game_asset.json',
  'assets/level_foo.json',
  'assets/level_foo_atlas.json',
  'assets/level_2028.json',
  'assets/level_2028_atlas.json',
]

class DemoScene extends Phaser.Scene {
  rt: PS2Runtime | null = null

  preload() {
    for (const [path, key] of Object.entries(TEXTURES)) this.load.image(key, path)
    for (const path of TEXT_FILES) this.load.text(path, path)
  }

  create() {
    registerCanvasBitmapFont(this, 'ps2font', { fontSize: 12 })

    const { host } = createPhaserHost({
      scene: this,
      pads: createKeyboardPads(this),
      resolveTexture: (path) => TEXTURES[path] ?? path,
      resolveFont: () => ({ key: 'ps2font', scale: 1 }),
      storage: {
        loadFile: (path) => {
          if (this.cache.text.exists(path)) return this.cache.text.get(path) as string
          try {
            return localStorage.getItem(`5velte-ps2:${path}`)
          } catch {
            return null
          }
        },
        writeFile: (path, data) => {
          try {
            localStorage.setItem(`5velte-ps2:${path}`, data)
          } catch {
            // storage unavailable (private mode) — high score just won't persist
          }
        },
      },
    })

    const rt = createRuntime(host)
    const params = new URLSearchParams(location.search)
    const options: GameOptions = {}
    const startScene = params.get('scene')
    if (startScene) options.startScene = startScene
    if (params.get('level') === '2028') {
      options.level = {
        dataPath: 'assets/level_2028.json',
        atlasPngPath: 'assets/level_2028_atlas.png',
        atlasJsonPath: 'assets/level_2028_atlas.json',
      }
    }

    this.rt = rt
    // Async netplay discovery: rt.tick() below is a harmless no-op until a
    // display callback is registered (by createGame or startNetView).
    void this.bootNet(rt, options)
  }

  async bootNet(rt: PS2Runtime, options: GameOptions) {
    let remoteLive = false
    try {
      await Promise.race([
        checkRemoteSession(),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('net discovery timeout')), NET_DISCOVERY_TIMEOUT_MS),
        ),
      ])
      remoteLive = net.remoteLive
    } catch {
      // Any discovery failure (offline, timeout) falls through to local play.
      remoteLive = false
    }

    if (remoteLive) {
      // A live foreign session exists -> render it view-only. Enter as a
      // spectator (START in the view can then take a free P2 seat or queue a
      // quarter); do NOT create the local game.
      await spectate()
      startNetView(rt)
      ;(window as unknown as Record<string, unknown>).ps2 = { rt, mode: 'netview' }
      return
    }

    // Nothing live -> play locally and host so others can join / spectate.
    const hostNet = createHostNet()
    const game = createGame(rt, { ...options, net: hostNet })
    ;(window as unknown as Record<string, unknown>).ps2 = { rt, game, net: hostNet }
    void becomeHost('ps2sp')
  }

  update() {
    this.rt?.tick()
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 640,
  height: 448,
  parent: 'app',
  backgroundColor: '#000000',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: DemoScene,
})
