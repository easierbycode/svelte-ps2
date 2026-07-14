// DualShock input bindings: snapshots the pad's held state once per fixed
// step so isPressed edges are step-accurate, and exposes the high-level
// action helpers the scenes poll (movement with ±0.3 analog thresholds,
// fire/sp/confirm buttons, and the SELECT+DOWN turbo combo).

import { PAD_BUTTONS } from '../core/index.ts'
import type { PS2Pad, PS2Runtime } from '../core/index.ts'
import type { GameInput } from './types.ts'

const MASKS: number[] = Object.values(PAD_BUTTONS)

export function createInput(rt: PS2Runtime): GameInput {
  const pad: PS2Pad = rt.Pads.get()
  let held: Record<number, boolean> = {}
  let prevHeld: Record<number, boolean> = {}

  const isDown = (mask: number): boolean => held[mask] === true

  const isPressed = (mask: number): boolean => held[mask] === true && prevHeld[mask] !== true

  const getAnalogX = (): number => pad.lx / 128

  const getAnalogY = (): number => pad.ly / 128

  return {
    update(): void {
      pad.update()
      prevHeld = held
      held = {}
      for (const mask of MASKS) {
        held[mask] = pad.pressed(mask)
      }
    },
    isDown,
    isPressed,
    getAnalogX,
    getAnalogY,
    isLeftHeld(): boolean {
      return isDown(PAD_BUTTONS.LEFT) || getAnalogX() < -0.3
    },
    isRightHeld(): boolean {
      return isDown(PAD_BUTTONS.RIGHT) || getAnalogX() > 0.3
    },
    isUpHeld(): boolean {
      return isDown(PAD_BUTTONS.UP) || getAnalogY() < -0.3
    },
    isDownHeld(): boolean {
      return isDown(PAD_BUTTONS.DOWN) || getAnalogY() > 0.3
    },
    isUpPressed(): boolean {
      return isPressed(PAD_BUTTONS.UP)
    },
    isDownPressed(): boolean {
      return isPressed(PAD_BUTTONS.DOWN)
    },
    isFirePressed(): boolean {
      return isPressed(PAD_BUTTONS.CROSS) || isPressed(PAD_BUTTONS.CIRCLE)
    },
    isSpPressed(): boolean {
      return isPressed(PAD_BUTTONS.TRIANGLE) || isPressed(PAD_BUTTONS.R1)
    },
    isStartPressed(): boolean {
      return isPressed(PAD_BUTTONS.START)
    },
    isSelectPressed(): boolean {
      return isPressed(PAD_BUTTONS.SELECT)
    },
    isConfirmPressed(): boolean {
      return isPressed(PAD_BUTTONS.CROSS) || isPressed(PAD_BUTTONS.START)
    },
    isBackPressed(): boolean {
      return isPressed(PAD_BUTTONS.CIRCLE) || isPressed(PAD_BUTTONS.TRIANGLE)
    },
    isYesPressed(): boolean {
      return isPressed(PAD_BUTTONS.CROSS)
    },
    isNoPressed(): boolean {
      return isPressed(PAD_BUTTONS.CIRCLE)
    },
    isTurboToggle(): boolean {
      return (isDown(PAD_BUTTONS.SELECT) && isPressed(PAD_BUTTONS.DOWN)) ||
        (isPressed(PAD_BUTTONS.SELECT) && isDown(PAD_BUTTONS.DOWN))
    },
  }
}
