// Canvas-generated bitmap font for the Phaser host.
//
// Browser consumers need a bitmap font to back `new Font('default')`,
// but shipping a font asset just for that is a chore. This draws a
// character set onto a canvas texture as a uniform grid — every cell
// sized from the widest glyph, white text so BitmapText tints work —
// then registers it in the scene's bitmap font cache via
// Phaser.GameObjects.RetroFont.Parse. Idempotent per key.

import Phaser from 'phaser'

export interface CanvasBitmapFontOptions {
  /** CSS font family drawn onto the canvas */
  fontFamily?: string
  /** glyph size in px */
  fontSize?: number
  /** fill color; keep white so BitmapText tints work */
  color?: string
  /** characters to include, in display order */
  chars?: string
}

export function registerCanvasBitmapFont(
  scene: Phaser.Scene,
  key: string,
  options?: CanvasBitmapFontOptions,
): void {
  if (scene.cache.bitmapFont.exists(key)) return

  const fontFamily = options?.fontFamily ?? 'monospace'
  const fontSize = options?.fontSize ?? 16
  const color = options?.color ?? '#ffffff'
  const chars = options?.chars ?? Phaser.GameObjects.RetroFont.TEXT_SET1

  if (chars.length === 0) {
    throw new Error('5velte-ps2: registerCanvasBitmapFont needs at least one character')
  }

  if (scene.textures.exists(key)) scene.textures.remove(key)

  const texture = scene.textures.createCanvas(key, 1, 1)
  if (!texture) {
    throw new Error(`5velte-ps2: could not create canvas texture "${key}"`)
  }

  const font = `${fontSize}px ${fontFamily}`
  const context = texture.context
  context.font = font

  // uniform cell size from the widest glyph
  let cellWidth = 1
  for (const ch of chars) {
    cellWidth = Math.max(cellWidth, Math.ceil(context.measureText(ch).width))
  }
  const probe = context.measureText('Mg(|]q')
  const ascent = Math.ceil(probe.fontBoundingBoxAscent ?? probe.actualBoundingBoxAscent ?? fontSize * 0.8)
  const descent = Math.ceil(probe.fontBoundingBoxDescent ?? probe.actualBoundingBoxDescent ?? fontSize * 0.25)
  const cellHeight = ascent + descent

  const charsPerRow = Math.ceil(Math.sqrt(chars.length))
  const rows = Math.ceil(chars.length / charsPerRow)

  // resizing the canvas resets the 2d context state, so set text props after
  texture.setSize(charsPerRow * cellWidth, rows * cellHeight)
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'

  for (let i = 0; i < chars.length; i++) {
    const col = i % charsPerRow
    const row = Math.floor(i / charsPerRow)
    context.fillText(chars[i], col * cellWidth + cellWidth / 2, row * cellHeight + ascent)
  }
  texture.refresh()

  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: key,
    'offset.x': 0,
    'offset.y': 0,
    width: cellWidth,
    height: cellHeight,
    chars,
    charsPerRow,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  })
  scene.cache.bitmapFont.add(key, entry)
}
