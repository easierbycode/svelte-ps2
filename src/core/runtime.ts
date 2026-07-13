// createRuntime(host) — builds the AthenaEnv v4 global surface over a host.
//
// AthenaEnv is immediate-mode: Screen.display(cb) registers the per-frame
// callback and the runtime redraws everything inside it. Here the host's
// game loop drives the same callback via runtime.tick().

import type { PS2Host } from './host.ts'
import { Color } from './color.ts'
import { makePads, type PS2Pads } from './pads.ts'
import { makeImageClass, type PS2ImageClass } from './image.ts'
import { makeFontClass, type PS2FontClass } from './font.ts'
import { makeStd, type PS2Std } from './std.ts'
import { Timer } from './timer.ts'
import { LINEAR, NEAREST } from './constants.ts'
import { unpackColor, type PS2ColorValue } from './color.ts'

export interface PS2Screen {
  setVSync(on: boolean): void
  getMode(): { width: number; height: number }
  display(cb: () => void): void
}

export interface PS2Draw {
  rect(x: number, y: number, w: number, h: number, color: PS2ColorValue): void
}

export interface PS2Runtime {
  Screen: PS2Screen
  Draw: PS2Draw
  Color: typeof Color
  Pads: PS2Pads
  Image: PS2ImageClass
  Font: PS2FontClass
  Timer: typeof Timer
  std: PS2Std
  NEAREST: typeof NEAREST
  LINEAR: typeof LINEAR
  /** run one frame: beginFrame -> Screen.display callback -> endFrame */
  tick(): void
}

export function createRuntime(host: PS2Host): PS2Runtime {
  let displayCallback: (() => void) | null = null

  const Screen: PS2Screen = {
    setVSync(on: boolean) {
      host.setVSync?.(on)
    },
    getMode() {
      return { width: host.screen.width, height: host.screen.height }
    },
    display(cb: () => void) {
      displayCallback = cb
    },
  }

  const Draw: PS2Draw = {
    rect(x, y, w, h, color) {
      host.drawRect(x, y, w, h, unpackColor(color))
    },
  }

  return {
    Screen,
    Draw,
    Color,
    Pads: makePads(host),
    Image: makeImageClass(host),
    Font: makeFontClass(host),
    Timer,
    std: makeStd(host),
    NEAREST,
    LINEAR,
    tick() {
      host.beginFrame()
      displayCallback?.()
      host.endFrame()
    },
  }
}
