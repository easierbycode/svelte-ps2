// Frame-based tween engine: interpolates numeric properties on plain
// objects over time with easing, delay, yoyo, hold and repeat. Start
// values are captured from the live target when a tween is added.

import { getEase } from './easing.ts'
import type { EaseFn } from './easing.ts'

export interface TweenTarget {
  [key: string]: unknown
}

export interface TweenOptions {
  target: TweenTarget
  props: Record<string, number>
  duration?: number
  delay?: number
  ease?: string
  yoyo?: boolean
  repeat?: number
  hold?: number
  onComplete?: (target: TweenTarget) => void
  onUpdate?: (target: TweenTarget, progress: number) => void
}

interface TweenProp {
  start: number
  end: number
}

interface Tween {
  id: number
  target: TweenTarget
  props: Record<string, TweenProp>
  duration: number
  delay: number
  elapsed: number
  ease: EaseFn
  yoyo: boolean
  repeat: number
  repeatCount: number
  forward: boolean
  onComplete: ((target: TweenTarget) => void) | null
  onUpdate: ((target: TweenTarget, progress: number) => void) | null
  active: boolean
  hold: number
  holdElapsed: number
}

export class TweenManager {
  paused: boolean = false

  private tweens: Tween[] = []
  private idCounter: number = 0

  add(opts: TweenOptions): number {
    const id = this.idCounter++
    const tw: Tween = {
      id,
      target: opts.target,
      props: {},
      duration: opts.duration || 300,
      delay: opts.delay || 0,
      elapsed: 0,
      ease: getEase(opts.ease || 'Linear'),
      yoyo: opts.yoyo || false,
      repeat: opts.repeat || 0,
      repeatCount: 0,
      forward: true,
      onComplete: opts.onComplete || null,
      onUpdate: opts.onUpdate || null,
      active: true,
      hold: opts.hold || 0,
      holdElapsed: 0,
    }

    // Store start/end values for each property
    const propKeys = Object.keys(opts.props || {})
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const current = opts.target[key]
      tw.props[key] = {
        start: current !== undefined ? (current as number) : 0,
        end: opts.props[key],
      }
    }

    this.tweens.push(tw)
    return id
  }

  update(dt: number): void {
    if (this.paused) return
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      if (!tw.active) {
        this.tweens.splice(i, 1)
        continue
      }

      // Handle delay (the remainder leaks into dt for the rest of the loop,
      // matching the original engine's behavior)
      if (tw.delay > 0) {
        tw.delay -= dt
        if (tw.delay > 0) continue
        dt = -tw.delay
        tw.delay = 0
      }

      tw.elapsed += dt

      const progress = Math.min(tw.elapsed / tw.duration, 1.0)
      const easedProgress = tw.ease(tw.forward ? progress : 1 - progress)

      // Apply properties
      const propKeys = Object.keys(tw.props)
      for (let p = 0; p < propKeys.length; p++) {
        const key = propKeys[p]
        const prop = tw.props[key]
        tw.target[key] = prop.start + (prop.end - prop.start) * easedProgress
      }

      if (tw.onUpdate) tw.onUpdate(tw.target, progress)

      if (progress >= 1.0) {
        if (tw.yoyo && tw.forward) {
          // Hold before reversing
          if (tw.hold > 0 && tw.holdElapsed < tw.hold) {
            tw.holdElapsed += dt
            continue
          }
          tw.forward = false
          tw.elapsed = 0
          tw.holdElapsed = 0
        } else if (tw.repeat !== 0) {
          tw.repeatCount++
          if (tw.repeat === -1 || tw.repeatCount <= tw.repeat) {
            tw.forward = true
            tw.elapsed = 0
            tw.holdElapsed = 0
          } else {
            tw.active = false
            if (tw.onComplete) tw.onComplete(tw.target)
          }
        } else {
          tw.active = false
          if (tw.onComplete) tw.onComplete(tw.target)
        }
      }
    }
  }

  kill(id: number): void {
    for (let i = 0; i < this.tweens.length; i++) {
      if (this.tweens[i].id === id) {
        this.tweens[i].active = false
        break
      }
    }
  }

  killAll(): void {
    this.tweens.length = 0
  }
}
