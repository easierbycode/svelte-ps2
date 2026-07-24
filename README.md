# 5velte-ps2

AthenaEnv v4 (PS2 homebrew) compatibility layer for the browser — the PS2
sibling of [5velte-ph4ser](https://github.com/easierbycode/svelte-phaser).

Write game code against AthenaEnv's globals (`Screen.display`, `Draw.rect`,
`Image` with `startx/endx` crops, `Font.print`, `Pads.get(0)`, `Color.new`,
`Timer`, `std`) and run it on Phaser 4 in the browser — or take browser code
built on this surface and drop it onto a real PS2, where AthenaEnv provides
the same globals natively and the shim disappears.

## Layout

- `src/core/` — rune-free TypeScript. `createRuntime(host)` builds the
  AthenaEnv surface over a small `PS2Host` interface (draw, input, storage).
  PS2 semantics are preserved: alpha is 0–128 (128 = opaque), image flips are
  expressed by swapping `startx`/`endx`, `Screen.getMode()` reports the
  virtual 640×448 mode. Fonts carry Athena's mutable `.scale`/`.color`.
- `src/phaser/` — the Phaser 4 host. Immediate-mode calls render through
  pooled `Graphics`/`Image`/`BitmapText` objects with painter-order depths;
  crops become dynamic texture frames. You supply `resolveTexture`,
  `resolveFont`, and a `PadSource` that answers PS2 button masks from your
  page's inputs. `registerCanvasBitmapFont(scene, key)` generates a
  canvas-backed bitmap font so `new Font('default')` needs no font asset.
- `src/toolkit/` — host-agnostic game utilities written against the
  `PS2Runtime` surface (they run on the browser shim and on real hardware):
  `AtlasManager` (PNG+JSON texture atlases with crop-swap flips),
  `TweenManager`, `Scheduler` (delayed/repeating calls), `SceneManager`
  (fade transitions), `Viewport` (game→screen mapping + letterbox),
  `FixedStep` (fixed-timestep update loop), and sprite/AABB helpers.
- `src/native/` — `createNativeRuntime()` assembles a `PS2Runtime` from real
  AthenaEnv v4 globals, so code written for this module runs on a PS2
  unchanged (bundle it to a single JS file for Athena, e.g. with esbuild);
  `runNativeLoop(rt)` is the clear→callback→flip main loop.
- `src/ps2-sp/` — a complete vertical-shooter game (ported from
  2019-es7's `src/ps2` AthenaEnv port) built only on `PS2Runtime` +
  toolkit: `createGame(runtime, options?)` registers the frame callback;
  the host drives it with `runtime.tick()`. Game logic steps at a fixed
  30 Hz regardless of the host frame rate.
- `demo/` (not published) — browser demo of `ps2-sp`: `npx vite` from the
  repo root, then open `http://localhost:5180` (`?scene=game` skips the
  title, `?level=2028` swaps the Firebase level).

## Usage (Phaser 4 scene)

```ts
import { createRuntime } from '5velte-ps2'
import { createPhaserHost, type PadSource } from '5velte-ps2/phaser'

const pads: PadSource = { held: (mask) => ..., fresh: (mask) => ... }

const { host, destroy } = createPhaserHost({
  scene,
  pads,
  resolveTexture: (path) => 'tiles',
  resolveFont: () => ({ key: 'font', scale: 2 }),
})
const ps2 = createRuntime(host)

ps2.Screen.display(() => {
  ps2.Draw.rect(450, 0, 190, 448, ps2.Color.new(0, 0, 0))
  // ... AthenaEnv-style frame code
})

// in scene.update():
ps2.tick()
```

## Consumer config (Vite + Svelte apps)

Same treatment as 5velte-ph4ser — the package ships raw TypeScript source:

```ts
// vite.config.ts
resolve: { dedupe: ['phaser', 'svelte'] },
optimizeDeps: { exclude: ['svelte-phaser', '5velte-ps2'] },
```
