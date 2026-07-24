// AthenaEnv Font: new Font(path), font.print(x, y, text[, color]),
// font.getTextSize(text) -> { width, height }. Instances carry Athena's
// mutable scale and color attributes; an explicit print color wins over
// font.color.

import type { PS2Host, HostFontHandle } from './host.ts'
import { unpackColor, type PS2ColorValue } from './color.ts'

export interface PS2FontClass {
  new (path: string): PS2FontInstance
}

export interface PS2FontInstance {
  scale: number
  color: PS2ColorValue | undefined
  print(x: number, y: number, text: string, color?: PS2ColorValue): void
  getTextSize(text: string): { width: number; height: number }
}

export function makeFontClass(host: PS2Host): PS2FontClass {
  return class PS2Font implements PS2FontInstance {
    scale = 1.0
    color: PS2ColorValue | undefined = undefined

    #handle: HostFontHandle

    constructor(path: string) {
      this.#handle = host.createFont(path)
    }

    print(x: number, y: number, text: string, color?: PS2ColorValue): void {
      const effective = color === undefined ? this.color : color
      host.drawText(
        this.#handle,
        x,
        y,
        String(text),
        effective === undefined ? undefined : unpackColor(effective),
        this.scale
      )
    }

    getTextSize(text: string): { width: number; height: number } {
      return host.measureText(this.#handle, String(text), this.scale)
    }
  }
}
