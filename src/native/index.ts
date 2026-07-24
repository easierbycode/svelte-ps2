// Native AthenaEnv adapter — builds a PS2Runtime over the real AthenaEnv v4
// globals (Screen, Draw, Image, Font, Pads, Timer, std) so toolkit and game
// code written against the browser shim runs unmodified on PS2 hardware.
// Image tints and font colors arrive in the shim convention (RGB 255 =
// neutral) and are converted to the GS-native convention (128 = neutral);
// Draw.rect color words pass through untouched.

import type {
  PS2ColorValue,
  PS2Draw,
  PS2FontInstance,
  PS2ImageInstance,
  PS2Pads,
  PS2Runtime,
  PS2Screen,
  PS2Std,
} from '../core/index.ts'
import { Color, LINEAR, NEAREST, PAD_BUTTONS, Timer } from '../core/index.ts'

// deno-lint-ignore no-explicit-any
type Loose = any

const g = globalThis as unknown as Record<string, Loose>

export interface NativeRuntimeOptions {
  /** extra scale multiplied into every font's scale (default 1) */
  fontScale?: number
  /** Athena color word cleared each tick (default opaque black) */
  clearColor?: number
}

/** shim color word -> GS-native word: RGB rescaled so 255 maps to the GS neutral 128, alpha kept */
function toNativeColor(c: number): number {
  const r = c & 0xff
  const gc = (c >>> 8) & 0xff
  const b = (c >>> 16) & 0xff
  const a = (c >>> 24) & 0xff
  return (
    ((a & 0xff) << 24) |
    ((Math.round((b * 128) / 255) & 0xff) << 16) |
    ((Math.round((gc * 128) / 255) & 0xff) << 8) |
    (Math.round((r * 128) / 255) & 0xff)
  ) >>> 0
}

function need(name: string): Loose {
  const mod = g[name]
  if (mod === undefined || mod === null) {
    throw new Error(
      `createNativeRuntime: AthenaEnv global '${name}' is missing — the native adapter must run on AthenaEnv v4`
    )
  }
  return mod
}

export function createNativeRuntime(options?: NativeRuntimeOptions): PS2Runtime {
  const fontScale = options?.fontScale ?? 1
  const clearColor = options?.clearColor ?? Color.new(0, 0, 0, 128)

  const nativeScreen = need('Screen')
  const nativeDraw = need('Draw')
  const NativeImageCtor = need('Image')
  const NativeFontCtor = need('Font')
  const nativePads = need('Pads')
  const nativeStd = need('std')

  // native GS filter constants (gsKit order: NEAREST = 0, LINEAR = 1)
  const nativeLinear: number = typeof g.LINEAR === 'number' ? g.LINEAR : 1
  const nativeNearest: number = typeof g.NEAREST === 'number' ? g.NEAREST : 0

  const nativeNeutral = toNativeColor(Color.new(255, 255, 255, 128))

  let displayCallback: (() => void) | null = null

  const Screen: PS2Screen = {
    setVSync(on: boolean) {
      if (typeof nativeScreen.setVSync === 'function') nativeScreen.setVSync(on)
    },
    getMode() {
      const mode = nativeScreen.getMode()
      return { width: mode.width, height: mode.height }
    },
    display(cb: () => void) {
      displayCallback = cb
    },
  }

  const Draw: PS2Draw = {
    rect(x, y, w, h, color) {
      nativeDraw.rect(x, y, w, h, color)
    },
  }

  class NativeImage implements PS2ImageInstance {
    width: number
    height: number
    startx: number
    starty: number
    endx: number
    endy: number
    filter: number = LINEAR
    #color: PS2ColorValue = Color.new(255, 255, 255, 128)
    #native: Loose

    constructor(path: string) {
      this.#native = new NativeImageCtor(path)
      this.width = this.#native.width
      this.height = this.#native.height
      this.startx = 0
      this.starty = 0
      this.endx = this.#native.width
      this.endy = this.#native.height
    }

    get color(): PS2ColorValue {
      return this.#color
    }

    set color(c: PS2ColorValue) {
      this.#color = c
      this.#native.color = toNativeColor(c)
    }

    draw(x: number, y: number, w?: number, h?: number): void {
      const n = this.#native
      n.startx = this.startx
      n.starty = this.starty
      n.endx = this.endx
      n.endy = this.endy
      n.width = w === undefined ? this.width : w
      n.height = h === undefined ? this.height : h
      n.filter = this.filter === NEAREST ? nativeNearest : nativeLinear
      n.color = toNativeColor(this.#color)
      n.draw(x, y)
    }
  }

  class NativeFont implements PS2FontInstance {
    scale: number = 1.0
    color: PS2ColorValue | undefined = undefined

    #native: Loose

    constructor(path: string) {
      this.#native = path === 'default' ? new NativeFontCtor() : new NativeFontCtor(path)
    }

    print(x: number, y: number, text: string, color?: PS2ColorValue): void {
      const effective = color === undefined ? this.color : color
      const n = this.#native
      n.scale = this.scale * fontScale
      n.color = effective === undefined ? nativeNeutral : toNativeColor(effective)
      n.print(x, y, String(text))
    }

    getTextSize(text: string): { width: number; height: number } {
      const n = this.#native
      n.scale = this.scale * fontScale
      const size = n.getTextSize(String(text))
      return { width: size.width, height: size.height }
    }
  }

  const padConst = (name: keyof typeof PAD_BUTTONS): number =>
    typeof nativePads[name] === 'number' ? nativePads[name] : PAD_BUTTONS[name]

  const Pads = {
    SELECT: padConst('SELECT'),
    L3: padConst('L3'),
    R3: padConst('R3'),
    START: padConst('START'),
    UP: padConst('UP'),
    RIGHT: padConst('RIGHT'),
    DOWN: padConst('DOWN'),
    LEFT: padConst('LEFT'),
    L2: padConst('L2'),
    R2: padConst('R2'),
    L1: padConst('L1'),
    R1: padConst('R1'),
    TRIANGLE: padConst('TRIANGLE'),
    CIRCLE: padConst('CIRCLE'),
    CROSS: padConst('CROSS'),
    SQUARE: padConst('SQUARE'),
    get(port = 0) {
      return nativePads.get(port)
    },
    getConnected() {
      return typeof nativePads.getConnected === 'function' ? nativePads.getConnected() : [0]
    },
    getConnectedCount() {
      return typeof nativePads.getConnectedCount === 'function' ? nativePads.getConnectedCount() : 1
    },
    isActive(port: number) {
      return typeof nativePads.isActive === 'function' ? nativePads.isActive(port) : port === 0
    },
  } as PS2Pads

  return {
    Screen,
    Draw,
    Color,
    Pads,
    Image: NativeImage,
    Font: NativeFont,
    Timer: (g.Timer ?? Timer) as typeof Timer,
    std: nativeStd as PS2Std,
    NEAREST,
    LINEAR,
    tick() {
      nativeScreen.clear(clearColor)
      if (displayCallback) displayCallback()
      nativeScreen.flip()
    },
  }
}

export function runNativeLoop(rt: PS2Runtime): never {
  while (true) {
    rt.tick()
  }
}
