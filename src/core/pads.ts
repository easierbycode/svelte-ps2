// AthenaEnv v4 Pads module (OOP API from v3.0 onward): Pads.get(port)
// returns a pad object with pressed()/justPressed(). Button constants are
// the real PS2 digital button masks.

import type { PS2Host } from './host'

export const PAD_BUTTONS = {
  SELECT: 0x0001,
  L3: 0x0002,
  R3: 0x0004,
  START: 0x0008,
  UP: 0x0010,
  RIGHT: 0x0020,
  DOWN: 0x0040,
  LEFT: 0x0080,
  L2: 0x0100,
  R2: 0x0200,
  L1: 0x0400,
  R1: 0x0800,
  TRIANGLE: 0x1000,
  CIRCLE: 0x2000,
  CROSS: 0x4000,
  SQUARE: 0x8000,
} as const

export interface PS2Pad {
  btns: number
  old_btns: number
  lx: number
  ly: number
  rx: number
  ry: number
  update(): void
  pressed(mask: number): boolean
  justPressed(mask: number): boolean
}

export interface PS2Pads {
  readonly SELECT: number
  readonly L3: number
  readonly R3: number
  readonly START: number
  readonly UP: number
  readonly RIGHT: number
  readonly DOWN: number
  readonly LEFT: number
  readonly L2: number
  readonly R2: number
  readonly L1: number
  readonly R1: number
  readonly TRIANGLE: number
  readonly CIRCLE: number
  readonly CROSS: number
  readonly SQUARE: number
  get(port?: number): PS2Pad
  getConnected(): number[]
  getConnectedCount(): number
  isActive(port: number): boolean
}

export function makePads(host: PS2Host): PS2Pads {
  const makePad = (): PS2Pad => ({
    btns: 0,
    old_btns: 0,
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
    update() {
      this.old_btns = this.btns
    },
    pressed(mask: number) {
      return host.padHeld(mask)
    },
    justPressed(mask: number) {
      return host.padFresh(mask)
    },
  })

  return {
    ...PAD_BUTTONS,
    get(_port = 0) {
      return makePad()
    },
    getConnected() {
      return [0]
    },
    getConnectedCount() {
      return 1
    },
    isActive(port: number) {
      return port === 0
    },
  }
}
