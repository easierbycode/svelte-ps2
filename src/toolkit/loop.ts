// Fixed-timestep accumulator: converts a variable-rate host clock into
// a stream of fixed-Hz update steps. Feed it a monotonic millisecond
// clock; each tick() runs 0..maxSteps steps and drops the whole backlog
// when the cap is exceeded, so a stalled host never causes a spiral of
// catch-up updates.

export interface FixedStepOptions {
  fps: number
  now: () => number // monotonic milliseconds (caller supplies, e.g. from runtime Timer)
  maxSteps?: number // default 5; when exceeded, drop the backlog (no spiral of death)
}

export class FixedStep {
  private frameMs: number
  private now: () => number
  private maxSteps: number
  private last: number
  private acc: number = 0

  constructor(options: FixedStepOptions) {
    this.frameMs = 1000 / options.fps
    this.now = options.now
    this.maxSteps = options.maxSteps ?? 5
    this.last = this.now()
  }

  // Run 0..maxSteps fixed steps, return how many ran
  tick(step: () => void): number {
    const current = this.now()
    this.acc += current - this.last
    this.last = current
    let steps = Math.floor(this.acc / this.frameMs)
    if (steps > this.maxSteps) {
      steps = this.maxSteps
      this.acc = 0
    } else {
      this.acc -= steps * this.frameMs
    }
    for (let i = 0; i < steps; i++) step()
    return steps
  }

  // Forget accumulated time and re-base the clock (e.g. after a pause)
  reset(): void {
    this.acc = 0
    this.last = this.now()
  }
}
