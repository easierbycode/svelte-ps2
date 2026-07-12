// AthenaEnv Timer module — microsecond timers.
//   const t = Timer.new(); Timer.getTime(t); Timer.setTime(t, us);
//   Timer.pause/resume/reset/destroy(t)

interface TimerState {
  base: number // performance.now() ms at (virtual) time zero
  pausedAt: number | null
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export const Timer = {
  new(): TimerState {
    return { base: nowMs(), pausedAt: null }
  },
  getTime(t: TimerState): number {
    const current = t.pausedAt ?? nowMs()
    return Math.round((current - t.base) * 1000)
  },
  setTime(t: TimerState, us: number): void {
    const current = t.pausedAt ?? nowMs()
    t.base = current - us / 1000
  },
  pause(t: TimerState): void {
    if (t.pausedAt === null) t.pausedAt = nowMs()
  },
  resume(t: TimerState): void {
    if (t.pausedAt !== null) {
      t.base += nowMs() - t.pausedAt
      t.pausedAt = null
    }
  },
  reset(t: TimerState): void {
    t.base = nowMs()
    t.pausedAt = null
  },
  destroy(_t: TimerState): void {},
}
