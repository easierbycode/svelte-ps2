// Frame-driven timer scheduler: one-shot delayed calls, repeating
// events, and infinite loops, advanced by feeding update(dt) each step.
// Immediate-mode replacement for Phaser's scene.time.delayedCall() and
// scene.time.addEvent(). Each timer fires at most once per update call,
// even when the elapsed time far exceeds its delay.

interface SchedulerTimer {
  id: number
  delay: number
  elapsed: number
  callback: () => void
  repeat: number
  repeatCount: number
  interval: number
  active: number
}

export class Scheduler {
  paused: boolean = false

  private timers: SchedulerTimer[] = []
  private idCounter: number = 0

  delayedCall(delayMs: number, callback: () => void): number {
    const id = this.idCounter++
    this.timers.push({
      id,
      delay: delayMs,
      elapsed: 0,
      callback,
      repeat: 0,
      repeatCount: 0,
      interval: 0,
      active: 1,
    })
    return id
  }

  // repeat: 0 = one-shot, -1 = forever, N = fires N+1 times total
  addEvent(delayMs: number, repeat: number, callback: () => void): number {
    const id = this.idCounter++
    this.timers.push({
      id,
      delay: delayMs,
      elapsed: 0,
      callback,
      repeat,
      repeatCount: 0,
      interval: delayMs,
      active: 1,
    })
    return id
  }

  loop(delayMs: number, callback: () => void): number {
    return this.addEvent(delayMs, -1, callback)
  }

  remove(id: number): void {
    for (let i = 0; i < this.timers.length; i++) {
      if (this.timers[i].id === id) {
        this.timers[i].active = 0
        break
      }
    }
  }

  update(dt: number): void {
    if (this.paused) return
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]
      if (!t.active) {
        this.timers.splice(i, 1)
        continue
      }

      t.elapsed += dt
      if (t.elapsed >= t.delay) {
        t.callback()
        t.repeatCount++

        if (t.repeat === 0) {
          // One-shot
          t.active = 0
          this.timers.splice(i, 1)
        } else if (t.repeat === -1 || t.repeatCount <= t.repeat) {
          // Repeating
          t.elapsed -= t.delay
        } else {
          // Done repeating
          t.active = 0
          this.timers.splice(i, 1)
        }
      }
    }
  }

  clear(): void {
    this.timers.length = 0
  }
}
