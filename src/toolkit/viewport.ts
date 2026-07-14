// Game-to-screen coordinate mapping: fits a fixed-size game plane inside
// the screen (uniform scale, centered, floored to whole pixels) and fills
// the uncovered margins with black letterbox bars.

import type { PS2Runtime } from '../core/index.ts'

export interface ViewportOptions {
  gameWidth: number
  gameHeight: number
  screenWidth: number
  screenHeight: number
}

export class Viewport {
  readonly gameWidth: number
  readonly gameHeight: number
  readonly screenWidth: number
  readonly screenHeight: number
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number

  constructor(options: ViewportOptions) {
    this.gameWidth = options.gameWidth
    this.gameHeight = options.gameHeight
    this.screenWidth = options.screenWidth
    this.screenHeight = options.screenHeight
    this.scale = Math.min(
      this.screenWidth / this.gameWidth,
      this.screenHeight / this.gameHeight,
    )
    this.offsetX = Math.floor((this.screenWidth - this.gameWidth * this.scale) / 2)
    this.offsetY = Math.floor((this.screenHeight - this.gameHeight * this.scale) / 2)
  }

  // Convert game coordinates to screen coordinates
  toX(gx: number): number {
    return Math.floor(gx * this.scale + this.offsetX)
  }

  toY(gy: number): number {
    return Math.floor(gy * this.scale + this.offsetY)
  }

  toW(gw: number): number {
    return Math.floor(gw * this.scale)
  }

  toH(gh: number): number {
    return Math.floor(gh * this.scale)
  }

  // Fill the margins around the game plane with black bars
  drawLetterbox(rt: Pick<PS2Runtime, 'Draw' | 'Color'>): void {
    const barColor = rt.Color.new(0, 0, 0)
    // Left bar
    if (this.offsetX > 0) {
      rt.Draw.rect(0, 0, this.offsetX, this.screenHeight, barColor)
    }
    // Right bar
    const rightX = this.offsetX + Math.ceil(this.gameWidth * this.scale)
    if (rightX < this.screenWidth) {
      rt.Draw.rect(rightX, 0, this.screenWidth - rightX, this.screenHeight, barColor)
    }
    // Top bar
    if (this.offsetY > 0) {
      rt.Draw.rect(0, 0, this.screenWidth, this.offsetY, barColor)
    }
    // Bottom bar
    const bottomY = this.offsetY + Math.ceil(this.gameHeight * this.scale)
    if (bottomY < this.screenHeight) {
      rt.Draw.rect(0, bottomY, this.screenWidth, this.screenHeight - bottomY, barColor)
    }
  }
}
