// AthenaEnv Font: new Font(path), font.print(x, y, text[, color]),
// font.getTextSize(text) -> { width, height }.

import type { PS2Host, HostFontHandle } from './host.ts'
import { unpackColor, type PS2ColorValue } from './color.ts'

export interface PS2FontClass {
  new (path: string): PS2FontInstance
}

export interface PS2FontInstance {
  print(x: number, y: number, text: string, color?: PS2ColorValue): void
  getTextSize(text: string): { width: number; height: number }
}

export function makeFontClass(host: PS2Host): PS2FontClass {
  return class PS2Font implements PS2FontInstance {
    #handle: HostFontHandle

    constructor(path: string) {
      this.#handle = host.createFont(path)
    }

    print(x: number, y: number, text: string, color?: PS2ColorValue): void {
      host.drawText(this.#handle, x, y, String(text), color === undefined ? undefined : unpackColor(color))
    }

    getTextSize(text: string): { width: number; height: number } {
      return host.measureText(this.#handle, String(text))
    }
  }
}
