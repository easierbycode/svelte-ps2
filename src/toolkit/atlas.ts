// Texture-atlas manager: loads a PNG atlas plus JSON frame data (array or
// hash `frames` format, optional meta.ps2DisplayScale) and draws named
// sub-regions by cropping one shared image via startx/starty/endx/endy.
// Also builds uniform-grid spritesheets without JSON. Negative scales flip
// by swapping the crop edges; frame names fall back across .gif/.png.

import type { PS2ImageInstance, PS2Runtime } from '../core/index.ts'

export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
  dw: number
  dh: number
}

export interface AtlasEntry {
  image: PS2ImageInstance
  frames: Record<string, AtlasFrame>
  displayScale: number
  texWidth: number
  texHeight: number
}

interface AtlasJsonRect {
  x: number
  y: number
  w: number
  h: number
}

interface AtlasJsonArrayEntry {
  filename: string
  frame: AtlasJsonRect
}

interface AtlasJson {
  frames?: AtlasJsonArrayEntry[] | Record<string, { frame: AtlasJsonRect }>
  meta?: { ps2DisplayScale?: number }
}

export class AtlasManager {
  #rt: Pick<PS2Runtime, 'Image' | 'std' | 'Color'>
  #atlases: Record<string, AtlasEntry> = {}

  constructor(rt: Pick<PS2Runtime, 'Image' | 'std' | 'Color'>) {
    this.#rt = rt
  }

  loadAtlas(name: string, pngPath: string, jsonPath: string): boolean {
    const jsonText = this.#rt.std.loadFile(jsonPath)
    if (!jsonText) {
      console.log('[Atlas] Failed to load JSON: ' + jsonPath)
      return false
    }
    const data = JSON.parse(jsonText) as AtlasJson
    const img = new this.#rt.Image(pngPath)

    // Display scale: if atlas was downscaled for PS2, this restores original sizes
    const ds = (data.meta && data.meta.ps2DisplayScale) ? data.meta.ps2DisplayScale : 1

    const frames: Record<string, AtlasFrame> = {}
    if (data.frames) {
      if (Array.isArray(data.frames)) {
        for (let i = 0; i < data.frames.length; i++) {
          const f = data.frames[i]
          frames[f.filename] = {
            x: f.frame.x,
            y: f.frame.y,
            w: f.frame.w,
            h: f.frame.h,
            dw: f.frame.w * ds,
            dh: f.frame.h * ds,
          }
        }
      } else {
        const keys = Object.keys(data.frames)
        for (let k = 0; k < keys.length; k++) {
          const key = keys[k]
          const fr = data.frames[key].frame
          frames[key] = {
            x: fr.x,
            y: fr.y,
            w: fr.w,
            h: fr.h,
            dw: fr.w * ds,
            dh: fr.h * ds,
          }
        }
      }
    }

    const tex = img as PS2ImageInstance & { texWidth?: number; texHeight?: number }
    this.#atlases[name] = {
      image: img,
      frames,
      displayScale: ds,
      texWidth: tex.texWidth || img.width,
      texHeight: tex.texHeight || img.height,
    }
    console.log('[Atlas] Loaded ' + name + ' with ' + Object.keys(frames).length +
      ' frames (displayScale=' + ds + ')')
    return true
  }

  // Load a grid-based spritesheet (uniform frame size, no JSON metadata)
  loadSpritesheet(name: string, pngPath: string, frameWidth: number, frameHeight: number): void {
    const img = new this.#rt.Image(pngPath)
    const imgW = img.width
    const imgH = img.height
    const cols = Math.floor(imgW / frameWidth)
    const rows = Math.floor(imgH / frameHeight)
    const frames: Record<string, AtlasFrame> = {}

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        frames[String(idx)] = {
          x: c * frameWidth,
          y: r * frameHeight,
          w: frameWidth,
          h: frameHeight,
          dw: frameWidth,
          dh: frameHeight,
        }
      }
    }

    this.#atlases[name] = {
      image: img,
      frames,
      displayScale: 1,
      texWidth: imgW,
      texHeight: imgH,
    }
    console.log('[Atlas] Loaded spritesheet ' + name + ' (' + cols + 'x' + rows +
      ' = ' + (cols * rows) + ' frames, ' + frameWidth + 'x' + frameHeight + ')')
  }

  get(name: string): AtlasEntry | null {
    return this.#atlases[name] || null
  }

  getFrame(name: string, frame: string): AtlasFrame | null {
    const atlas = this.#atlases[name]
    if (!atlas) return null
    return atlas.frames[frame] || null
  }

  hasFrame(name: string, frame: string): boolean {
    const atlas = this.#atlases[name]
    if (!atlas) return false
    return !!atlas.frames[frame]
  }

  // Resolve frame name: try exact, then swap .gif/.png extension
  resolveFrameName(name: string, frame: string): string {
    if (this.hasFrame(name, frame)) return frame
    let alt: string | null = null
    if (frame.endsWith('.gif')) alt = frame.replace(/\.gif$/, '.png')
    else if (frame.endsWith('.png')) alt = frame.replace(/\.png$/, '.gif')
    if (alt && this.hasFrame(name, alt)) return alt
    return frame
  }

  // Get frame dimensions (original display size, not texture size)
  getFrameSize(name: string, frame: string): { w: number; h: number } {
    const f = this.getFrame(name, frame)
    if (!f) return { w: 0, h: 0 }
    return { w: f.dw, h: f.dh }
  }

  // Draw an atlas frame at screen position (x, y) with center origin.
  // Negative scaleX/scaleY flips by swapping the crop edges.
  drawFrame(
    name: string,
    frame: string,
    x: number,
    y: number,
    scaleX?: number,
    scaleY?: number,
    alpha?: number,
    tint?: number | null,
  ): void {
    const atlas = this.#atlases[name]
    if (!atlas) return
    const f = atlas.frames[frame]
    if (!f) return

    const img = atlas.image
    const sx = scaleX || 1.0
    const sy = scaleY || 1.0

    // Set sub-region (texture coordinates); swapped edges express a flip
    this.#setCrop(img, f, sx < 0, sy < 0)

    // Set display size using original dimensions (dw/dh)
    const displayW = f.dw * Math.abs(sx)
    const displayH = f.dh * Math.abs(sy)
    img.width = displayW
    img.height = displayH

    // Apply tint/alpha via color
    if (tint) {
      img.color = tint
    } else if (alpha !== undefined && alpha < 1.0) {
      const a = Math.floor(alpha * 128)
      img.color = this.#rt.Color.new(255, 255, 255, a)
    } else {
      img.color = this.#rt.Color.new(255, 255, 255, 128)
    }

    // Draw centered at (x, y)
    img.draw(x - (displayW / 2), y - (displayH / 2))
  }

  // Draw atlas frame with top-left origin (no centering)
  drawFrameTL(
    name: string,
    frame: string,
    x: number,
    y: number,
    scaleX?: number,
    scaleY?: number,
    alpha?: number,
  ): void {
    const atlas = this.#atlases[name]
    if (!atlas) return
    const f = atlas.frames[frame]
    if (!f) return

    const img = atlas.image
    const sx = scaleX || 1.0
    const sy = scaleY || 1.0

    this.#setCrop(img, f, sx < 0, sy < 0)
    img.width = f.dw * Math.abs(sx)
    img.height = f.dh * Math.abs(sy)

    if (alpha !== undefined && alpha < 1.0) {
      const a = Math.floor(alpha * 128)
      img.color = this.#rt.Color.new(255, 255, 255, a)
    } else {
      img.color = this.#rt.Color.new(255, 255, 255, 128)
    }

    img.draw(x, y)
  }

  #setCrop(img: PS2ImageInstance, f: AtlasFrame, flipX: boolean, flipY: boolean): void {
    img.startx = flipX ? f.x + f.w : f.x
    img.endx = flipX ? f.x : f.x + f.w
    img.starty = flipY ? f.y + f.h : f.y
    img.endy = flipY ? f.y : f.y + f.h
  }
}
