// AthenaEnv v4 Pads module (OOP API from v3.0 onward): Pads.get(port)
// returns a pad object with pressed()/justPressed() plus lx/ly/rx/ry analog
// values (AthenaEnv's -127..128 range, up/left negative), answered live by
// the host. Assigning an axis (the common deadzone idiom `pad.lx = 0`)
// sticks until update() refreshes it, like Athena's snapshot fields.
// Button constants are the real PS2 digital button masks.

import type { PS2Host } from './host.ts'

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
  const makePad = (): PS2Pad => {
    // assigned axis values shadow the live host reading until update()
    type Axis = 'lx' | 'ly' | 'rx' | 'ry'
    const override: Partial<Record<Axis, number>> = {}
    const axis = (name: Axis) => override[name] ?? host.padAxis?.(name) ?? 0

    return {
      btns: 0,
      old_btns: 0,
      get lx() {
        return axis('lx')
      },
      set lx(v: number) {
        override.lx = v
      },
      get ly() {
        return axis('ly')
      },
      set ly(v: number) {
        override.ly = v
      },
      get rx() {
        return axis('rx')
      },
      set rx(v: number) {
        override.rx = v
      },
      get ry() {
        return axis('ry')
      },
      set ry(v: number) {
        override.ry = v
      },
      update() {
        this.old_btns = this.btns
        delete override.lx
        delete override.ly
        delete override.rx
        delete override.ry
      },
      pressed(mask: number) {
        return host.padHeld(mask)
      },
      justPressed(mask: number) {
        return host.padFresh(mask)
      },
    }
  }

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
