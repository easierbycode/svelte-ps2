// Lightweight sprite objects: plain data records with an atlas frame,
// position, anchor, scale, alpha, optional tint, frame animation, and a
// hit area. Draw functions take the AtlasManager (and a Viewport for
// game-to-screen drawing) explicitly; AABB helpers cover hit testing.

import { Color } from '../core/index.ts'
import type { AtlasManager } from './atlas.ts'
import type { Viewport } from './viewport.ts'

export interface PS2Sprite {
  id: number
  atlas: string
  frame: string
  x: number
  y: number
  anchorX: number
  anchorY: number
  scaleX: number
  scaleY: number
  alpha: number
  rotation: number
  visible: number
  tint: number | null
  // Animation
  frames: string[] | null
  animFrame: number
  animSpeed: number
  animCounter: number
  animLoop: number
  animPlaying: number
  // Hit area (relative to sprite position)
  hitX: number
  hitY: number
  hitW: number
  hitH: number
}

let spriteIdCounter = 0

export function createSprite(atlas: AtlasManager, atlasName: string, frameName: string): PS2Sprite {
  return {
    id: spriteIdCounter++,
    atlas: atlasName,
    frame: frameName,
    x: 0,
    y: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    scaleX: 1.0,
    scaleY: 1.0,
    alpha: 1.0,
    rotation: 0,
    visible: 1,
    tint: null,
    // Animation
    frames: null,
    animFrame: 0,
    animSpeed: 0.15,
    animCounter: 0,
    animLoop: 1,
    animPlaying: 0,
    // Hit area (relative to sprite position)
    hitX: 0,
    hitY: 0,
    hitW: 0,
    hitH: 0,
  }
}

export function createAnimSprite(atlas: AtlasManager, atlasName: string, frameNames: string[]): PS2Sprite {
  const spr = createSprite(atlas, atlasName, frameNames[0])
  spr.frames = frameNames
  spr.animPlaying = 1
  // Set default hit area from first frame
  const size = atlas.getFrameSize(atlasName, frameNames[0])
  spr.hitW = size.w
  spr.hitH = size.h
  return spr
}

export function updateSpriteAnim(spr: PS2Sprite): void {
  if (!spr.animPlaying || !spr.frames || spr.frames.length <= 1) return
  spr.animCounter += spr.animSpeed
  if (spr.animCounter >= 1.0) {
    spr.animCounter -= 1.0
    spr.animFrame++
    if (spr.animFrame >= spr.frames.length) {
      if (spr.animLoop) {
        spr.animFrame = 0
      } else {
        spr.animFrame = spr.frames.length - 1
        spr.animPlaying = 0
      }
    }
    spr.frame = spr.frames[spr.animFrame]
  }
}

export function drawSprite(atlas: AtlasManager, vp: Viewport, spr: PS2Sprite): void {
  if (!spr.visible || spr.alpha <= 0) return

  let tintColor: number | null = null
  if (spr.tint) {
    tintColor = spr.tint
  } else if (spr.alpha < 1.0) {
    const a = Math.floor(spr.alpha * 128)
    tintColor = Color.new(255, 255, 255, a)
  }

  // Convert game coords to screen coords
  const sx = vp.toX(spr.x)
  const sy = vp.toY(spr.y)
  const scX = spr.scaleX * vp.scale
  const scY = spr.scaleY * vp.scale

  atlas.drawFrame(spr.atlas, spr.frame, sx, sy, scX, scY, spr.alpha, tintColor)
}

// Draw sprite at game coordinates (no screen transform — for use within game-coord rendering)
export function drawSpriteGame(atlas: AtlasManager, spr: PS2Sprite): void {
  if (!spr.visible || spr.alpha <= 0) return

  let tintColor: number | null = null
  if (spr.tint) {
    tintColor = spr.tint
  } else if (spr.alpha < 1.0) {
    const a = Math.floor(spr.alpha * 128)
    tintColor = Color.new(255, 255, 255, a)
  }

  atlas.drawFrame(spr.atlas, spr.frame, spr.x, spr.y, spr.scaleX, spr.scaleY, spr.alpha, tintColor)
}

// AABB overlap test between two rectangles
export function hitTestAABB(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// AABB hit test between two sprites (using hitArea or frame size)
export function hitTestSprites(atlas: AtlasManager, a: PS2Sprite, b: PS2Sprite): boolean {
  const aSize = atlas.getFrameSize(a.atlas, a.frame)
  const aw = a.hitW || aSize.w
  const ah = a.hitH || aSize.h
  const ax = a.x + a.hitX - aw * a.anchorX
  const ay = a.y + a.hitY - ah * a.anchorY

  const bSize = atlas.getFrameSize(b.atlas, b.frame)
  const bw = b.hitW || bSize.w
  const bh = b.hitH || bSize.h
  const bx = b.x + b.hitX - bw * b.anchorX
  const by = b.y + b.hitY - bh * b.anchorY

  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// Hit test sprite vs rectangle {x, y, w, h}
export function hitTestSpriteRect(
  atlas: AtlasManager,
  spr: PS2Sprite,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  const sSize = atlas.getFrameSize(spr.atlas, spr.frame)
  const sw = spr.hitW || sSize.w
  const sh = spr.hitH || sSize.h
  const sx = spr.x + spr.hitX - sw * spr.anchorX
  const sy = spr.y + spr.hitY - sh * spr.anchorY

  return sx < rect.x + rect.w && sx + sw > rect.x && sy < rect.y + rect.h && sy + sh > rect.y
}
