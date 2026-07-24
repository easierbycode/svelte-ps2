// AthenaEnv Image: source-rect crop via startx/starty/endx/endy (swapping
// start/end flips), destination size via width/height, draw(x, y) or
// draw(x, y, w, h). filter takes the NEAREST/LINEAR globals. color is an
// Athena color word (Color.new) multiplied over the texture — white with
// alpha 128 (the default) draws unmodified; lower alpha fades.

import type { PS2Host, HostImageHandle } from './host.ts'
import { LINEAR, NEAREST } from './constants.ts'
import { Color, unpackColor, type PS2ColorValue } from './color.ts'

export interface PS2ImageClass {
  new (path: string): PS2ImageInstance
}

export interface PS2ImageInstance {
  width: number
  height: number
  startx: number
  starty: number
  endx: number
  endy: number
  filter: number
  color: PS2ColorValue
  draw(x: number, y: number, w?: number, h?: number): void
}

export function makeImageClass(host: PS2Host): PS2ImageClass {
  return class PS2Image implements PS2ImageInstance {
    width: number
    height: number
    startx: number
    starty: number
    endx: number
    endy: number
    filter = LINEAR
    color = Color.new(255, 255, 255, 128)

    #handle: HostImageHandle

    constructor(path: string) {
      this.#handle = host.createImage(path)
      this.width = this.#handle.width
      this.height = this.#handle.height
      this.startx = 0
      this.starty = 0
      this.endx = this.#handle.width
      this.endy = this.#handle.height
    }

    draw(x: number, y: number, w?: number, h?: number): void {
      const flipX = this.endx < this.startx
      const flipY = this.endy < this.starty
      const sx = flipX ? this.endx : this.startx
      const sy = flipY ? this.endy : this.starty
      const sw = Math.abs(this.endx - this.startx)
      const sh = Math.abs(this.endy - this.starty)
      if (sw <= 0 || sh <= 0) return

      host.drawImage(this.#handle, sx, sy, sw, sh, x, y, w ?? this.width, h ?? this.height, {
        nearest: this.filter === NEAREST,
        flipX,
        flipY,
        color: unpackColor(this.color),
      })
    }
  }
}
