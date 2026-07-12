// AthenaEnv Color module. Colors are packed u32s (ABGR byte order like
// Athena's GS color words). PS2 alpha semantics: 0x80 (128) is "1.0";
// values above 128 over-brighten on real GS hardware. The full 0..255 is
// stored so values round-trip, but hosts render anything >= 128 as opaque.

import type { RGBA } from './host'

export type PS2ColorValue = number

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))

export const Color = {
  new(r: number, g: number, b: number, a = 128): PS2ColorValue {
    return (
      ((clamp(a, 0, 255) & 0xff) << 24) |
      ((clamp(b, 0, 255) & 0xff) << 16) |
      ((clamp(g, 0, 255) & 0xff) << 8) |
      (clamp(r, 0, 255) & 0xff)
    ) >>> 0
  },

  getR(c: PS2ColorValue): number {
    return c & 0xff
  },
  getG(c: PS2ColorValue): number {
    return (c >>> 8) & 0xff
  },
  getB(c: PS2ColorValue): number {
    return (c >>> 16) & 0xff
  },
  getA(c: PS2ColorValue): number {
    return (c >>> 24) & 0xff
  },

  setR(c: PS2ColorValue, v: number): PS2ColorValue {
    return ((c & 0xffffff00) | (clamp(v, 0, 255) & 0xff)) >>> 0
  },
  setG(c: PS2ColorValue, v: number): PS2ColorValue {
    return ((c & 0xffff00ff) | ((clamp(v, 0, 255) & 0xff) << 8)) >>> 0
  },
  setB(c: PS2ColorValue, v: number): PS2ColorValue {
    return ((c & 0xff00ffff) | ((clamp(v, 0, 255) & 0xff) << 16)) >>> 0
  },
  setA(c: PS2ColorValue, v: number): PS2ColorValue {
    return ((c & 0x00ffffff) | ((clamp(v, 0, 255) & 0xff) << 24)) >>> 0
  },
}

/** Unpack to host RGBA — PS2 alpha 0..128 maps to 0..1 (128 = opaque). */
export function unpackColor(c: PS2ColorValue): RGBA {
  return {
    r: c & 0xff,
    g: (c >>> 8) & 0xff,
    b: (c >>> 16) & 0xff,
    a: Math.min(1, ((c >>> 24) & 0xff) / 128),
  }
}
