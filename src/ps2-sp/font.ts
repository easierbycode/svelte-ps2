// The shared game font: a single Font('default') instance scaled once to
// the viewport. print() takes screen coordinates; printGame() maps game
// coordinates through the viewport first.

import type { PS2ColorValue, PS2FontInstance, PS2Runtime } from '../core/index.ts'
import type { Viewport } from '../toolkit/index.ts'
import type { GameFont } from './types.ts'

export function createGameFont(rt: PS2Runtime, vp: Viewport): GameFont {
  const font: PS2FontInstance = new rt.Font('default')
  font.scale = vp.scale

  return {
    print(x: number, y: number, text: string, color?: PS2ColorValue): void {
      font.print(x, y, text, color)
    },
    printGame(gx: number, gy: number, text: string, color?: PS2ColorValue): void {
      font.print(vp.toX(gx), vp.toY(gy), text, color)
    },
  }
}
