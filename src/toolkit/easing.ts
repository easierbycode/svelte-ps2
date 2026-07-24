// Easing curves for the tween system. Each function maps a normalized
// time t in [0, 1] to an eased progress value.

export type EaseFn = (t: number) => number

function easeLinear(t: number): number {
  return t
}

function easeQuintOut(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

function easeQuintIn(t: number): number {
  return t * t * t * t * t
}

function easeExpoIn(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1))
}

function easeExpoOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function easeBackOut(t: number): number {
  const s = 1.70158
  return (t -= 1) * t * ((s + 1) * t + s) + 1
}

function easeElasticOut(t: number): number {
  if (t === 0 || t === 1) return t
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1
}

export const EASES: Record<string, EaseFn> = {
  'Linear': easeLinear,
  'Quint.easeOut': easeQuintOut,
  'Quint.easeIn': easeQuintIn,
  'Expo.easeIn': easeExpoIn,
  'Expo.easeOut': easeExpoOut,
  'Back.easeOut': easeBackOut,
  'Elastic.easeOut': easeElasticOut,
}

export function getEase(name?: string): EaseFn {
  if (name === undefined) return easeLinear
  return EASES[name] ?? easeLinear
}
