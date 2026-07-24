// Reusable, host-agnostic game utilities written against the PS2Runtime
// surface: they run on the browser shim and, via src/native, on real
// AthenaEnv hardware. Immediate-mode counterparts to the retained-mode
// helpers a Phaser game would get for free.

export { EASES, getEase } from './easing.ts'
export type { EaseFn } from './easing.ts'
export { TweenManager } from './tween.ts'
export type { TweenOptions, TweenTarget } from './tween.ts'
export { Scheduler } from './scheduler.ts'
export { FixedStep } from './loop.ts'
export type { FixedStepOptions } from './loop.ts'
export { Viewport } from './viewport.ts'
export type { ViewportOptions } from './viewport.ts'
export { AtlasManager } from './atlas.ts'
export type { AtlasFrame, AtlasEntry } from './atlas.ts'
export {
  createSprite,
  createAnimSprite,
  updateSpriteAnim,
  drawSprite,
  drawSpriteGame,
  hitTestAABB,
  hitTestSprites,
  hitTestSpriteRect,
} from './sprite.ts'
export type { PS2Sprite } from './sprite.ts'
export { SceneManager } from './scenes.ts'
export type { SceneHandlers, SceneManagerOptions } from './scenes.ts'
