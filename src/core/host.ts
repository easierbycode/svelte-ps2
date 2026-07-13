// Host contract — the platform half of the AthenaEnv shim.
//
// core/ recreates AthenaEnv v4's script-facing API (Screen, Draw, Color,
// Image, Font, Pads, Timer, std) on top of this interface. A host renders
// the immediate-mode calls and answers input/storage queries; the shipped
// implementation is src/phaser (Phaser 4). On a real PS2 none of this is
// used — the same game code runs against Athena's native globals.

/** Color with alpha already normalized to 0..1 (PS2 alpha 0..128 is converted upstream). */
export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export interface HostImageHandle {
  /** natural size of the backing texture, in pixels */
  width: number
  height: number
}

export interface HostFontHandle {}

export interface DrawImageOptions {
  nearest: boolean
  flipX: boolean
  flipY: boolean
  /** Image.color tint — white (255,255,255) means no tint; a < 1 fades */
  color?: RGBA
}

export interface PS2Host {
  /** virtual screen mode reported by Screen.getMode() (e.g. 640x448) */
  screen: { width: number; height: number }

  setVSync?(on: boolean): void

  /** called before the Screen.display callback each frame */
  beginFrame(): void
  /** called after the Screen.display callback each frame */
  endFrame(): void

  drawRect(x: number, y: number, w: number, h: number, color: RGBA): void

  createImage(path: string): HostImageHandle
  drawImage(
    img: HostImageHandle,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    options: DrawImageOptions
  ): void

  createFont(path: string): HostFontHandle
  drawText(font: HostFontHandle, x: number, y: number, text: string, color?: RGBA): void
  measureText(font: HostFontHandle, text: string): { width: number; height: number }

  /** is the PS2 button (Pads.* mask) held this frame? */
  padHeld(mask: number): boolean
  /** did the PS2 button go down this frame? (edge) */
  padFresh(mask: number): boolean
  /** analog stick axis in AthenaEnv's range (-127..128, 0 centered, up/left negative) */
  padAxis?(axis: 'lx' | 'ly' | 'rx' | 'ry'): number

  /** std.loadFile — return null when the file doesn't exist */
  loadFile(path: string): string | null
  /** backing store for std.open(path, 'w') writes */
  writeFile(path: string, data: string): void
}
