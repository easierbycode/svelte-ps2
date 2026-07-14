// SceneManager — named scene registry with black fade-out transitions.
// switch() starts a fade; when it completes the next scene is initialized
// and receives its first update in the same step (there is no fade-in
// after the switch). switchImmediate() re-inits without any fade. draw()
// renders the current scene, then the fade rect on top while fading.

import type { PS2Runtime } from '../core/index.ts'

export interface SceneHandlers {
  init?(): void
  update?(): void
  draw?(): void
}

export interface SceneManagerOptions {
  rt: Pick<PS2Runtime, 'Draw' | 'Color'>
  screenWidth: number
  screenHeight: number
  /** fade alpha advance per update (default 0.03) */
  fadeStep?: number
  /** runs before a scene's init (both switch paths) */
  beforeInit?: (name: string) => void
}

export class SceneManager {
  #rt: Pick<PS2Runtime, 'Draw' | 'Color'>
  #screenWidth: number
  #screenHeight: number
  #fadeStep: number
  #beforeInit: ((name: string) => void) | undefined
  #handlers: Record<string, SceneHandlers> = {}
  #current: string = ''
  #timer: number = 0
  #fadeAlpha: number = 0
  #fading: boolean = false
  #next: string = ''

  constructor(options: SceneManagerOptions) {
    this.#rt = options.rt
    this.#screenWidth = options.screenWidth
    this.#screenHeight = options.screenHeight
    this.#fadeStep = options.fadeStep ?? 0.03
    this.#beforeInit = options.beforeInit
  }

  get current(): string {
    return this.#current
  }

  get timer(): number {
    return this.#timer
  }

  get fading(): boolean {
    return this.#fading
  }

  register(name: string, handlers: SceneHandlers): void {
    this.#handlers[name] = handlers
  }

  switch(name: string): void {
    this.#fading = true
    this.#next = name
    this.#fadeAlpha = 0
  }

  switchImmediate(name: string): void {
    this.#current = name
    this.#timer = 0
    this.#fading = false
    this.#fadeAlpha = 0
    this.#init(name)
  }

  #init(name: string): void {
    this.#beforeInit?.(name)
    this.#handlers[name]?.init?.()
  }

  update(): void {
    if (this.#fading) {
      this.#fadeAlpha += this.#fadeStep
      if (this.#fadeAlpha < 1.0) return // scene logic is frozen while fading out
      this.#fadeAlpha = 1.0
      this.#current = this.#next
      this.#timer = 0
      this.#init(this.#current)
      this.#fading = false
    }
    this.#timer++
    this.#handlers[this.#current]?.update?.()
  }

  draw(): void {
    this.#handlers[this.#current]?.draw?.()
    if (this.#fadeAlpha > 0 && this.#fading) {
      const a = Math.floor(this.#fadeAlpha * 128)
      const fadeColor = this.#rt.Color.new(0, 0, 0, a)
      this.#rt.Draw.rect(0, 0, this.#screenWidth, this.#screenHeight, fadeColor)
    }
  }
}
