// Phaser 4 host for the 5velte-ps2 runtime.
//
// AthenaEnv redraws the whole screen inside Screen.display(cb) every frame;
// Phaser retains display objects. The bridge: pooled Graphics / Image /
// BitmapText objects are (re)configured in call order each tick, with an
// increasing depth counter so interleaved rect/image/text draws stack
// exactly like the PS2's painter ordering. Unused pool entries are hidden
// at endFrame.
//
// Usage:
//   const { host, destroy } = createPhaserHost({ scene, pads, ... })
//   const runtime = createRuntime(host)
//   // scene.update(): runtime.tick()

import Phaser from 'phaser'
import type { PS2Host, RGBA, HostImageHandle, HostFontHandle, DrawImageOptions } from '../core/host.ts'

/** Answers PS2 button-mask queries (Pads.* masks) from the web page's inputs. */
export interface PadSource {
  held(mask: number): boolean
  fresh(mask: number): boolean
  /** analog stick axis, web Gamepad convention (-1..1, up/left negative) */
  axis?(name: 'lx' | 'ly' | 'rx' | 'ry'): number
}

export interface PhaserFontConfig {
  /** bitmap font key already loaded in the scene */
  key: string
  /** font size passed to BitmapText (defaults to the font's own size) */
  size?: number
  /** extra scale applied to printed text (PS2 TTFs are larger than GB fonts) */
  scale?: number
}

export interface PhaserHostOptions {
  scene: Phaser.Scene
  /** virtual PS2 screen mode, default 640x448 */
  screen?: { width: number; height: number }
  /**
   * AthenaEnv clears the frame before each Screen.display callback; the
   * host mirrors that with an opaque rect (default black). Pass false to
   * let the Phaser scene show through instead.
   */
  clear?: false | { r: number; g: number; b: number }
  pads: PadSource
  /** map an Athena asset path (e.g. "assets/tiles/tiles.png") to a Phaser texture key */
  resolveTexture: (path: string) => string
  /** map an Athena font path (e.g. "assets/fonts/mania.ttf") to a loaded bitmap font */
  resolveFont: (path: string) => PhaserFontConfig
  storage?: {
    loadFile(path: string): string | null
    writeFile(path: string, data: string): void
  }
}

interface PhaserImageHandle extends HostImageHandle {
  key: string
}

interface PhaserFontHandle extends HostFontHandle {
  key: string
  size: number | undefined
  scale: number
}

const colorToInt = (c: RGBA) => Phaser.Display.Color.GetColor(c.r, c.g, c.b)

export function createPhaserHost(options: PhaserHostOptions): { host: PS2Host; destroy(): void } {
  const scene = options.scene
  const screen = options.screen ?? { width: 640, height: 448 }

  const rects: Phaser.GameObjects.Graphics[] = []
  const images: Phaser.GameObjects.Image[] = []
  const texts: Phaser.GameObjects.BitmapText[] = []
  let rectCursor = 0
  let imageCursor = 0
  let textCursor = 0
  let depth = 0

  let measurer: Phaser.GameObjects.BitmapText | null = null

  const storage = options.storage ?? {
    loadFile(path: string) {
      return localStorage.getItem(`5velte-ps2:${path}`)
    },
    writeFile(path: string, data: string) {
      localStorage.setItem(`5velte-ps2:${path}`, data)
    },
  }

  const hideFrom = (pool: { setVisible(v: boolean): unknown; visible: boolean }[], cursor: number) => {
    for (let i = cursor; i < pool.length && pool[i].visible; i++) pool[i].setVisible(false)
  }

  const clearColor = options.clear === false ? null : { a: 1, ...(options.clear ?? { r: 0, g: 0, b: 0 }) }

  const host: PS2Host = {
    screen,

    beginFrame() {
      rectCursor = 0
      imageCursor = 0
      textCursor = 0
      depth = 0
      if (clearColor) this.drawRect(0, 0, screen.width, screen.height, clearColor)
    },

    endFrame() {
      hideFrom(rects, rectCursor)
      hideFrom(images, imageCursor)
      hideFrom(texts, textCursor)
    },

    drawRect(x, y, w, h, color) {
      let g = rects[rectCursor]
      if (!g) {
        g = scene.add.graphics()
        rects.push(g)
      }
      rectCursor++
      g.clear()
      g.fillStyle(colorToInt(color), color.a)
      g.fillRect(x, y, w, h)
      g.setDepth(depth++)
      g.setVisible(true)
    },

    createImage(path): PhaserImageHandle {
      const key = options.resolveTexture(path)
      if (!scene.textures.exists(key)) {
        throw new Error(`5velte-ps2: texture "${key}" (for "${path}") is not loaded`)
      }
      const source = scene.textures.get(key).getSourceImage()
      return { key, width: source.width, height: source.height }
    },

    drawImage(handle, sx, sy, sw, sh, dx, dy, dw, dh, opts: DrawImageOptions) {
      const { key } = handle as PhaserImageHandle
      const frameName = `5vps2:${sx},${sy},${sw},${sh}`
      const texture = scene.textures.get(key)
      if (!texture.has(frameName)) {
        texture.add(frameName, 0, sx, sy, sw, sh)
      }

      let img = images[imageCursor]
      if (!img) {
        img = scene.add.image(0, 0, key, frameName).setOrigin(0, 0)
        images.push(img)
      }
      imageCursor++
      img.setTexture(key, frameName)
      img.setFlip(opts.flipX, opts.flipY)
      img.setPosition(dx, dy)
      img.setDisplaySize(dw, dh)
      // pooled images keep their last tint/alpha — reset every draw
      const color = opts.color
      img.setAlpha(color?.a ?? 1)
      if (color && (color.r !== 255 || color.g !== 255 || color.b !== 255)) {
        img.setTint(colorToInt(color))
      } else {
        img.clearTint()
      }
      img.setDepth(depth++)
      img.setVisible(true)
    },

    createFont(path): PhaserFontHandle {
      const config = options.resolveFont(path)
      return { key: config.key, size: config.size, scale: config.scale ?? 1 }
    },

    drawText(font, x, y, text, color, scale) {
      const f = font as PhaserFontHandle
      let t = texts[textCursor]
      if (!t) {
        t = scene.add.bitmapText(0, 0, f.key, '', f.size)
        texts.push(t)
      }
      textCursor++
      if (t.font !== f.key) t.setFont(f.key, f.size)
      t.setText(text)
      t.setScale(f.scale * (scale ?? 1))
      t.setPosition(x, y)
      if (color) {
        t.setTint(colorToInt(color))
        t.setAlpha(color.a)
      } else {
        t.clearTint()
        t.setAlpha(1)
      }
      t.setDepth(depth++)
      t.setVisible(true)
    },

    measureText(font, text, scale) {
      const f = font as PhaserFontHandle
      if (!measurer) {
        measurer = scene.add.bitmapText(0, 0, f.key, '', f.size).setVisible(false)
      }
      if (measurer.font !== f.key) measurer.setFont(f.key, f.size)
      measurer.setText(text)
      const s = f.scale * (scale ?? 1)
      return { width: measurer.width * s, height: measurer.height * s }
    },

    padHeld(mask) {
      return options.pads.held(mask)
    },

    padFresh(mask) {
      return options.pads.fresh(mask)
    },

    padAxis(axis) {
      // web -1..1 to AthenaEnv's asymmetric -127..128 (raw 0..255 - 127)
      const v = options.pads.axis?.(axis) ?? 0
      return Math.round(v < 0 ? v * 127 : v * 128)
    },

    loadFile(path) {
      return storage.loadFile(path)
    },

    writeFile(path, data) {
      storage.writeFile(path, data)
    },
  }

  const destroy = () => {
    for (const g of rects) g.destroy()
    for (const i of images) i.destroy()
    for (const t of texts) t.destroy()
    measurer?.destroy()
    rects.length = 0
    images.length = 0
    texts.length = 0
    measurer = null
  }

  return { host, destroy }
}

export { registerCanvasBitmapFont } from './retro-font.ts'
export type { CanvasBitmapFontOptions } from './retro-font.ts'
